import test from 'node:test';
import assert from 'node:assert/strict';
import * as importing from '../public/autofill/import-ui.mjs';
import {createProfile,validateProfile} from '../public/autofill/profile.mjs';
import {parseDocument} from '../public/autofill/import-parser.mjs';
import {createImportPlan} from '../public/autofill/import-merge.mjs';
import {encryptProfile,decryptProfile} from '../public/autofill/vault.mjs';

const document=(text,letter='a')=>({id:letter.repeat(64),name:'fiction-confirm.docx',type:'docx',text,lines:text.split('\n').map((text,index)=>({text,line:index+1,page:1})),warnings:[]});
const fixture=(text='姓名：虚构验收人\n电子邮箱：fiction@example.com')=>{const base=createProfile();return {base,plan:createImportPlan(base,[parseDocument(document(text))])};};
const run=args=>{assert.equal(typeof importing.applyReviewedImport,'function');return importing.applyReviewedImport(args);};

test('one reviewed import encrypts and commits the accepted candidate without a second save action',async()=>{
 const {base,plan}=fixture();let draft=base,effective=null;
 const result=await run({base,currentDraft:draft,plan,confirmed:true,applyDraft:next=>{draft=next;},saveDraft:async()=>{effective=await encryptProfile(draft,'one-confirm-fiction-2026!');return true;}});
 assert.equal(result.contact.name,'虚构验收人');assert.equal(draft.contact.email,'fiction@example.com');
 assert.equal((await decryptProfile(effective,'one-confirm-fiction-2026!')).contact.name,'虚构验收人');
 assert.equal(JSON.stringify(effective).includes('虚构验收人'),false);
});

test('missing review or unresolved identity confirmation never applies or commits imported data',async()=>{
 const {base,plan}=fixture();let draft=base,effective=base;
 const callbacks={applyDraft:next=>{draft=next;},saveDraft:async()=>{effective=draft;return true;}};
 await assert.rejects(()=>run({base,currentDraft:draft,plan,...callbacks}),/确认/);
 assert.equal(draft,base);assert.equal(effective,base);
 const conflict=createImportPlan(base,[parseDocument(document('姓名：虚构甲')),parseDocument(document('姓名：虚构乙','b'))]);
 await assert.rejects(()=>run({base,currentDraft:draft,plan:conflict,confirmed:true,...callbacks}),/身份/);
 assert.equal(draft,base);assert.equal(effective,base);
});

test('invalid incomplete email blocks the combined action before replacing even the draft',async()=>{
 const {base,plan}=fixture('姓名：虚构验收人\n电子邮箱：unfinished@');let draft=base,effective=base;
 await assert.rejects(()=>run({base,currentDraft:draft,plan,confirmed:true,applyDraft:next=>{draft=next;},saveDraft:async()=>{effective=draft;return true;}}),/邮箱/);
 assert.equal(draft,base);assert.equal(effective,base);
});

test('a failed CAS keeps the imported draft and the old valid encrypted profile intact',async()=>{
 const {base,plan}=fixture();let draft=base;const old=await encryptProfile(base,'one-confirm-fiction-2026!');let effective=old;
 await assert.rejects(()=>run({base,currentDraft:draft,plan,confirmed:true,applyDraft:next=>{draft=next;},saveDraft:async()=>{throw new Error('另一窗口已保存，未覆盖');}}),/另一窗口/);
 assert.equal(draft.contact.name,'虚构验收人');assert.equal(draft.importData.sources.length,1);
 assert.equal(effective.ciphertext,old.ciphertext);assert.equal((await decryptProfile(effective,'one-confirm-fiction-2026!')).contact.name,'');
});

test('secondary draft-only action preserves the valid profile and needs later explicit save',async()=>{
 const {base,plan}=fixture();let draft=base,effective=base;
 await run({base,currentDraft:draft,plan,confirmed:true,mode:'draft',applyDraft:next=>{draft=next;},saveDraft:async()=>{effective=draft;return true;}});
 assert.equal(draft.contact.name,'虚构验收人');assert.equal(effective.contact.name,'');assert.equal(effective,base);
});

test('changing the draft while the preview is open rejects the combined action instead of overwriting it',async()=>{
 const {base,plan}=fixture(),changed=structuredClone(base);changed.contact.city='已编辑的虚构城市';let draft=changed,effective=base;
 await assert.rejects(()=>run({base,currentDraft:draft,plan,confirmed:true,applyDraft:next=>{draft=next;},saveDraft:async()=>{effective=draft;return true;}}),/变化/);
 assert.equal(draft.contact.city,'已编辑的虚构城市');assert.equal(effective,base);
});

test('a retry can save its unchanged imported draft but cannot erase a later manual edit',async()=>{
 const {base,plan}=fixture();let draft=base,snapshot;
 const applyDraft=next=>{draft=next;snapshot=JSON.stringify(next);};
 await assert.rejects(()=>run({base,currentDraft:draft,plan,confirmed:true,applyDraft,saveDraft:async()=>{throw new Error('连接失效');}}),/连接失效/);
 const retried=await run({base,currentDraft:draft,previousApplied:snapshot,plan,confirmed:true,applyDraft,saveDraft:async()=>{validateProfile(draft);return true;}});
 assert.equal(retried.contact.email,'fiction@example.com');
 draft.contact.city='保留手动补充';
 await assert.rejects(()=>run({base,currentDraft:draft,previousApplied:snapshot,plan,confirmed:true,applyDraft,saveDraft:async()=>true}),/变化/);
 assert.equal(draft.contact.city,'保留手动补充');
});
