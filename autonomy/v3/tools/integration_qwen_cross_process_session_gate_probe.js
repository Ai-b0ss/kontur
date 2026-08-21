'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');
const assert=require('assert');
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

const CHILD=`
'use strict';
const fs=require('fs');
const [dir,label,mode]=process.argv.slice(1);
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
(async()=>{
  const ready=dir+'/ready-'+label; const start=dir+'/start'; const state=dir+'/state.json'; const calls=dir+'/provider-calls';
  fs.writeFileSync(ready,'1'); while(!fs.existsSync(start)) await sleep(5);
  if(mode==='current'){
    const s=JSON.parse(fs.readFileSync(state,'utf8'));
    if(s.pending) return;
    fs.appendFileSync(calls,label+'\\n');
    await sleep(label==='A'?30:50);
    fs.writeFileSync(state,JSON.stringify({pending:true,acceptedBy:label}));
    return;
  }
  const lock=dir+'/session.lock';
  while(true){try{fs.mkdirSync(lock);break;}catch(e){if(e.code!=='EEXIST')throw e;await sleep(5);}}
  try{
    const s=JSON.parse(fs.readFileSync(state,'utf8'));
    if(s.pending) return;
    fs.appendFileSync(calls,label+'\\n');
    await sleep(label==='A'?30:50);
    fs.writeFileSync(state,JSON.stringify({pending:true,acceptedBy:label}));
  }finally{fs.rmdirSync(lock);}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
`;

async function run(mode){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qwen-xproc-session-gate-'));
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({pending:false})); fs.writeFileSync(path.join(dir,'provider-calls'),'');
  const ps=['A','B'].map(label=>spawn(process.execPath,['-e',CHILD,dir,label,mode],{stdio:['ignore','ignore','pipe']}));
  while(!['A','B'].every(x=>fs.existsSync(path.join(dir,'ready-'+x)))) await sleep(5);
  fs.writeFileSync(path.join(dir,'start'),'1');
  await Promise.all(ps.map(p=>new Promise((resolve,reject)=>{let e='';p.stderr.on('data',d=>e+=d);p.on('exit',c=>c===0?resolve():reject(new Error(e||String(c))))})));
  const calls=fs.readFileSync(path.join(dir,'provider-calls'),'utf8').trim().split(/\n/).filter(Boolean);
  const state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));
  fs.rmSync(dir,{recursive:true,force:true}); return {calls,state};
}
(async()=>{
  const current=await run('current'); const candidate=await run('candidate');
  assert.strictEqual(current.calls.length,2,'two processes both reached provider under process-local gates');
  assert.strictEqual(candidate.calls.length,1,'shared session lease must admit only one provider request before pending state exists');
  console.log(JSON.stringify({verdict:'QWEN_CROSS_PROCESS_SESSION_GATE_RESTART_GAP_REPRODUCED_CANDIDATE_PASS',current:{provider_calls:current.calls.length,callers:current.calls,final_state:current.state},candidate:{provider_calls:candidate.calls.length,callers:candidate.calls,final_state:candidate.state,second_process_rechecks_pending:true}},null,2));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
