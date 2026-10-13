import test from 'node:test';
import assert from 'node:assert/strict';

const nonce='c'.repeat(64),key='zhiyouyinli.profile.encrypted.v2';
async function background(){
 let listener,opened=0,autoOpened=0;const reads=[],writes=[];
 globalThis.chrome={runtime:{id:'fake-beta-extension',getURL:p=>'chrome-extension://fake-beta-extension/'+p,getManifest:()=>({version:'0.4.0'}),openOptionsPage:async()=>{opened++;},onMessage:{addListener:fn=>{listener=fn;}}},action:{openPopup:async()=>{autoOpened++;}},storage:{local:{setAccessLevel:async()=>{},get:async k=>{reads.push(k);return {};},set:async p=>{writes.push(p);}},session:{setAccessLevel:async()=>{},get:async()=>({}),set:async p=>{writes.push(p);}}},tabs:{onRemoved:{addListener:()=>{}}}};
 await import('../extension/background.mjs?ui-test='+crypto.randomUUID());
 return {request:(type,extra={},sender={url:'http://127.0.0.1:47841/',frameId:0,tab:{id:8}})=>new Promise(resolve=>listener({protocol:'job-beta-v1',type,nonce,...extra},sender,resolve)),reads,writes,opened:()=>opened,autoOpened:()=>autoOpened};
}
test('unapproved workbench can open the fixed extension UI without granting access or reading any profile',async()=>{
 const bg=await background();assert.deepEqual(await bg.request('open-profile'),{ok:true,value:{ok:true}});assert.equal(bg.opened(),1);assert.deepEqual(bg.reads,[]);assert.deepEqual(bg.writes,[]);
 const denied=await bg.request('storage:get',{key});assert.equal(denied.ok,false);assert.match(denied.error,/尚未获准/);assert.deepEqual(bg.reads,[]);assert.deepEqual(bg.writes,[]);
 assert.deepEqual(await bg.request('open-profile',{nonce:'d'.repeat(64)}),{ok:true,value:{ok:true}});assert.equal(bg.opened(),2);
});
test('opening profile cannot accept a destination or payload, and stays limited to exact trusted loopback top frames',async()=>{
 const bg=await background();
 for(const extra of [{url:'https://evil.test/'},{tabId:8},{profile:{contact:{name:'不可上传'}}},{key},{value:'payload'},{nonce:'short'}])assert.equal((await bg.request('open-profile',extra)).ok,false,JSON.stringify(extra));
 for(const sender of [{url:'https://evil.test/',frameId:0,tab:{id:8}},{url:'http://127.0.0.1:47831/',frameId:0,tab:{id:8}},{url:'http://127.0.0.1:47841/',frameId:1,tab:{id:8}},{url:'http://127.0.0.1:47841/private',frameId:0,tab:{id:8}}])assert.equal((await bg.request('open-profile',{},sender)).ok,false);
 assert.equal(bg.opened(),0);assert.deepEqual(bg.reads,[]);assert.deepEqual(bg.writes,[]);
});
test('optional connection requests wait for the real toolbar gesture rather than opening an unprivileged popup',async()=>{
 const bg=await background(),reply=await bg.request('link');assert.equal(reply.ok,true);assert.equal(reply.value.connected,false);assert.equal(bg.autoOpened(),0);assert.equal(bg.opened(),0);assert.deepEqual(bg.reads,[]);
 assert.equal(bg.writes.length,1);assert.ok(bg.writes[0].workbenchGrants.every(r=>r.expiresAt===0));assert.equal((await bg.request('storage:get',{key})).ok,false);
});
