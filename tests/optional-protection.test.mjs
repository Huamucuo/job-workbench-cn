import test from 'node:test';
import assert from 'node:assert/strict';
import {createFictionalProfile} from '../public/autofill/profile.mjs';
import {encryptProfile,decryptProfile,encryptDraft,decryptDraft} from '../public/autofill/vault.mjs';
import {CanonicalStore,assertKey} from '../extension/bridge-policy.mjs';

// A browser's real storage API is not available in Node. Only that boundary is
// adapted; encryption, envelope validation and profile validation are real.
const data=new Map();
globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
test('new local archive opens without a user password while retaining verified profile data',async()=>{
 data.clear();const profile=createFictionalProfile();
 const sealed=await encryptProfile(profile,null);
 assert.equal(sealed.unlockMode,'device');
 assert(!JSON.stringify(sealed).includes(profile.contact.email));
 assert.deepEqual(await decryptProfile(sealed,''),profile);
 const second=await encryptProfile(profile,null);
 assert.notEqual(second.ciphertext,sealed.ciphertext);
 assert.deepEqual(await decryptProfile(second),profile);
 const draft=await encryptDraft({...profile,contact:{...profile.contact,email:'需要修改'}},null);
 assert.equal((await decryptDraft(draft)).contact.email,'需要修改');
});
test('missing local access material fails visibly and never replaces the saved key or profile',async()=>{
 data.clear();const sealed=await encryptProfile(createFictionalProfile(),null);
 data.clear();await assert.rejects(decryptProfile(sealed,''),/本机.*备份/);
 assert.equal(data.size,0);
});
test('password protected archives remain compatible and require the original password',async()=>{
 const profile=createFictionalProfile(),sealed=await encryptProfile(profile,'Fictional-protection-only!');
 assert.equal(sealed.unlockMode,undefined);
 await assert.rejects(decryptProfile(sealed,''));
 await assert.rejects(decryptProfile(sealed,'Different-password!'));
 assert.deepEqual(await decryptProfile(sealed,'Fictional-protection-only!'),profile);
 const local=await encryptProfile(profile,null);
 assert.deepEqual(await decryptProfile(local,''),profile);
});
test('device access material is stable across concurrent trusted calls and excluded from the webpage storage allowlist',async()=>{
 const records={},store=new CanonicalStore({get:async k=>records[k]??null,setMany:async patch=>Object.assign(records,patch)});
 assert.throws(()=>assertKey('zhiyouyinli.profile.device-access.v1'));
 await assert.rejects(store.devicePassword(false),/本机.*备份/);
 const values=await Promise.all([store.devicePassword(true),store.devicePassword(true)]);
 assert.equal(values[0],values[1]);assert.equal(values[0].length,44);
 assert.equal(await store.devicePassword(false),values[0]);
 const before=structuredClone(records);await assert.rejects(store.devicePassword('yes'));
 assert.deepEqual(records,before);
});
test('unencrypted portable backup validates its complete profile and never accepts unknown wrapper fields',async()=>{
 const {localBackup,readLocalBackup}=await import('../public/autofill/vault.mjs');
 const profile=createFictionalProfile(),backup=localBackup(profile);
 assert.equal(backup.kind,'job-workbench-local-backup');assert.deepEqual(readLocalBackup(backup),profile);
 assert.throws(()=>readLocalBackup({...backup,remote:'https://example.invalid'}));
 assert.throws(()=>readLocalBackup({...backup,profile:{...profile,contact:{...profile.contact,guessedIdentity:'x'}}}));
});
