'use strict';
const assert=require('assert');
function key(m){const n={role:m?.role||null,content:m?.content};if(Array.isArray(m?.tool_calls)&&m.tool_calls.length)n.tool_calls=m.tool_calls;if(m?.tool_call_id){n.tool_call_id=m.tool_call_id;if(m.name)n.name=m.name;}return JSON.stringify(n);}
function trim(history,incoming){for(let size=Math.min(history.length,incoming.length);size>0;size--){let ok=true;for(let i=0;i<size;i++){if(key(history[history.length-size+i])!==key(incoming[i])){ok=false;break;}}if(ok)return incoming.slice(size);}return incoming;}
function merged(record,incoming){const inSys=incoming.filter(m=>m?.role==='system');const storedSys=record.history.filter(m=>m?.role==='system');const sys=inSys.length?inSys:storedSys;const h=record.history.filter(m=>m?.role!=='system');const inc=incoming.filter(m=>m?.role!=='system');return [...sys,...h,...trim(h,inc)];}
function currentRestore(record,incoming){const count=incoming.filter(m=>m?.role!=='system').length;const m=merged(record,incoming);return count>1?incoming:m;}
function pending(messages){const p=new Map();for(const m of messages){if(m?.role==='assistant'&&Array.isArray(m.tool_calls))for(const c of m.tool_calls){if(c?.id)p.set(String(c.id),c);}else if(m?.role==='tool'&&m.tool_call_id)p.delete(String(m.tool_call_id));}return [...p.keys()];}
const stored=[
 {role:'system',content:'owner prompt'},
 {role:'user',content:'update both files and verify'},
 {role:'assistant',content:null,tool_calls:[
  {id:'call-A',type:'function',function:{name:'write_file',arguments:'{}'}},
  {id:'call-B',type:'function',function:{name:'append_file',arguments:'{}'}}
 ]}
];
const record={accountId:'acct-A',chatId:'chat-A',history:structuredClone(stored)};
const incoming=[
 {role:'assistant',content:null,tool_calls:[{id:'call-A',type:'function',function:{name:'write_file',arguments:'{}'}}]},
 {role:'tool',tool_call_id:'call-A',name:'write_file',content:'ok'}
];
const currentFreshPayload=currentRestore(record,structuredClone(incoming));
assert.strictEqual(currentFreshPayload.some(m=>m.role==='system'),false);
assert.strictEqual(currentFreshPayload.some(m=>m.role==='user'),false);
assert.deepStrictEqual(pending(currentFreshPayload),[]);
const candidateFreshPayload=merged(record,structuredClone(incoming));
assert.ok(candidateFreshPayload.some(m=>m.role==='system'&&m.content==='owner prompt'));
assert.ok(candidateFreshPayload.some(m=>m.role==='user'&&m.content==='update both files and verify'));
assert.deepStrictEqual(pending(candidateFreshPayload),['call-B']);
const sameOwnerIncremental=currentRestore(record,structuredClone(incoming));
assert.strictEqual(sameOwnerIncremental.length,2);
console.log(JSON.stringify({verdict:'QWEN_FAILOVER_TRUNCATED_TOOL_RESULT_REBASE_REPRO_AND_CANDIDATE_PASS',current:{fresh_sibling_payload_roles:currentFreshPayload.map(m=>m.role),pending_in_payload:pending(currentFreshPayload),lost_owner_prompt:true,lost_prior_user_context:true},candidate:{fresh_sibling_payload_roles:candidateFreshPayload.map(m=>m.role),pending_in_payload:pending(candidateFreshPayload),owner_prompt_preserved:true,prior_user_context_preserved:true},compatibility:{same_owner_incremental_messages:sameOwnerIncremental.length}},null,2));
