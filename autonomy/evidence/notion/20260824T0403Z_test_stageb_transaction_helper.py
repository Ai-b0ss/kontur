from __future__ import annotations

import asyncio
import copy
from contextlib import asynccontextmanager
from dataclasses import dataclass

from stageb_transaction import (
    CommitTaskRegistry,
    StageBProviderResult,
    StageBReplayRehydrateError,
    StageBRequest,
    StageBTransactionCoordinator,
    buffered_sse_projection,
)


class FakeStore:
    def __init__(self):
        self.replays = {}
        self.segment = None
        self.intents = {}
        self.blocked = False
        self.fail_begin = False
        self.fail_finalize = False
        self.events = []

    async def assert_provider_ready(self):
        self.events.append('ready')
        if self.blocked:
            raise RuntimeError('blocked')

    async def replay_for(self, key, fp):
        self.events.append('replay')
        if key in self.intents:
            raise RuntimeError('uncertain')
        return copy.deepcopy(self.replays.get((key, fp)))

    async def get(self, key):
        self.events.append('get')
        return copy.deepcopy(self.segment)

    async def begin_provider_intent(self, key, *, request_fingerprint, account_id, request_kind):
        self.events.append('intent')
        if self.fail_begin:
            self.blocked = True
            raise RuntimeError('begin-write-failed')
        self.intents[key] = (request_fingerprint, account_id, request_kind)

    async def finalize_provider_intent(self, key, **kw):
        self.events.append('finalize')
        if self.fail_finalize:
            self.blocked = True
            raise RuntimeError('finalize-write-failed')
        expected = self.intents[key]
        assert expected == (kw['request_fingerprint'], kw['account_id'], kw['request_kind'])
        self.replays[(key, kw['request_fingerprint'])] = copy.deepcopy(kw['rendered_response'])
        self.segment = type('Seg', (), {'account_id':kw['account_id']})()
        del self.intents[key]


@dataclass
class Route:
    account_id: str


class Harness:
    def __init__(self):
        self.store = FakeStore(); self.events=[]; self.provider_calls=0
        self.acquire_fail=False; self.provider_fail=False; self.publish_fail=False; self.rehydrate_fail=False
        self.provider_gate=None
        self.route_id='a1'

    @asynccontextmanager
    async def acquire(self, hint):
        self.events.append('acquire')
        if self.acquire_fail: raise RuntimeError('pool-unavailable')
        yield Route(self.route_id)
        self.events.append('release')

    async def provider(self, route, segment):
        self.events.append('provider'); self.provider_calls += 1
        if self.provider_gate is not None: await self.provider_gate.wait()
        if self.provider_fail: raise RuntimeError('transport-ambiguous')
        return StageBProviderResult('thread-a1', 3, 5, {'tool':'edit'})

    def render(self, result):
        self.events.append('render')
        return {'id':'resp-fixed','output':[{'id':'fc-fixed','call_id':'call-fixed'}]}

    async def rehydrate(self, segment, replay):
        self.events.append('rehydrate')
        if self.rehydrate_fail: raise RuntimeError('removed-account')

    async def publish(self, route, result, canonical):
        self.events.append('publish')
        if self.publish_fail: raise RuntimeError('reservation-failed')

    def coordinator(self):
        return StageBTransactionCoordinator(
            store=self.store, acquire_route=self.acquire, run_provider=self.provider,
            render=self.render, rehydrate_replay=self.rehydrate, publish_ephemeral=self.publish,
        )


def req(turn='t1', kind='turn'):
    return StageBRequest('conv', 'fp-'+turn+'-'+kind, kind, ('i1',), 0, kind=='compaction', 1, 'gpt-5.6-sol', 'ctx')


async def main():
    passed=[]
    h=Harness(); out=await h.coordinator().execute(req()); assert out['id']=='resp-fixed'; assert h.provider_calls==1
    passed.append('success')

    h=Harness(); h.acquire_fail=True
    try: await h.coordinator().execute(req())
    except RuntimeError as e: assert str(e)=='pool-unavailable'
    else: raise AssertionError
    assert h.provider_calls==0 and not h.store.intents
    passed.append('pool-before-intent')

    h=Harness(); h.store.fail_begin=True
    try: await h.coordinator().execute(req())
    except RuntimeError as e: assert str(e)=='begin-write-failed'
    else: raise AssertionError
    assert h.provider_calls==0 and not h.store.intents and h.store.blocked
    passed.append('intent-write-fail')

    h=Harness(); h.provider_fail=True
    try: await h.coordinator().execute(req())
    except RuntimeError as e: assert str(e)=='transport-ambiguous'
    else: raise AssertionError
    assert h.provider_calls==1 and 'conv' in h.store.intents and 'publish' not in h.events
    try: await h.coordinator().execute(req())
    except RuntimeError: pass
    else: raise AssertionError
    assert h.provider_calls==1
    passed.append('ambiguous-single-attempt')

    h=Harness(); h.store.fail_finalize=True
    try: await h.coordinator().execute(req())
    except RuntimeError as e: assert str(e)=='finalize-write-failed'
    else: raise AssertionError
    assert h.provider_calls==1 and 'conv' in h.store.intents and 'publish' not in h.events
    try: await h.coordinator().execute(req())
    except RuntimeError: pass
    assert h.provider_calls==1
    passed.append('finalize-fail')

    h=Harness(); h.publish_fail=True
    try: await h.coordinator().execute(req())
    except RuntimeError as e: assert str(e)=='reservation-failed'
    else: raise AssertionError
    assert h.provider_calls==1 and ('conv', req().request_fingerprint) in h.store.replays
    h.publish_fail=False
    replay=await h.coordinator().execute(req())
    assert replay['output'][0]['call_id']=='call-fixed' and h.provider_calls==1 and 'rehydrate' in h.events
    passed.append('postcommit-replay')

    h=Harness(); await h.coordinator().execute(req()); h.rehydrate_fail=True
    try: await h.coordinator().execute(req())
    except StageBReplayRehydrateError: pass
    else: raise AssertionError
    assert h.provider_calls==1
    passed.append('removed-account')

    h=Harness(); h.provider_gate=asyncio.Event(); registry=CommitTaskRegistry(); task=registry.start(h.coordinator().execute(req()))
    while h.provider_calls==0: await asyncio.sleep(0)
    waiter=asyncio.create_task(registry.wait_client(task)); await asyncio.sleep(0); waiter.cancel()
    try: await waiter
    except asyncio.CancelledError: pass
    h.provider_gate.set(); await task
    replay=await h.coordinator().execute(req())
    assert replay['id']=='resp-fixed' and h.provider_calls==1
    await registry.shutdown(.1)
    passed.append('disconnect-detached-commit')

    h=Harness(); h.provider_gate=asyncio.Event(); registry=CommitTaskRegistry(); task=registry.start(h.coordinator().execute(req()))
    seen=[]
    async def project(result):
        assert result['id']=='resp-fixed'; yield (result['id']+'|'+result['output'][0]['call_id']).encode()
    async def collect():
        async for c in buffered_sse_projection(task, registry, project): seen.append(c)
    consumer=asyncio.create_task(collect())
    while h.provider_calls==0: await asyncio.sleep(0)
    await asyncio.sleep(0); assert seen==[]
    h.provider_gate.set(); await consumer
    assert seen==[b'resp-fixed|call-fixed']
    await registry.shutdown(.1)
    passed.append('buffered-stream')

    h=Harness(); h.provider_gate=asyncio.Event(); registry=CommitTaskRegistry(); task=registry.start(h.coordinator().execute(req()))
    while h.provider_calls==0: await asyncio.sleep(0)
    await registry.shutdown(0)
    assert task.cancelled() and 'conv' in h.store.intents
    passed.append('bounded-shutdown-intent')

    h=Harness(); accounts=[]
    async def corrected_provider(route, segment):
        accounts.append(route.account_id); h.provider_calls += 1
        accounts.append(route.account_id); h.provider_calls += 1
        return StageBProviderResult('thread-a1', 4, 6, {'ok':True})
    c=StageBTransactionCoordinator(store=h.store, acquire_route=h.acquire, run_provider=corrected_provider, render=h.render, rehydrate_replay=h.rehydrate, publish_ephemeral=h.publish)
    await c.execute(req()); assert accounts==['a1','a1'] and h.events.count('acquire')==1
    passed.append('deliberate-correction-same-account')

    log=[]; h=Harness()
    orig_ready=h.store.assert_provider_ready; orig_replay=h.store.replay_for; orig_get=h.store.get; orig_begin=h.store.begin_provider_intent; orig_fin=h.store.finalize_provider_intent
    async def ready(): log.append('ready'); return await orig_ready()
    async def replay(k,f): log.append('replay'); return await orig_replay(k,f)
    async def get(k): log.append('get'); return await orig_get(k)
    async def begin(*a,**kw): log.append('intent'); return await orig_begin(*a,**kw)
    async def fin(*a,**kw): log.append('finalize'); return await orig_fin(*a,**kw)
    h.store.assert_provider_ready=ready; h.store.replay_for=replay; h.store.get=get; h.store.begin_provider_intent=begin; h.store.finalize_provider_intent=fin
    @asynccontextmanager
    async def acq(hint): log.append('acquire'); yield Route('a1'); log.append('release')
    async def prov(route,seg): log.append('provider'); h.provider_calls+=1; return StageBProviderResult('thr',1,1,None)
    def rend(result): log.append('render'); return {'id':'resp','output':[]}
    async def pub(route,result,canon): log.append('publish')
    c=StageBTransactionCoordinator(store=h.store,acquire_route=acq,run_provider=prov,render=rend,rehydrate_replay=h.rehydrate,publish_ephemeral=pub)
    await c.execute(req())
    assert log.index('acquire') < log.index('intent') < log.index('provider') < log.index('render') < log.index('finalize') < log.index('publish')
    passed.append('strict-global-order')

    print('STAGEB_TRANSACTION_HELPER_PASS cases=%d' % len(passed))
    print('\n'.join(passed))

asyncio.run(main())
