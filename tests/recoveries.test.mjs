import test from 'node:test';
import assert from 'node:assert/strict';
import {createFictionalProfile} from '../public/autofill/profile.mjs';
import {encryptDraft} from '../public/autofill/vault.mjs';
import {readRecoveries,addRecovery,removeRecovered} from '../public/autofill/recoveries.mjs';
test('separate windows preserve encrypted recoveries and only clean up the recovered revision',async()=>{
 const e=await encryptDraft(createFictionalProfile(),'fiction-only-2026!'),a={id:'window-a',createdAt:'2026-10-10',envelope:e},b={...a,id:'window-b'};
 const both=addRecovery(addRecovery(null,a),b);
 assert.equal(both.length,2);assert.equal(removeRecovered(both,null).length,2);
 assert.deepEqual(removeRecovered(both,a).map(r=>r.id),['window-b']);
 assert.equal(removeRecovered(both,{...a,envelope:{...e,ciphertext:'changed'}}).length,2);
 assert.throws(()=>addRecovery(both,a));
 assert.equal(readRecoveries(e)[0].id,'legacy');
 assert.throws(()=>addRecovery(Array.from({length:20},(_,i)=>({...a,id:String(i)})),b));
});
