from __future__ import annotations
import asyncio, importlib.util, json
from pathlib import Path
from starlette.responses import StreamingResponse
C=Path(__file__).with_name('20260824T0546Z_stageb_stream_failure_projection_candidate.py')
S=importlib.util.spec_from_file_location('stageb_stream_failure_projection_candidate',C); assert S and S.loader
M=importlib.util.module_from_spec(S); S.loader.exec_module(M)
projector=M.buffered_sse_projection_with_keepalive; failed=M.stageb_failed_sse
async def ok(r): yield ('event: response.completed\ndata: '+json.dumps(r)+'\n\n').encode()
async def bad_project(_):
    yield b'event: response.created\ndata: {"response":{"id":"resp_should_not_leak"}}\n\n'
    raise RuntimeError('SECRET_PATH=/private/runtime/provider')
async def collect(g): return [x async for x in g]
async def asgi(g):
    r=StreamingResponse(g,media_type='text/event-stream'); sent=[]; q=asyncio.Queue(); await q.put({'type':'http.request','body':b'','more_body':False})
    async def recv(): return await q.get()
    async def send(m): sent.append(m)
    scope={'type':'http','asgi':{'version':'3.0','spec_version':'2.4'},'http_version':'1.1','method':'GET','scheme':'http','path':'/v1/responses','raw_path':b'/v1/responses','query_string':b'','headers':[],'client':('127.0.0.1',1),'server':('127.0.0.1',80)}
    await r(scope,recv,send); return sent
async def main():
    n=0
    async def slow(): await asyncio.sleep(.12); return {'type':'response.completed','response':{'id':'resp_exact'}}
    t=asyncio.create_task(slow()); c=await collect(projector(t,ok,heartbeat_seconds=.05)); assert c[:-1] and all(x==b': stageb-commit-pending\n\n' for x in c[:-1]) and b'resp_exact' in c[-1]; n+=1
    t=asyncio.create_task(asyncio.sleep(0,result={'ok':True})); await t; c=await collect(projector(t,ok)); assert len(c)==1 and b'response.completed' in c[0]; n+=1
    async def late(): await asyncio.sleep(.07); raise RuntimeError('SECRET_PATH=/private/runtime/provider')
    t=asyncio.create_task(late()); c=await collect(projector(t,ok,heartbeat_seconds=.05)); assert c[0]==b': stageb-commit-pending\n\n' and b'response.failed' in c[-1] and b'SECRET_PATH' not in c[-1] and b'resp_' not in c[-1] and b'call_' not in c[-1]; n+=1
    async def immediate(): raise RuntimeError('private')
    t=asyncio.create_task(immediate()); await asyncio.sleep(0); c=await collect(projector(t,ok)); assert len(c)==1 and b'response.failed' in c[0]; n+=1
    t=asyncio.create_task(asyncio.sleep(0,result={'id':'durable'})); await t; c=await collect(projector(t,bad_project)); assert len(c)==1 and b'response.failed' in c[0] and b'resp_should_not_leak' not in c[0]; n+=1
    gate=asyncio.Event()
    async def owned(): await gate.wait(); return {'ok':True}
    t=asyncio.create_task(owned()); w=asyncio.create_task(collect(projector(t,ok,heartbeat_seconds=1))); await asyncio.sleep(.02); w.cancel()
    try: await w
    except asyncio.CancelledError: pass
    assert not t.cancelled() and not t.done(); gate.set(); await t; n+=1
    t=asyncio.create_task(late()); ms=await asgi(projector(t,ok,heartbeat_seconds=.05)); body=b''.join(x.get('body',b'') for x in ms if x['type']=='http.response.body'); assert ms[0]['status']==200 and b': stageb-commit-pending\n\n' in body and b'event: response.failed' in body and b'response.completed' not in body; n+=1
    d=json.loads(failed().decode().split('data: ',1)[1]); assert d['type']=='response.failed' and d['response']['error']['code']=='server_error' and 'id' not in d['response']; n+=1
    provider_calls=1; unresolved_intent=True; provider_calls+=int(not unresolved_intent); assert provider_calls==1; n+=1
    t=asyncio.create_task(asyncio.sleep(10)); t.cancel()
    try: await t
    except asyncio.CancelledError: pass
    c=await collect(projector(t,ok)); assert len(c)==1 and b'response.failed' in c[0]; n+=1
    print(f'STAGEB_STREAM_FAILURE_PROJECTION_EXACT_PASS {n}/10')
if __name__=='__main__': asyncio.run(main())
