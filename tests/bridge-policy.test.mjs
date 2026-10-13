import test from 'node:test';
import assert from 'node:assert/strict';
const api=()=>import('../extension/bridge-policy.mjs');
const sender=(url='http://127.0.0.1:47841/profile.html',frameId=0)=>({url,frameId,tab:{id:7}});
const nonce='a'.repeat(64),key='zhiyouyinli.profile.encrypted.v2';
const envelope={kind:'job-workbench-encrypted-profile',version:1,algorithm:'AES-GCM-256',kdf:'PBKDF2-SHA256',iterations:600000,salt:'AAAAAAAAAAAAAAAAAAAAAA==',iv:'AAAAAAAAAAAAAAAA',ciphertext:'AAAAAAAAAAAAAAAAAAAAAA=='};
test('bridge is limited to approved exact loopback origin, paths and top frame',async()=>{const p=await api();assert.ok(p.isTrustedWorkbenchSender(sender()));for(const u of ['https://evil.test/profile.html','http://localhost:47841/profile.html','http://127.0.0.1:47831/profile.html','http://127.0.0.1:47841/private','http://127.0.0.1.evil.test:47841/profile.html'])assert.equal(p.isTrustedWorkbenchSender(sender(u)),false,u);assert.equal(p.isTrustedWorkbenchSender(sender(undefined,1)),false);});
test('installed presence is not permission; grants bind nonce/tab and expire',async()=>{const {GrantRegistry}=await api();let now=100;const g=new GrantRegistry(()=>now);g.register(sender(),nonce);assert.throws(()=>g.authorize(sender(),nonce));g.approve(7,nonce);assert.doesNotThrow(()=>g.authorize(sender(),nonce));assert.throws(()=>g.authorize({...sender(),tab:{id:8}},nonce));assert.throws(()=>g.authorize(sender(),'b'.repeat(64)));now+=30*60*1000+1;assert.throws(()=>g.authorize(sender(),nonce));});
test('a fresh document nonce cannot inherit an earlier approved grant',async()=>{const {GrantRegistry}=await api();const g=new GrantRegistry();g.register(sender(),nonce);g.approve(7,nonce);g.register(sender(),'b'.repeat(64));assert.throws(()=>g.authorize(sender(),'b'.repeat(64)));});
test('bridge rejects arbitrary storage keys, plaintext resumes and prototype packets',async()=>{const {assertStoredValue}=await api();assert.doesNotThrow(()=>assertStoredValue(key,envelope));assert.throws(()=>assertStoredValue('password','secret'));assert.throws(()=>assertStoredValue(key,{contact:{name:'私有姓名'}}));assert.throws(()=>assertStoredValue(key,{...envelope,extra:'unknown'}));assert.throws(()=>assertStoredValue('zhiyouyinli.autofill.mapping.v1',[{scope:'x',signature:'y',path:'__proto__.name'}]));});
test('canonical commit CAS rejects the stale writer and retains previous ciphertext',async()=>{const {CanonicalStore}=await api();const data={[key]:envelope},store=new CanonicalStore({get:async k=>data[k]??null,setMany:async patch=>Object.assign(data,patch)});const first={...envelope,ciphertext:'AQEBAQEBAQEBAQEBAQEBAQ=='},second={...envelope,ciphertext:'AgICAgICAgICAgICAgICAg=='};const results=await Promise.allSettled([store.commit({expectedCiphertext:envelope.ciphertext,next:first}),store.commit({expectedCiphertext:envelope.ciphertext,next:second})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(data[key].ciphertext,first.ciphertext);assert.deepEqual(data[key+'.previous'],envelope);});
test('shared workbench and extension append recoveries atomically without losing either draft',async()=>{
 const {CanonicalStore}=await api(),data={[key]:envelope},store=new CanonicalStore({get:async k=>data[k]??null,setMany:async patch=>Object.assign(data,patch)});
 const a={id:'extension-unsaved',createdAt:'2026-10-12T13:00:00Z',envelope:{...envelope,kind:'job-workbench-encrypted-draft'}},b={...a,id:'workbench-unsaved',envelope:{...a.envelope,ciphertext:'AQEBAQEBAQEBAQEBAQEBAQ=='}};
 await Promise.all([store.addRecovery({record:a}),store.addRecovery({record:b})]);
 assert.deepEqual(data[key+'.draft'].map(r=>r.id).sort(),[a.id,b.id].sort());assert.deepEqual(data[key],envelope);
 const c={...b,id:'workbench-revised',envelope:{...b.envelope,ciphertext:'AgICAgICAgICAgICAgICAg=='}};
 await store.addRecovery({record:c,recovered:b});assert.deepEqual(data[key+'.draft'].map(r=>r.id).sort(),[a.id,c.id].sort());
 await assert.rejects(store.addRecovery({record:c}));assert.equal(data[key+'.draft'].length,2);
 await store.commit({expectedCiphertext:envelope.ciphertext,next:{...envelope,ciphertext:c.envelope.ciphertext},recovered:c});assert.deepEqual(data[key+'.draft'].map(r=>r.id),[a.id]);
 assert.throws(()=>store.set(key+'.draft',[]));
});
test('canonical recovery cleanup also supports an inherited legacy encrypted draft',async()=>{
 const {CanonicalStore}=await api(),legacy={...envelope,kind:'job-workbench-encrypted-draft'},data={[key]:envelope,[key+'.draft']:legacy},store=new CanonicalStore({get:async k=>data[k]??null,setMany:async patch=>Object.assign(data,patch)});
 await store.commit({expectedCiphertext:envelope.ciphertext,next:{...envelope,ciphertext:'AQEBAQEBAQEBAQEBAQEBAQ=='},recovered:{id:'legacy',createdAt:'',envelope:legacy}});assert.deepEqual(data[key+'.draft'],[]);
});
