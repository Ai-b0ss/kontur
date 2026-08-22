from __future__ import annotations
import fcntl, json, os, tempfile
from pathlib import Path

class CurrentStoreModel:
    VERSION=2
    def __init__(self,path: Path):
        self.path=path; self.uncertain=set(); self.inflight=set(); self._load_or_init()
    def _load_or_init(self):
        if not self.path.exists(): self._persist(set(),set()); return
        p=json.loads(self.path.read_text()); self.uncertain=set(p['uncertain_task_ids']); self.inflight={(x['task_id'],x['call_id']) for x in p['inflight_calls']}
    def _payload(self,u,i): return {'version':2,'uncertain_task_ids':sorted(u),'inflight_calls':[{'task_id':t,'call_id':c} for t,c in sorted(i)]}
    def _persist(self,u,i):
        self.path.parent.mkdir(parents=True,exist_ok=True); fd,tmp=tempfile.mkstemp(prefix=self.path.name+'.tmp-',dir=self.path.parent); t=Path(tmp)
        try:
            with os.fdopen(fd,'w',encoding='utf-8',newline='') as h:
                json.dump(self._payload(u,i),h,sort_keys=True,separators=(',',':')); h.write('\n'); h.flush(); os.fsync(h.fileno())
            os.replace(t,self.path)
        finally: t.unlink(missing_ok=True)
    def begin_call(self,task,call):
        nxt=set(self.inflight); nxt.add((task,call)); self._persist(set(self.uncertain),nxt); self.inflight=nxt

class LockedStoreCandidate(CurrentStoreModel):
    """Linux proof-of-contract only; product still needs a proven cross-platform lock primitive."""
    def begin_call(self,task,call):
        lock_path=self.path.with_suffix(self.path.suffix+'.lock')
        lock_path.parent.mkdir(parents=True,exist_ok=True)
        with lock_path.open('a+') as lock:
            fcntl.flock(lock.fileno(),fcntl.LOCK_EX)
            p=json.loads(self.path.read_text())
            current_uncertain=set(p['uncertain_task_ids'])
            current_inflight={(x['task_id'],x['call_id']) for x in p['inflight_calls']}
            if task in current_uncertain or any(t==task for t,_ in current_inflight):
                raise RuntimeError('task already guarded')
            current_inflight.add((task,call))
            self._persist(current_uncertain,current_inflight)
            self.uncertain=current_uncertain; self.inflight=current_inflight
            fcntl.flock(lock.fileno(),fcntl.LOCK_UN)

def pairs(path):
    p=json.loads(path.read_text()); return {(x['task_id'],x['call_id']) for x in p['inflight_calls']}

def current_case():
    with tempfile.TemporaryDirectory() as td:
        p=Path(td)/'subagent-tombstones.json'; a=CurrentStoreModel(p); b=CurrentStoreModel(p)
        a.begin_call('child-A','call-A'); first=pairs(p); b.begin_call('child-B','call-B'); final=pairs(p)
        assert ('child-A','call-A') in first and ('child-A','call-A') not in final and ('child-B','call-B') in final
        return {'first':sorted(first),'final':sorted(final),'lost_A':True}

def candidate_case():
    with tempfile.TemporaryDirectory() as td:
        p=Path(td)/'subagent-tombstones.json'; a=LockedStoreCandidate(p); b=LockedStoreCandidate(p)
        a.begin_call('child-A','call-A'); b.begin_call('child-B','call-B'); final=pairs(p)
        assert final=={('child-A','call-A'),('child-B','call-B')}
        return {'final':sorted(final),'lost_A':False,'linux_lock_contract':'PASS'}

if __name__=='__main__':
    out={'verdict':'NOTION_TOMBSTONE_MULTIWRITER_RACE_REPRODUCED_AND_LOCK_CONTRACT_PASS','current':current_case(),'candidate':candidate_case(),'product_requirement':'one cross-process read-modify-write critical section with canonical refresh under lock; Windows lock semantics must be proved natively before product integration'}
    print(json.dumps(out,sort_keys=True))
