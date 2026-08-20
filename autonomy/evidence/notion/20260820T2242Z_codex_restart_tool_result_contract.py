#!/usr/bin/env python3
"""Offline exact-formula lifecycle proof for Core PR#7 + Agent PR#8 integration boundary."""
import hashlib, json

def pr7_response_input_fingerprints(body):
    value = body.get('input')
    items = value if isinstance(value, list) else [value] if isinstance(value, str) else []
    return tuple(hashlib.sha256(json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest() for item in items)

def _metadata(body):
    value=body.get('client_metadata')
    return value if isinstance(value,dict) else {}

def requested_prompt_mode(body):
    metadata=_metadata(body)
    raw_mode=metadata.get('notion_prompt_mode',metadata.get('prompt_mode','engineer'))
    return str(raw_mode or 'engineer').strip().lower()

def prompt_policy_fingerprint(body):
    metadata=_metadata(body); mode=requested_prompt_mode(body)
    identity={'kind':'notion_prompt_policy_v1','mode':mode}
    if mode=='owner':
        identity['owner_system_prompt']=metadata.get('owner_system_prompt')
        identity['runtime_context']=metadata.get('runtime_context','')
    encoded=json.dumps(identity,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()

def pr8_response_input_fingerprints(body):
    value=body.get('input')
    items=value if isinstance(value,list) else [value] if isinstance(value,str) else []
    policy_fingerprint=prompt_policy_fingerprint(body)
    request_context={
        'bridge_prompt_policy':policy_fingerprint,
        'engineer_instructions': body.get('instructions') if requested_prompt_mode(body)!='owner' else None,
        'tools':body.get('tools'),
        'tool_choice':body.get('tool_choice'),
        'text':body.get('text'),
    }
    return tuple(hashlib.sha256(json.dumps({**request_context,'item':item},ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest() for item in items)

def input_prefix_length(previous,current):
    if len(previous)>len(current) or current[:len(previous)]!=previous:
        return None
    return len(previous)

def responses_incremental_body(body, previous_input_count):
    request_input=body.get('input')
    if not isinstance(request_input,list) or previous_input_count>len(request_input):
        return None
    delta=request_input[previous_input_count:]
    delta=[item for item in delta if not isinstance(item,dict) or (item.get('type') not in {'function_call','custom_tool_call'} and not (item.get('type','message')=='message' and item.get('role')=='assistant'))]
    if not delta:
        return None
    return {**body,'input':delta,'tools':[]}

BASE_MESSAGE={'type':'message','role':'user','content':'fix counter.txt and verify'}
CALL={'type':'function_call','call_id':'call-1','name':'write_file','arguments':'{"path":"counter.txt","text":"1"}'}
OUTPUT={'type':'function_call_output','call_id':'call-1','output':'ok'}
TOOLS_A=[{'type':'function','name':'write_file'}]
TOOLS_B=[{'type':'function','name':'shell'}]

def body(*, tools=TOOLS_A, instructions='cwd=/repo', text=None, metadata=None, input=None):
    return {'model':'gpt-5.6-sol','instructions':instructions,'client_metadata':metadata or {'notion_prompt_mode':'engineer'},'input':input or [BASE_MESSAGE], 'tools':tools, 'text':text}

results={}
initial=body(); continued=body(input=[BASE_MESSAGE,CALL,OUTPUT])
prev=pr8_response_input_fingerprints(initial); cur=pr8_response_input_fingerprints(continued)
prefix=input_prefix_length(prev,cur); delta=responses_incremental_body(continued,prefix)
results['unchanged_contract_restart_continues']=(prefix==1)
results['tool_result_only_delta']=(delta is not None and delta['input']==[OUTPUT] and delta['tools']==[])
results['tool_catalog_change_rolls_over']=(input_prefix_length(prev,pr8_response_input_fingerprints(body(tools=TOOLS_B,input=[BASE_MESSAGE,CALL,OUTPUT]))) is None)
results['engineer_context_change_rolls_over']=(input_prefix_length(prev,pr8_response_input_fingerprints(body(instructions='cwd=/other',input=[BASE_MESSAGE,CALL,OUTPUT]))) is None)
results['structured_output_change_rolls_over']=(input_prefix_length(prev,pr8_response_input_fingerprints(body(text={'format':{'type':'json_object'}},input=[BASE_MESSAGE,CALL,OUTPUT]))) is None)
owner_meta={'notion_prompt_mode':'owner','owner_system_prompt':'PRIVATE-A','runtime_context':'cwd=/repo'}
owner_initial=body(instructions='COMPETING-A',metadata=owner_meta)
owner_cont=body(instructions='COMPETING-B',metadata=owner_meta,input=[BASE_MESSAGE,CALL,OUTPUT])
owner_prev=pr8_response_input_fingerprints(owner_initial)
results['owner_ignored_codex_persona_does_not_fragment']=(input_prefix_length(owner_prev,pr8_response_input_fingerprints(owner_cont))==1)
owner_changed=dict(owner_meta); owner_changed['owner_system_prompt']='PRIVATE-B'
results['owner_policy_change_rolls_over']=(input_prefix_length(owner_prev,pr8_response_input_fingerprints(body(instructions='COMPETING-B',metadata=owner_changed,input=[BASE_MESSAGE,CALL,OUTPUT]))) is None)
owner_runtime=dict(owner_meta); owner_runtime['runtime_context']='cwd=/other'
results['owner_runtime_change_rolls_over']=(input_prefix_length(owner_prev,pr8_response_input_fingerprints(body(instructions='COMPETING-B',metadata=owner_runtime,input=[BASE_MESSAGE,CALL,OUTPUT]))) is None)
old_persisted=pr7_response_input_fingerprints(initial)
results['pr7_persisted_state_safe_one_time_rollover_on_pr8']=(input_prefix_length(old_persisted,pr8_response_input_fingerprints(continued)) is None)
lite_tools={'type':'additional_tools','tools':[{'type':'function','name':'write_file'}]}
lite_initial=body(tools=None,input=[lite_tools,BASE_MESSAGE]); lite_cont=body(tools=None,input=[lite_tools,BASE_MESSAGE,CALL,OUTPUT])
lite_prev=pr8_response_input_fingerprints(lite_initial)
results['responses_lite_same_catalog_continues']=(input_prefix_length(lite_prev,pr8_response_input_fingerprints(lite_cont))==2)
lite_changed={'type':'additional_tools','tools':[{'type':'function','name':'shell'}]}
results['responses_lite_catalog_change_rolls_over']=(input_prefix_length(lite_prev,pr8_response_input_fingerprints(body(tools=None,input=[lite_changed,BASE_MESSAGE,CALL,OUTPUT]))) is None)
results['responses_lite_missing_catalog_rolls_over_safe']=(input_prefix_length(lite_prev,pr8_response_input_fingerprints(body(tools=None,input=[BASE_MESSAGE,CALL,OUTPUT]))) is None)
verdict='PASS' if all(results.values()) else 'FAIL'
print(json.dumps({'verdict':verdict,'results':results},indent=2,sort_keys=True))
if verdict!='PASS': raise SystemExit(1)
