#!/usr/bin/env python3
import asyncio, json

async def current_notion_tool_loop(model_step, tool_executor, max_turns=4):
    history=[]
    seen=set()
    completed=0
    while completed < max_turns:
        reply=await model_step(tuple(history))
        if not reply["tool_calls"]:
            text=reply["text"].strip()
            if not text:
                raise RuntimeError("delegated model finished without text output")
            return text, history
        completed += 1
        calls=reply["tool_calls"]
        history.append({"type":"assistant_tool_calls","calls":calls})
        for call in calls:
            cid=call["call_id"]
            if cid in seen:
                raise RuntimeError("delegated tool call id was reused")
            seen.add(cid)
            try:
                raw=await tool_executor(call)
                result=dict(raw)
                if not result:
                    result={"ok":False,"error":"tool_result_invalid"}
                try:
                    output=json.dumps(result,sort_keys=True)
                except Exception:
                    output=json.dumps({"ok":False,"error":"tool_result_invalid"},sort_keys=True)
            except Exception:
                output=json.dumps({"ok":False,"error":"tool_execution_failed"},sort_keys=True)
            history.append({"type":"function_call_output","call_id":cid,"output":output})
    raise RuntimeError("budget")

class ScriptedModel:
    def __init__(self):
        self.n=0
    async def __call__(self, history):
        self.n += 1
        if self.n == 1:
            return {"text":"","tool_calls":[{"call_id":"c1","name":"write_file"}]}
        if self.n == 2:
            assert '"tool_execution_failed"' in history[-1]["output"]
            return {"text":"","tool_calls":[{"call_id":"c2","name":"write_file"}]}
        return {"text":"done","tool_calls":[]}

async def main():
    side_effects=[]
    first=True
    async def tool(call):
        nonlocal first
        side_effects.append(call["call_id"])
        if first:
            first=False
            raise OSError("post-write acknowledgement failed")
        return {"ok":True}

    result, _history=await current_notion_tool_loop(ScriptedModel(),tool)
    assert result=="done"
    assert side_effects==["c1","c2"], side_effects

    candidate={
      "verdict":"PASS",
      "duplicate_side_effect_reproduced":True,
      "side_effect_count":len(side_effects),
      "current_error_seen_by_model":"tool_execution_failed",
      "required_cross_provider_state":"uncertain",
      "automatic_retry_after_uncertain_allowed":False,
      "qwen_equivalent_guard":"markUncertainAfterPotentialSideEffect"
    }
    print(json.dumps(candidate,sort_keys=True))

asyncio.run(main())
