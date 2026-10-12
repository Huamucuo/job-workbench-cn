import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
async function model(){const u=new URL('../public/autofill/profile.mjs',import.meta.url);assert.ok(existsSync(u),'统一档案模型尚未实现');return import(u);}
test('profile keeps multiple education and all seven sections, rejects invalid dates',async()=>{
 const m=await model();const p=m.createFictionalProfile();assert.equal(p.schemaVersion,2);assert.equal(p.isFictional,true);
 assert.equal(p.education.length,2);for(const k of ['internships','work','projects','skills','certificates'])assert.ok(p[k].length);
 assert.deepEqual(m.validateProfile(p),p);
 assert.throws(()=>m.validateProfile({...p,education:[{...p.education[0],startDate:'2026-02-30'}]}));
 assert.throws(()=>m.validateProfile({...p,contact:{...p.contact,email:'invalid'}}));
});
test('profile import cannot introduce prototype keys, unsupported versions or unbounded text',async()=>{
 const m=await model();const p=m.createFictionalProfile();
 assert.throws(()=>m.validateProfile({...p,schemaVersion:99}));
 assert.throws(()=>m.validateProfile(JSON.parse('{"schemaVersion":2,"__proto__":{"bad":true}}')));
 assert.throws(()=>m.validateProfile({...p,contact:{...p.contact,name:'a'.repeat(121)}}));
});
test('vault encrypts without cleartext, wrong password and tampering are rejected',async()=>{
 const m=await model();const u=new URL('../public/autofill/vault.mjs',import.meta.url);assert.ok(existsSync(u),'加密存储尚未实现');const v=await import(u);
 const p=m.createFictionalProfile(), pass='fiction-only-2026!';
 const e=await v.encryptProfile(p,pass);assert.equal(JSON.stringify(e).includes(p.contact.name),false);assert.equal(e.kind,'job-workbench-encrypted-profile');
 assert.deepEqual(await v.decryptProfile(e,pass),p);
 await assert.rejects(()=>v.decryptProfile(e,'wrong-password-123'));
 await assert.rejects(()=>v.decryptProfile({...e,ciphertext:'AAAA'},pass));
 await assert.rejects(()=>v.encryptProfile(p,'short'));
});

test('invalid unfinished drafts can be encrypted and recovered but never used as a valid profile',async()=>{
 const m=await model(),v=await import('../public/autofill/vault.mjs');
 const p=m.createFictionalProfile();p.contact.email='incomplete@';p.education[0].startDate='2024-';
 assert.equal(typeof v.encryptDraft,'function');
 const e=await v.encryptDraft(p,'fiction-only-2026!');
 assert.equal(JSON.stringify(e).includes('incomplete@'),false);
 assert.deepEqual(await v.decryptDraft(e,'fiction-only-2026!'),p);
 await assert.rejects(()=>v.decryptProfile(e,'fiction-only-2026!'));
 await assert.rejects(()=>v.decryptDraft(e,'wrong-password-123'));
});
