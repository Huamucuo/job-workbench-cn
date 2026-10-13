import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/autofill/rules.js';
const R=globalThis.JobAutofillRules;
test('Beta sensitive custom fields reject both mapping memory and explicit conversion',()=>{
 for(const label of ['宗教信仰','Religion','Faith','健康状况','Medical history','工会会员','Union','Trade union membership','户籍城市','Hukou city','Household registration','户口所在地','证件号码','籍贯','紧急联系人姓名','家庭成员姓名','同意隐私声明']){
  const f={id:'p',label,type:'custom-select',options:[{label:'林知行',value:'v'}]};
  const row=R.planFields([f],{contact:{name:'林知行'}},[{scope:'local',signature:R.signature(f),path:'contact.name'}],'local')[0];
  assert.equal(row.status,'blocked',label);assert.equal(row.selected,false,label);assert.equal(row.path,null,label);
  assert.equal(R.convertValue('林知行',f,'contact.name').ok,false,label);
 }
 assert.equal(R.inferField({label:'现居城市',type:'text'}).path,'contact.city');
 assert.equal(R.inferField({label:'出生日期',type:'date'}).path,'contact.birthDate');
});
test('Beta academic degree, language fields and self introduction retain their own explicit paths',()=>{
 for(const [f,want] of [[{label:'学位',group:'education',index:1},'education.1.academicDegree'],[{label:'学历',group:'education',index:1},'education.1.degree'],[{label:'语种',group:'languages',index:0},'languages.0.name'],[{label:'语言水平',group:'languages',index:0},'languages.0.level'],[{label:'语言证书',group:'languages',index:0},'languages.0.certificate'],[{label:'自我介绍'},'about.introduction']]){
  assert.equal(R.inferField({...f,type:'text'}).path,want);
  assert.equal(R.validPath.test(want),true);
 }
});
test('Beta highest education needs a record choice on every scan and cannot remember the first record',()=>{
 const f={id:'degree',label:'最高学历',context:'教育信息',group:'education',index:0,type:'select-one',options:[{label:'本科',value:'b'},{label:'硕士',value:'m'}]};
 const p={education:[{degree:'本科'},{degree:'硕士'}]};
 const rows=R.planFields([f],p,[{scope:'local',signature:R.signature(f),path:'education.0.degree'}],'local');
 assert.equal(rows[0].path,null);assert.equal(rows[0].selected,false);assert.equal(rows[0].status,'choice');
 assert.equal(rows[0].choiceKey,'degree');
});
test('Beta custom choice conversion requires one exact scoped enabled option',()=>{
 const f={type:'custom-select',options:[{label:'Bachelor',value:'b'},{label:'Master',value:'m'}]};
 assert.equal(R.convertValue('本科',f,'education.0.degree').value,'b');
 assert.equal(R.convertValue('硕',f,'education.0.degree').ok,false);
 assert.equal(R.convertValue('本科',{...f,options:[{label:'Bachelor',value:'b'},{label:'Bachelor',value:'b2'}]},'education.0.degree').ok,false);
 assert.equal(R.convertValue('本科',{...f,options:[{label:'Bachelor',value:'b',disabled:true}]},'education.0.degree').ok,false);
});
test('Beta date precision rejects invalid dates rather than manufacturing or accepting them',()=>{
 assert.equal(R.convertValue('2020-02-31',{type:'date'}).ok,false);
 assert.equal(R.convertValue('2020-13',{type:'month'}).ok,false);
 assert.equal(R.convertValue('2020',{type:'month'}).ok,false);
 assert.equal(R.convertValue('2020-02',{type:'date'}).ok,false);
 assert.equal(R.convertValue('2020-02-29',{type:'date'}).value,'2020-02-29');
 assert.equal(R.convertValue('2020-02-29',{type:'month'}).value,'2020-02');
});
