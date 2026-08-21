'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const assert = require('assert');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function atomicWrite(file, value, suffix) {
  const tmp = `${file}.tmp-${process.pid}-${suffix}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

const CHILD = `
'use strict';
const fs=require('fs');
const [file,ready,go,key,mode]=process.argv.slice(1);
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function atomicWrite(file,value,suffix){const tmp=file+'.tmp-'+process.pid+'-'+suffix;fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file);}
(async()=>{
  const stale=JSON.parse(fs.readFileSync(file,'utf8'));
  fs.writeFileSync(ready,String(process.pid));
  while(!fs.existsSync(go)) await sleep(5);
  if(mode==='current'){
    stale.sessions[key]={chatId:'chat-'+key,accountId:'acct-'+key,history:[{role:'assistant',tool_calls:[{id:'call-'+key,function:{name:'write_file'}}]}]};
    await sleep(key==='A'?10:80);
    atomicWrite(file,stale,key);
    return;
  }
  const lock=file+'.lock';
  while(true){
    try{fs.mkdirSync(lock);break;}catch(e){if(e.code!=='EEXIST')throw e;await sleep(5);}
  }
  try{
    const fresh=JSON.parse(fs.readFileSync(file,'utf8'));
    fresh.sessions[key]={chatId:'chat-'+key,accountId:'acct-'+key,history:[{role:'assistant',tool_calls:[{id:'call-'+key,function:{name:'write_file'}}]}]};
    await sleep(key==='A'?10:80);
    atomicWrite(file,fresh,key);
  }finally{fs.rmdirSync(lock);}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
`;

async function runPair(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `qwen-session-xproc-${mode}-`));
  const file = path.join(dir, 'opencode-sessions.json');
  atomicWrite(file, { sessions: {
    A: { chatId: 'old-A', accountId: 'acct-A', history: [{ role:'assistant', content:'old-A' }] },
    B: { chatId: 'old-B', accountId: 'acct-B', history: [{ role:'assistant', content:'old-B' }] },
  } }, 'seed');
  const readyA=path.join(dir,'ready-A'), readyB=path.join(dir,'ready-B'), go=path.join(dir,'go');
  const spawnChild=(key,ready)=>spawn(process.execPath,['-e',CHILD,file,ready,go,key,mode],{stdio:['ignore','pipe','pipe']});
  const a=spawnChild('A',readyA), b=spawnChild('B',readyB);
  while(!(fs.existsSync(readyA)&&fs.existsSync(readyB))) await sleep(5);
  fs.writeFileSync(go,'go');
  const wait=(p)=>new Promise((resolve,reject)=>{let err='';p.stderr.on('data',d=>err+=d);p.on('exit',c=>c===0?resolve():reject(new Error(err||`exit ${c}`)));});
  await Promise.all([wait(a),wait(b)]);
  const final=read(file).sessions;
  fs.rmSync(dir,{recursive:true,force:true});
  return final;
}

(async()=>{
  const current=await runPair('current');
  const candidate=await runPair('candidate');
  const currentA=current.A?.history?.[0]?.tool_calls?.[0]?.id || null;
  const currentB=current.B?.history?.[0]?.tool_calls?.[0]?.id || null;
  const candidateA=candidate.A?.history?.[0]?.tool_calls?.[0]?.id || null;
  const candidateB=candidate.B?.history?.[0]?.tool_calls?.[0]?.id || null;
  assert.strictEqual(currentA, null);
  assert.strictEqual(currentB, 'call-B');
  assert.strictEqual(candidateA, 'call-A');
  assert.strictEqual(candidateB, 'call-B');
  console.log(JSON.stringify({
    verdict:'QWEN_SESSION_STORE_CROSS_PROCESS_LOST_UPDATE_REPRODUCED_CANDIDATE_PASS',
    current:{A_pending_call:currentA,B_pending_call:currentB,A_new_state_lost:currentA===null},
    candidate:{A_pending_call:candidateA,B_pending_call:candidateB,both_preserved:true},
  },null,2));
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
