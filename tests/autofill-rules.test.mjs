import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
async function rules(){const u=new URL('../public/autofill/rules.js',import.meta.url);assert.ok(existsSync(u),'字段映射规则尚未实现');await import(u);return globalThis.JobAutofillRules;}
test('Chinese and English contact aliases map without guessing names from unrelated groups',async()=>{
 const r=await rules();
 assert.equal(r.inferField({label:'电子邮箱',type:'email'}).path,'contact.email');
 assert.equal(r.inferField({label:'Full name',type:'text'}).path,'contact.name');
 assert.equal(r.inferField({label:'Name',context:'紧急联系人',type:'text'}).status,'blocked');
 assert.equal(r.inferField({label:'编号',type:'text'}).path,null);
});
test('repeated education and work retain group indices and ambiguous dates stay unmapped',async()=>{
 const r=await rules();
 assert.equal(r.inferField({label:'院校名称',group:'education',index:1,type:'text'}).path,'education.1.school');
 assert.equal(r.inferField({label:'Start date',group:'work',index:1,type:'month'}).path,'work.1.startDate');
 assert.equal(r.inferField({label:'Start date',type:'text'}).path,null);
});
test('protected fields cannot be mapped, ambiguous options and invented date precision are rejected',async()=>{
 const r=await rules();
 for(const f of [{label:'验证码',type:'text'},{label:'同意隐私政策',type:'checkbox'},{label:'Password',type:'password'},{label:'身份证号码',type:'text'},{label:'上传简历',type:'file'}])assert.equal(r.inferField(f).status,'blocked');
 assert.equal(r.convertValue('2020-09',{type:'date'}).ok,false);
 assert.equal(r.convertValue('2020-09-15',{type:'month'}).value,'2020-09');
 assert.equal(r.convertValue('本科',{type:'select-one',options:[{label:'Bachelor',value:'b'},{label:'Master',value:'m'}]},'education.0.degree').value,'b');
 assert.equal(r.convertValue('本科',{type:'select-one',options:[{label:'Bachelor',value:'a'},{label:'Bachelor',value:'b'}]},'education.0.degree').ok,false);
});
test('mapping memories are origin and path bound and cannot override blocked fields',async()=>{
 const r=await rules();const f={id:'f1',label:'备用叫法',type:'text',name:'x',group:null,index:0};const p={contact:{email:'fictitious@example.com'}};
 const memory=[{scope:'https://a.example/apply',signature:r.signature(f),path:'contact.email'}];
 assert.equal(r.planFields([f],p,memory,'https://a.example/apply')[0].path,'contact.email');
 assert.equal(r.planFields([f],p,memory,'https://b.example/apply')[0].status,'unmapped');
 const blocked={...f,label:'验证码'};const bypass=[{...memory[0],signature:r.signature(blocked)}];
 assert.equal(r.planFields([blocked],p,bypass,'https://a.example/apply')[0].status,'blocked');
});
