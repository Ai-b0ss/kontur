'use strict';
const assert = require('assert');

function key(m){
  const n={role:m?.role||null,content:m?.content};
  if(Array.isArray(m?.tool_calls)&&m.tool_calls.length)n.tool_calls=m.tool_calls;
  if(m?.tool_call_id){n.tool_call_id=m.tool_call_id;if(m.name)n.name=m.name;}
  return JSON.stringify(n);
}
function trimCheckpointOverlap(historyTurns,incomingTurns){
  const max=Math.min(historyTurns.length,incomingTurns.length);
  for(let size=max;size>0;size--){
    let ok=true;
    for(let i=0;i<size;i++) if(key(historyTurns[historyTurns.length-size+i])!==key(incomingTurns[i])){ok=false;break;}
    if(ok) return incomingTurns.slice(size);
  }
  return incomingTurns;
}
function hasNewToolResult(previousMessages,nextMessages){
  const counts=new Map();
  for(const m of previousMessages||[]){if(m?.role!=='tool')continue;const k=key(m);counts.set(k,(counts.get(k)||0)+1);}
  for(const m of nextMessages||[]){if(m?.role!=='tool')continue;const k=key(m);const r=counts.get(k)||0;if(r<=0)return true;counts.set(k,r-1);}
  return false;
}
function pending(messages){
  const p=new Map();
  for(const m of messages||[]){
    if(m?.role==='assistant'&&Array.isArray(m.tool_calls)) for(const c of m.tool_calls){if(c?.id)p.set(String(c.id),c);}
    else if(m?.role==='tool'&&m.tool_call_id)p.delete(String(m.tool_call_id));
  }
  return [...p.keys()];
}
function currentRestoreAndPersist(record,incoming){
  const messages=incoming;
  const countNonSystem=(xs)=>xs.filter(m=>m&&m.role!=='system').length;
  const incomingSystems=messages.filter(m=>m?.role==='system');
  const storedSystems=record.history.filter(m=>m?.role==='system');
  const systems=incomingSystems.length?incomingSystems:storedSystems;
  const historyTurns=record.history.filter(m=>m?.role!=='system');
  const incomingTurns=messages.filter(m=>m?.role!=='system');
  const fresh=trimCheckpointOverlap(historyTurns,incomingTurns);
  const merged=[...systems,...historyTurns,...fresh];
  const progressMessages=countNonSystem(messages)>1?messages:merged;
  if(hasNewToolResult(record.history,progressMessages)) record.history=[...progressMessages];
  return countNonSystem(messages)>1?messages:merged;
}
function candidateRestoreAndPersist(record,incoming){
  const messages=incoming;
  const countNonSystem=(xs)=>xs.filter(m=>m&&m.role!=='system').length;
  const incomingSystems=messages.filter(m=>m?.role==='system');
  const storedSystems=record.history.filter(m=>m?.role==='system');
  const systems=incomingSystems.length?incomingSystems:storedSystems;
  const historyTurns=record.history.filter(m=>m?.role!=='system');
  const incomingTurns=messages.filter(m=>m?.role!=='system');
  const fresh=trimCheckpointOverlap(historyTurns,incomingTurns);
  const merged=[...systems,...historyTurns,...fresh];
  if(hasNewToolResult(record.history,merged)) record.history=[...merged];
  return countNonSystem(messages)>1?messages:merged;
}

const system={role:'system',content:'owner prompt'};
const user={role:'user',content:'update both files'};
const accepted={role:'assistant',content:null,tool_calls:[
  {id:'call-A',type:'function',function:{name:'write_file',arguments:'{}'}},
  {id:'call-B',type:'function',function:{name:'append_file',arguments:'{}'}},
]};
const stored=[system,user,accepted];
const truncatedAssistant={role:'assistant',content:null,tool_calls:[
  {id:'call-A',type:'function',function:{name:'write_file',arguments:'{}'}},
]};
const resultA={role:'tool',tool_call_id:'call-A',name:'write_file',content:'ok'};
const incoming=[truncatedAssistant,resultA];

const current={history:structuredClone(stored)};
currentRestoreAndPersist(current,structuredClone(incoming));
const currentPending=pending(current.history);
assert.deepStrictEqual(currentPending,[]);
assert.ok(!current.history.some(m=>m?.role==='system'));

const candidate={history:structuredClone(stored)};
candidateRestoreAndPersist(candidate,structuredClone(incoming));
const candidatePending=pending(candidate.history);
assert.deepStrictEqual(candidatePending,['call-B']);
assert.ok(candidate.history.some(m=>m?.role==='system'&&m.content==='owner prompt'));
assert.ok(candidate.history.some(m=>m?.role==='tool'&&m.tool_call_id==='call-A'));

const full={history:structuredClone(stored)};
candidateRestoreAndPersist(full,[...structuredClone(stored),structuredClone(resultA)]);
assert.deepStrictEqual(pending(full.history),['call-B']);
assert.strictEqual(full.history.filter(m=>m?.role==='assistant').length,1);

console.log(JSON.stringify({
  verdict:'QWEN_TRUNCATED_PARTIAL_TOOL_RESULT_REPRO_AND_CANDIDATE_PASS',
  current:{pending_after_persist:currentPending,stored_system_preserved:false,unsafe_sibling_erased:true},
  candidate:{pending_after_persist:candidatePending,stored_system_preserved:true,matching_result_durable:true},
  full_transcript_regression:{pending_after_persist:pending(full.history),assistant_turns:1},
},null,2));
