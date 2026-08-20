#!/usr/bin/env python3
import asyncio, json

class CurrentLifecycle:
    def __init__(self): self.active=set()
    async def run_child(self, task_id, runner):
        if task_id in self.active: raise RuntimeError('already active')
        self.active.add(task_id)
        try: return await runner()
        finally: self.active.discard(task_id)

class CurrentLikeToolLoop:
    def __init__(self, side_effects, entered, release):
        self.side_effects=side_effects; self.entered=entered; self.release=release; self.history=[]
    async def tool_executor(self):
        self.side_effects.append('WRITE'); self.entered.set(); await self.release.wait(); return {'ok': True}
    async def run(self):
        self.history.append({'type':'assistant_tool_calls','call_id':'call-1'})
        try:
            result=await self.tool_executor(); output=json.dumps(result,sort_keys=True)
        except Exception:
            output=json.dumps({'ok':False,'error':'tool_execution_failed'})
        self.history.append({'type':'function_call_output','call_id':'call-1','output':output})
        return 'done'

class SafeContractLifecycle:
    def __init__(self): self.active=set(); self.uncertain=set()
    async def run_child(self, task_id, runner):
        if task_id in self.active or task_id in self.uncertain: raise RuntimeError('retry blocked: active/uncertain')
        self.active.add(task_id)
        try: return await runner()
        except asyncio.CancelledError:
            self.uncertain.add(task_id); raise
        finally: self.active.discard(task_id)

async def reproduce_current():
    side=[]; life=CurrentLifecycle(); entered=asyncio.Event(); release=asyncio.Event(); loop1=CurrentLikeToolLoop(side,entered,release)
    task=asyncio.create_task(life.run_child('child-1',loop1.run)); await entered.wait(); task.cancel()
    try: await task
    except asyncio.CancelledError: pass
    first={'side_effects_after_cancel':len(side),'task_still_reserved':'child-1' in life.active,'tool_result_recorded':any(x.get('type')=='function_call_output' for x in loop1.history)}
    entered2=asyncio.Event(); release2=asyncio.Event(); release2.set(); loop2=CurrentLikeToolLoop(side,entered2,release2)
    await life.run_child('child-1',loop2.run)
    return first|{'side_effects_after_automatic_rerun':len(side),'duplicate_side_effect':len(side)==2}

async def verify_safe_contract():
    side=[]; life=SafeContractLifecycle(); entered=asyncio.Event(); release=asyncio.Event(); loop1=CurrentLikeToolLoop(side,entered,release)
    task=asyncio.create_task(life.run_child('child-1',loop1.run)); await entered.wait(); task.cancel()
    try: await task
    except asyncio.CancelledError: pass
    blocked=False
    try:
        entered2=asyncio.Event(); release2=asyncio.Event(); release2.set(); loop2=CurrentLikeToolLoop(side,entered2,release2)
        await life.run_child('child-1',loop2.run)
    except RuntimeError as exc: blocked='retry blocked' in str(exc)
    return {'side_effects_after_cancel':len(side),'uncertain_reserved':'child-1' in life.uncertain,'automatic_retry_blocked':blocked,'duplicate_side_effect':len(side)>1}

async def main():
    current=await reproduce_current(); safe=await verify_safe_contract()
    assert current['side_effects_after_cancel']==1 and current['task_still_reserved'] is False and current['tool_result_recorded'] is False and current['duplicate_side_effect'] is True
    assert safe['side_effects_after_cancel']==1 and safe['uncertain_reserved'] is True and safe['automatic_retry_blocked'] is True and safe['duplicate_side_effect'] is False
    print(json.dumps({'verdict':'REPRODUCED_CURRENT_DUPLICATE_AND_SAFE_CONTRACT_PASS','current':current,'candidate_contract':safe},sort_keys=True))

asyncio.run(main())
