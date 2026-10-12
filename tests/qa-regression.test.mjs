import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/autofill/rules.js';
import {createProfile,validateProfile} from '../public/autofill/profile.mjs';
import {encryptProfile,decryptProfile} from '../public/autofill/vault.mjs';
const R=globalThis.JobAutofillRules;
test('QA-01 family and non-applicant contexts cannot select applicant values or remembered mappings',()=>{
 for(const context of ['家庭成员','主要社会关系','亲属信息','父亲信息','母亲信息','配偶资料','监护人','儿子信息','女儿信息','姐姐资料','祖父信息','Family members','Family details','Relatives','Father details','Mother details','Guardian','Next of kin','Spouse','Sibling details','Children information','Brother information','Daughter details','Son name','Husband details','Wife details','Cousin information']){
  const field={id:'f0',label:'姓名',type:'text',safetyContext:context};
  const memory=[{scope:'https://example.invalid/form',signature:R.signature(field),path:'contact.name'}];
  const row=R.planFields([field],{contact:{name:'虚构本人'}},memory,'https://example.invalid/form')[0];
  assert.equal(row.status,'blocked',context);assert.equal(row.selected,false,context);assert.equal(row.path,null,context);
 }
 for(const field of [{label:'姓名',type:'text',context:'申请人资料'},{label:'Full name',type:'text',context:'Applicant details'}])assert.equal(R.inferField(field).path,'contact.name');
 assert.equal(R.inferField({label:'Family name',name:'familyName',autocomplete:'family-name',type:'text'}).path,'contact.familyName');
});
test('QA-02 explicitly supplied optional personal fields round-trip encrypted and old v2 stays readable',async()=>{
 const old=createProfile();for(const key of ['gender','politicalStatus','province','district'])delete old.contact[key];
 const migrated=validateProfile(old);
 for(const key of ['gender','politicalStatus','province','district'])assert.equal(migrated.contact[key],'');
 const supplied={...migrated,contact:{...migrated.contact,gender:'女',politicalStatus:'群众',province:'浙江省',city:'杭州',district:'西湖区'}};
 const envelope=await encryptProfile(supplied,'Fictional-QA-only-2026!');
 assert.equal(JSON.stringify(envelope).includes('群众'),false);
 assert.deepEqual((await decryptProfile(envelope,'Fictional-QA-only-2026!')).contact,supplied.contact);
});
test('QA-02 optional fields map only explicit labels, blank data stays unselected',()=>{
 const p=createProfile();
 for(const [label,path]of [['性别','contact.gender'],['政治面貌','contact.politicalStatus'],['现居省份','contact.province'],['所在区县','contact.district']]){
  const f={label,type:'text'};assert.equal(R.inferField(f).path,path);
  assert.equal(R.planFields([f],p)[0].selected,false);
 }
 assert.equal(R.inferField({label:'籍贯省份',type:'text'}).path,null);
 assert.equal(R.inferField({label:'出生城市',type:'text'}).path,null);
});
test('QA-02 current location is not mapped into explicitly different address contexts',()=>{
 for(const context of ['户籍信息','籍贯','出生地','Place of birth','Registered address']){
  assert.equal(R.inferField({label:'City',context,type:'text'}).path,null,context);
 }
});
test('QA-02 address preview keeps the explicit desired label pending until the parent options load',()=>{
 const fields=[{id:'p',label:'现居省份',type:'select-one',options:[{label:'请选择',value:''},{label:'浙江省',value:'zj'}]},{id:'c',label:'居住城市',type:'select-one',options:[{label:'请选择',value:''}],cascade:{parentId:'p',path:'contact.city'}}];
 const rows=R.planFields(fields,{contact:{province:'浙江省',city:'杭州'}});
 assert.equal(rows[1].selected,true);
 assert.equal(rows[1].value,'杭州');assert.deepEqual(rows[1].deferred,{path:'contact.city'});
 const blank=R.planFields(fields,{contact:{province:'浙江省',city:''}});assert.equal(blank[1].selected,false);
 const other=R.planFields(fields,{contact:{province:'浙江省',city:'杭州',name:'虚构名字'}},[{scope:'x',signature:R.signature(fields[1]),path:'contact.name'}],'x');
 assert.equal(other[1].deferred,undefined);assert.equal(other[1].selected,false);
});
test('preselected address ancestors are verified against the profile without being rewritten',()=>{
 const fields=[{id:'p',label:'现居省份',type:'select-one',hasValue:true,options:[{label:'浙江省',value:'zj'}]},{id:'c',label:'居住城市',type:'select-one',hasValue:false,options:[{label:'请选择',value:''},{label:'杭州',value:'hz'}],cascade:{parentId:'p',path:'contact.city'}}];
 const rows=R.planFields(fields,{contact:{province:'浙江省',city:'杭州'}});
 assert.equal(rows[1].deferred,undefined);assert.equal(rows[1].value,'hz');
 assert.deepEqual(R.requestItems(rows),[{fieldId:'c',value:'hz',overwrite:false,anchors:[{fieldId:'p',value:'zj'}]}]);
 rows[0].selected=true;rows[0].overwrite=true;
 const request=R.requestItems(rows);assert.deepEqual(request[1].deferred,{path:'contact.city'});assert.equal(request[1].value,'杭州');
});
