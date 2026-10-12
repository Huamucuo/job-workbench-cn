// Executes the actual trusted controller with deferred API adapters. These
// regression tests are separate from actual MV3/sidePanel browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SessionScope} from '../extension/session-policy.mjs';
const source=(await readFile(new URL('../extension/sidepanel.mjs',import.meta.url),'utf8')).replace(/^import .+;\r?\n/gm,'');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const flush=()=>new Promise(r=>setImmediate(r));
async function environment({requestAge=0,fieldCount=0}={}){
 const nodes=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{value:'fictional-only-password',hidden:false,disabled:false,textContent:'',children:[],dataset:{},classList:{toggle(){}},listeners:{},replaceChildren(){this.children=[]},addEventListener(t,f){this.listeners[t]=f}});return nodes.get(s)};
 let envelope={ciphertext:'OLD'},changeListener,tabGate=null,pageContext='sha256:'+'a'.repeat(64),clock=Date.now(),scanCalls=0;
 class ClockDate extends Date{static now(){return clock}}
 const decode=deferred(),target={requestId:'one',tabId:7,windowId:3,origin:'https://careers.test',path:'/apply',requestedAt:clock-requestAge,expiresAt:clock+1800000-requestAge};
 const events={};const document={querySelector:node,addEventListener(){}},window={addEventListener(type,handler){events[type]=handler}};
 const chrome={storage:{session:{get:async()=>({applicationTarget:target}),remove:async()=>{}},onChanged:{addListener(f){changeListener=f}}},tabs:{get:async()=>{if(tabGate)await tabGate.promise;return {id:7,url:'https://careers.test/apply'}},query:async()=>[{id:7}],onUpdated:{addListener(){}},onRemoved:{addListener(){}},onActivated:{addListener(){}}},scripting:{executeScript:async args=>args.files?[]:[{frameId:0,documentId:'doc',result:{ok:true,data:args.args[0]==='scan'?{scanId:'fixture-scan-'+scanCalls,expiresAt:clock+120000,fields:[],url:'https://careers.test/apply'}:{contextKey:pageContext,fingerprint:'fp',fieldCount,url:'https://careers.test/apply'}}}]},runtime:{openOptionsPage(){}},sidePanel:{}};
 const compile=new Function('storage','VAULT_KEY','decryptProfile','materializeProfile','mountPanel','SessionScope','TARGET_KEY','chrome','document','window','setInterval','Date','return (async()=>{'+source+';return {state:()=>({profile,revision,scope,epoch,target}),boundary,tick};})()');
 const controller=await compile({get:async()=>envelope},'vault',()=>decode.promise,p=>p,async(_,{transport})=>({scan:async()=>{scanCalls++;await transport.scan()},destroy(){},isBusy:()=>false,invalidate(){}}),SessionScope,'applicationTarget',chrome,document,window,()=>0,ClockDate);
 return {...controller,node,decode,advance:ms=>{clock+=ms},getScanCalls:()=>scanCalls,start:()=>node('#session-unlock').listeners.click(),lock:()=>node('#session-lock').listeners.click(),end:()=>node('#session-end').listeners.click(),close:()=>events.pagehide(),setContext:key=>{pageContext=key},save:()=>{envelope={ciphertext:'NEW'};changeListener({vault:{newValue:envelope}},'local')},adopt:()=>changeListener({applicationTarget:{newValue:{...target,requestId:'two'}}},'session'),gate:()=>{tabGate=deferred();return tabGate}};
}
for(const [name,action] of [
 ['Lock',e=>e.lock()],['End',e=>e.end()],['new target',e=>e.adopt()],['canonical save',e=>e.save()],['panel close',e=>e.close()],
])test(name+' during decrypt cannot revive old plaintext',async()=>{
 const e=await environment(),pending=e.start();await flush();await action(e);e.decode.resolve({activeVariantId:'fictional',contact:{name:'PRIVATE-FICTIONAL'}});await pending;
 assert.equal(e.state().profile,null);assert.equal(e.node('#session-gate').hidden,false);
});
test('late re-unlock starts fresh idle interval but retains original absolute deadline',async()=>{
 const e=await environment({requestAge:360000}),pending=e.start();await flush();e.decode.resolve({contact:{name:'PRIVATE-FICTIONAL'}});await pending;
 assert.ok(e.state().profile);assert.equal(e.node('#session-gate').hidden,true);
 const now=Date.now();assert.equal(e.state().scope.inspect({tabId:7,activeTabId:7,url:'https://careers.test/apply',contextKey:'key',now:now+1440001}).reason,'session-expired');
});
test('lock during awaited tab boundary cannot authorize old operation',async()=>{
 const e=await environment(),pending=e.start();await flush();e.decode.resolve({contact:{name:'PRIVATE-FICTIONAL'}});await pending;
 const gate=e.gate(),check=e.boundary();await flush();e.lock();gate.resolve();await assert.rejects(check,/旧操作|变化/);assert.equal(e.state().profile,null);
});
async function openFixture(e){const pending=e.start();await flush();e.decode.resolve({contact:{name:'PRIVATE-FICTIONAL'}});await pending;assert.ok(e.state().profile);}
const keyA='sha256:'+'a'.repeat(64),keyB='sha256:'+'b'.repeat(64);
const decision=(e,key)=>e.state().scope.inspect({tabId:7,activeTabId:7,url:'https://careers.test/apply',contextKey:key,now:Date.now()});
test('same request cannot change known application after manual lock and re-unlock',async()=>{
 const e=await environment();await openFixture(e);e.lock();e.setContext(keyB);await e.start();
 assert.equal(decision(e,keyB).allowed,false);assert.equal(decision(e,keyB).reason,'context-changed');assert.match(e.node('#session-status').textContent,/不同岗位|不同.*申请/);
});
test('same application resumes after re-unlock and unknown steps retain its boundary',async()=>{
 const e=await environment();await openFixture(e);e.lock();e.setContext('');await e.start();
 assert.equal(decision(e,keyA).allowed,true);assert.equal(decision(e,keyB).allowed,false);
 e.lock();e.setContext(keyA);await e.start();assert.equal(decision(e,keyA).allowed,true);
});
test('End plus genuinely new toolbar request can bind a different application',async()=>{
 const e=await environment();await openFixture(e);await e.end();e.adopt();e.setContext(keyB);await e.start();
 assert.equal(decision(e,keyB).allowed,true);assert.equal(decision(e,keyA).allowed,false);
});
test('unchanged page preview expires then automatically rescans without another user click',async()=>{
 const e=await environment({fieldCount:1});await openFixture(e);e.advance(800);await e.tick();assert.equal(e.getScanCalls(),1);
 e.advance(120001);await e.tick();assert.equal(e.getScanCalls(),1);e.advance(800);await e.tick();assert.equal(e.getScanCalls(),2,'pending rescan must run even when page fingerprint is unchanged');
 e.advance(120001);await e.tick();e.advance(800);await e.tick();assert.equal(e.getScanCalls(),3,'next expiration must also refresh');
});
