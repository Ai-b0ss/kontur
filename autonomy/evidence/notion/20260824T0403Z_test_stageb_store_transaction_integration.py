import asyncio, importlib.util, json, os, sys, tempfile, types
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

# Minimal NCM28 facade with deterministic strict-write failure injection.
class FilesystemOwnershipError(OSError): pass
@dataclass
class Snapshot:
    exists: bool
    data: bytes|None
    path: str=''
FAIL_WRITES=False

def recover(path): return None
def capture(path,parent_guard=None):
    p=Path(path); return Snapshot(p.exists(),p.read_bytes() if p.exists() else None,str(p))
class Guard:
    def __enter__(self): return self
    def __exit__(self,*a): return False
def ensure(parent): Path(parent).mkdir(parents=True,exist_ok=True); return Guard()
def atomic(path,raw,snapshot,parent_guard=None):
    global FAIL_WRITES
    if FAIL_WRITES: raise OSError('injected write failure')
    p=Path(path); p.parent.mkdir(parents=True,exist_ok=True); tmp=p.with_name(p.name+'.tmp'); tmp.write_bytes(raw); os.replace(tmp,p); return Snapshot(True,raw,str(p))
ncm=types.ModuleType('ncm28_filesystem'); ncm.FilesystemOwnershipError=FilesystemOwnershipError; ncm.OwnershipSnapshot=Snapshot
ncm.atomic_write_from_snapshot=atomic; ncm.capture_ownership_snapshot=capture; ncm.recover_atomic_write=recover; ncm.ensure_guarded_directory=ensure
sys.modules['ncm28_filesystem']=ncm
pm=types.ModuleType('prompt_modes'); pm.prompt_policy_fingerprint=lambda body:'engineerfp'; pm.requested_prompt_mode=lambda body:'engineer'; sys.modules['prompt_modes']=pm

spec=importlib.util.spec_from_file_location('store','/mnt/data/conversation_segments_stageb.py'); store=importlib.util.module_from_spec(spec); sys.modules['store']=store; spec.loader.exec_module(store)
spec2=importlib.util.spec_from_file_location('txn','/mnt/data/stageb_transaction.py'); txn=importlib.util.module_from_spec(spec2); sys.modules['txn']=txn; spec2.loader.exec_module(txn)

BODY={'model':'gpt-5.6-sol','instructions':'cwd=/tmp/x','input':[{'type':'message','role':'user','content':'do it'}],'tools':[{'type':'function','name':'read_file'}],'tool_choice':'auto'}

@dataclass
class Route: account_id:str

class Harness:
    def __init__(self,path):
        self.s=store.ConversationSegmentStore(path); self.provider_calls=0; self.publish_calls=0; self.rehydrate_calls=0
        self.fail_provider=False; self.fail_publish=False; self.account='a1'; self.gate=None
    @asynccontextmanager
    async def acquire(self,hint):
        yield Route(self.account)
    async def provider(self,route,segment):
        self.provider_calls+=1
        if self.gate: await self.gate.wait()
        if self.fail_provider: raise RuntimeError('ambiguous')
        return txn.StageBProviderResult('thread-'+route.account_id,7,5,{'ok':True})
    def render(self,result):
        return {'id':'resp-fixed','object':'response','output':[{'id':'fc-fixed','type':'function_call','call_id':'call-fixed','name':'read_file','arguments':'{}'}]}
    async def rehydrate(self,segment,replay):
        self.rehydrate_calls+=1
        if segment is None or segment.account_id != self.account: raise RuntimeError('account unavailable')
    async def publish(self,route,result,canonical):
        self.publish_calls+=1
        if self.fail_publish: raise RuntimeError('ephemeral fail')
    def coord(self):
        return txn.StageBTransactionCoordinator(store=self.s,acquire_route=self.acquire,run_provider=self.provider,render=self.render,rehydrate_replay=self.rehydrate,publish_ephemeral=self.publish)

def request(turn='turn1',kind='turn'):
    fp=store.durable_request_fingerprint(BODY,turn_key=turn,request_kind=kind)
    return txn.StageBRequest('conv',fp,kind,store.response_input_fingerprints(BODY),0,kind=='compaction',1,'gpt-5.6-sol',store.response_context_fingerprint(BODY,kind))

async def main():
    global FAIL_WRITES
    with tempfile.TemporaryDirectory() as td:
        p=Path(td)/'state.json'; h=Harness(p); c=h.coord(); r=request()
        out=await c.execute(r); assert out['output'][0]['call_id']=='call-fixed'; assert h.provider_calls==1
        disk=json.loads(p.read_text()); assert disk['version']==3 and not disk['provider_intents']; assert disk['conversations']
        out2=await c.execute(r); assert out2==out and h.provider_calls==1 and h.rehydrate_calls==1
        h2=Harness(p); out3=await h2.coord().execute(r); assert out3==out and h2.provider_calls==0 and h2.rehydrate_calls==1
        p2=Path(td)/'ephemeral.json'; e=Harness(p2); e.fail_publish=True
        try: await e.coord().execute(r); raise AssertionError
        except RuntimeError as x: assert str(x)=='ephemeral fail'
        assert e.provider_calls==1
        er=Harness(p2); exact=await er.coord().execute(r); assert exact==out and er.provider_calls==0
        p3=Path(td)/'ambiguous.json'; a=Harness(p3); a.fail_provider=True
        try: await a.coord().execute(r); raise AssertionError
        except RuntimeError as x: assert str(x)=='ambiguous'
        assert a.provider_calls==1 and json.loads(p3.read_text())['provider_intents']
        ar=Harness(p3)
        try: await ar.coord().execute(r); raise AssertionError
        except store.ProviderOutcomeUncertainError: pass
        assert ar.provider_calls==0
        p4=Path(td)/'writefail.json'; w=Harness(p4); FAIL_WRITES=True
        try: await w.coord().execute(r); raise AssertionError
        except store.ConversationPersistenceError: pass
        FAIL_WRITES=False; assert w.provider_calls==0
        p5=Path(td)/'finalfail.json'; f=Harness(p5)
        original=f.s.finalize_provider_intent
        async def fail_final(*args,**kwargs):
            global FAIL_WRITES
            FAIL_WRITES=True
            try: return await original(*args,**kwargs)
            finally: FAIL_WRITES=False
        f.s.finalize_provider_intent=fail_final
        try: await f.coord().execute(r); raise AssertionError
        except store.ConversationPersistenceError: pass
        persisted=json.loads(p5.read_text()); assert persisted['provider_intents']; assert not persisted['conversations']; assert f.provider_calls==1 and f.publish_calls==0
        p6=Path(td)/'disconnect.json'; d=Harness(p6); d.gate=asyncio.Event(); reg=txn.CommitTaskRegistry(); task=reg.start(d.coord().execute(r))
        while d.provider_calls==0: await asyncio.sleep(0)
        waiter=asyncio.create_task(reg.wait_client(task)); await asyncio.sleep(0); waiter.cancel()
        try: await waiter
        except asyncio.CancelledError: pass
        d.gate.set(); await task; await reg.shutdown(.1)
        dr=Harness(p6); got=await dr.coord().execute(r); assert got['output'][0]['call_id']=='call-fixed' and dr.provider_calls==0
        rr=Harness(p6); rr.account='replacement'
        try: await rr.coord().execute(r); raise AssertionError
        except txn.StageBReplayRehydrateError: pass
        assert rr.provider_calls==0
    print('STAGEB_STORE_TRANSACTION_INTEGRATION_PASS cases=9')
asyncio.run(main())
