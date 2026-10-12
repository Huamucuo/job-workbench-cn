import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createProfile,createFictionalProfile,validateProfile,validDate} from '../public/autofill/profile.mjs';
async function modules(){
 for(const name of ['import-parser','import-merge'])assert.ok(existsSync(new URL('../public/autofill/'+name+'.mjs',import.meta.url)),'缺少本地简历导入模块 '+name);
 return {...await import('../public/autofill/import-parser.mjs'),...await import('../public/autofill/import-merge.mjs')};
}
const source=(text,id='a')=>({id:id.repeat(64),name:id+'.docx',type:'docx',text,lines:text.split('\n').map((text,i)=>({text,line:i+1,page:1})),warnings:[]});
const resume=`个人简历
姓名：陈明远 | 邮箱：chen@example.com | 手机：18800001111
性别：男 | 政治面貌：群众 | 出生日期：1998年2月3日
教育背景
2016.09 - 2020.06 | 华南测试大学 | 本科 | 信息管理
2020.09 - 2023.06 | 示例研究大学 | 硕士 | 计算机技术
实习经历
2021.06 - 2021.09 | 北方示例公司 | 数据实习生
整理业务数据，编写 SQL 报表。
2022.07 - 2022.10 | 南方示例公司 | 开发实习生
维护内部工具。
工作经历
2023.07 - 至今 | 岩石示例公司 | 软件工程师
职责：开发业务系统。
项目经历
2022.01 - 2022.06 | 地图检索项目 | 开发负责人
实现关键词检索。
2022.08 - 2022.12 | 报表自动化 | 核心开发
优化报表流程。
技能
JavaScript：熟练
SQL：熟练
证书
证书名称：测试资格证 | 颁发机构：示例协会 | 获得时间：2023.06.18
兴趣爱好
周末步行。`;
test('中文简历保留多段经历、原描述、日期和未归类原文',async()=>{
 const {parseDocument}=await modules();const p=parseDocument(source(resume));
 assert.equal(p.contact.find(v=>v.key==='name').value,'陈明远');
 assert.equal(p.contact.find(v=>v.key==='birthDate').value,'1998-02-03');
 for(const section of ['education','internships','projects'])assert.equal(p.records.filter(r=>r.section===section).length,2,section);
 assert.equal(p.records.find(r=>r.section==='education').values.major,'信息管理');
 assert.equal(p.records.find(r=>r.section==='internships').values.description,'整理业务数据，编写 SQL 报表。');
 assert.equal(p.records.find(r=>r.section==='work').values.endDate,'');
 assert.ok(p.unresolved.some(r=>r.text.includes('周末步行')));
 assert.ok(p.records.every(r=>r.evidence.school||r.evidence.organization||r.evidence.name));
});
test('未提供的敏感信息、第三方联系方式、推测英文名绝不补齐',async()=>{
 const {parseDocument}=await modules();const p=parseDocument(source('姓名：李星\n出生地：北京\n年龄：28\n推荐人邮箱：ref@example.com\n紧急联系人电话：18800000000\n毕业时间：2020.06\n项目经历\n2020.01 - 2020.03 | 邮箱系统 | 开发\n维护 support@example.com 邮箱。'));
 for(const k of ['gender','politicalStatus','birthDate','familyName','givenName','email','phone'])assert.equal(p.contact.some(v=>v.key===k),false,k);
});
test('同一文件重复字段保留不同候选而不偷偷选择',async()=>{
 const {parseDocument}=await modules();const p=parseDocument(source('姓名：李星\n邮箱：one@example.com\n邮箱：two@example.com'));
 assert.deepEqual(p.contact.filter(v=>v.key==='email').map(v=>v.value),['one@example.com','two@example.com']);
});
test('多行带标签职责保留全部内容，不把只有年份的时间编造成月日',async()=>{
 const {parseDocument}=await modules();const p=parseDocument(source('工作经历\n2020 - 2021 | 测试公司 | 开发工程师\n职责：维护系统。\n职责：核对数据。'));
 assert.equal(p.records[0].values.description,'维护系统。\n核对数据。');assert.equal(p.records[0].values.startDate,'2020');assert.equal(p.records[0].values.endDate,'2021');
});
test('手动候选缺少经历名称时拒绝保存，不能新增无意义空白记录',async()=>{
 const {parseDocument,createImportPlan,applyImportPlan}=await modules();const base=createProfile(),plan=createImportPlan(base,[parseDocument(source(resume))]);
 const g=plan.records.find(g=>g.section==='education');g.options[0].values.school='';assert.throws(()=>applyImportPlan(base,plan,{confirmed:true}),/名称/);
});
test('职责中的时间范围不能误生成公司或丢掉描述',async()=>{
 const {parseDocument}=await modules();const p=parseDocument(source('工作经历\n2020.01 - 2021.01 | 测试公司 | 开发\n项目从2020.03到2020.06实施\n取得成果。'));
 assert.equal(p.records.length,1);assert.equal(p.records[0].values.organization,'测试公司');assert.equal(p.records[0].values.description,'项目从2020.03到2020.06实施\n取得成果。');
});
test('第三方资料标题阻断后续本人资料提取，直到明确的新章节',async()=>{
 const {parseDocument}=await modules();for(const heading of ['家庭成员','紧急联系人','Emergency Contact']){
 const p=parseDocument(source('姓名：李星\n'+heading+'\n联系电话：18800001111\n性别：女\n政治面貌：群众\n出生日期：1970.02.03\n教育经历\n2020 - 2024 | 示例大学 | 本科 | 软件工程'));
 assert.deepEqual(p.contact.map(c=>c.key),['name']);assert.equal(p.records[0].values.school,'示例大学');}
});
test('中文逗号划分标签，未知标签不混入姓名或性别',async()=>{
 const {parseDocument}=await modules();const p=parseDocument(source('姓名：李星，性别：男，政治面貌：群众，出生日期：1998.02.03'));
 assert.deepEqual(p.contact.map(c=>[c.key,c.value]),[['name','李星'],['gender','男'],['politicalStatus','群众'],['birthDate','1998-02-03']]);
 const q=parseDocument(source('姓名：李星 | 民族：汉族 | 性别：男 | 籍贯：江苏'));assert.deepEqual(q.contact.map(c=>[c.key,c.value]),[['name','李星'],['gender','男']]);assert.ok(q.unresolved.length);
});
test('同公司缺日期的两段不同工作可明确保留为独立经历',async()=>{
 const {parseDocument,createImportPlan,applyImportPlan,appendSeparateRecord}=await modules();
 const base=createProfile(),p=parseDocument(source('工作经历\n公司：示例公司\n职位：数据分析师\n工作描述：制作报表。\n公司：示例公司\n职位：项目经理\n工作描述：协调项目。')),plan=createImportPlan(base,[p]);
 assert.equal(typeof appendSeparateRecord,'function');const g=plan.records[0];g.selected=g.options[0].id;appendSeparateRecord(plan,g);g.selected=g.options[1].id;appendSeparateRecord(plan,g);
 const out=applyImportPlan(base,plan,{confirmed:true});assert.deepEqual(out.work.map(r=>r.title),['数据分析师','项目经理']);
});
test('英文多词姓名和公司名不被未知标签边界截断，模糊无分隔符内容留待核对',async()=>{
 const {parseDocument}=await modules();const p=parseDocument(source('Name: John Smith Age: 26\nWork Experience\nCompany: Example Technology Inc Location: Shanghai'));
 assert.equal(p.contact.find(c=>c.key==='name').value,'John Smith');assert.equal(p.records[0].values.organization,'Example Technology Inc');assert.equal(p.unresolved.length,2);
 const q=parseDocument(source('Name: John Smith Arbitrary Label: unknown'));assert.equal(q.contact.length,0);assert.ok(q.unresolved.length);
 const r=parseDocument(source('Name: John Smith | Arbitrary Label: unknown'));assert.equal(r.contact[0].value,'John Smith');
});
test('已有资料默认保留，重复经历不新增，冲突要显式选择；输入对象保持不变',async()=>{
 const {parseDocument,createImportPlan,applyImportPlan}=await modules();const base=createProfile();base.contact.email='old@example.com';const before=JSON.stringify(base);
 const docs=[parseDocument(source(resume)),parseDocument(source(resume.replace('chen@example.com','other@example.com'),'b'))];
 const plan=createImportPlan(base,docs);const result=applyImportPlan(base,plan,{confirmed:true,identityConfirmed:true});
 assert.equal(JSON.stringify(base),before);assert.equal(result.contact.email,'old@example.com');
 assert.equal(result.education.length,2);assert.equal(result.internships.length,2);assert.equal(result.projects.length,2);
 assert.equal(result.importData.sources.length,2);assert.ok(result.importData.fields.length>10);
 assert.equal(validateProfile(result).education.length,2);
 const repeated=createImportPlan(result,docs),again=applyImportPlan(result,repeated,{confirmed:true,identityConfirmed:true});
 assert.equal(again.education.length,2);assert.equal(again.importData.sources.length,2);
});
test('没有确认或预览后档案已变化时拒绝应用',async()=>{
 const {parseDocument,createImportPlan,applyImportPlan}=await modules();const base=createProfile();const plan=createImportPlan(base,[parseDocument(source(resume))]);
 assert.throws(()=>applyImportPlan(base,plan),/确认/);base.contact.name='changed';assert.throws(()=>applyImportPlan(base,plan,{confirmed:true}),/变化/);
});
test('多个人的简历不能默认合并且冲突姓名不预选',async()=>{
 const {parseDocument,createImportPlan,applyImportPlan}=await modules();const base=createProfile(),docs=[parseDocument(source(resume)),parseDocument(source('姓名：另一人\n邮箱：different@example.com','b'))];
 const plan=createImportPlan(base,docs);assert.equal(plan.identityConflict,true);
 assert.throws(()=>applyImportPlan(base,plan,{confirmed:true}),/身份/);
 const name=plan.contacts.find(c=>c.key==='name');assert.equal(name.selected,'current');
});
test('年份精度保留，错误日历日期拒绝，导入来源加密往返不丢失',async()=>{
 const {parseDocument,createImportPlan,applyImportPlan}=await modules();assert.equal(validDate('2020'),true);assert.equal(validDate('2023-02-29'),false);
 const base=createProfile();const plan=createImportPlan(base,[parseDocument(source(resume))]);const p=applyImportPlan(base,plan,{confirmed:true,identityConfirmed:true});
 const {encryptProfile,decryptProfile}=await import('../public/autofill/vault.mjs');const e=await encryptProfile(p,'resume-test-only-2026!');
 assert.equal(JSON.stringify(e).includes('陈明远'),false);assert.deepEqual(await decryptProfile(e,'resume-test-only-2026!'),p);
 const broken=structuredClone(p);broken.importData.fields[0].path='__proto__.bad';assert.throws(()=>validateProfile(broken));
});
test('明确生日可供共用引擎使用，只有年份时不能填具体日或推断年龄',async()=>{
 await import('../public/autofill/rules.js');const rules=globalThis.JobAutofillRules;
 const field={id:'birthday',label:'出生日期',type:'date',name:'birthday',context:'',hasValue:false};
 assert.equal(rules.inferField(field).path,'contact.birthDate');assert.equal(rules.valueAt({contact:{birthDate:'1999-02-03'}},'contact.birthDate'),'1999-02-03');
 assert.equal(rules.convertValue('1999',field,'contact.birthDate').ok,false);assert.equal(rules.inferField({...field,label:'年龄',name:'age',type:'number'}).path,null);
 assert.equal(rules.inferField({...field,context:'家庭成员'}).status,'blocked');
});
