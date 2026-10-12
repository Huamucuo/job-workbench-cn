import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../public/autofill/profile.mjs';
import {parseDocument} from '../public/autofill/import-parser.mjs';
import {createImportPlan,applyImportPlan} from '../public/autofill/import-merge.mjs';
import {encryptProfile,decryptProfile} from '../public/autofill/vault.mjs';

const document = (text,letter='c') => ({id:letter.repeat(64),name:'fiction-beta.docx',type:'docx',text,lines:text.split('\n').map((text,index)=>({text,line:index+1,page:1})),warnings:[]});
const file = (bytes,name='虚构材料.pdf',type='application/pdf') => new File([bytes],name,{type});

test('legacy v2 stays readable with all Beta fields absent and without inferred academic degree',()=>{
 const old=model.createFictionalProfile();
 for(const key of ['languages','about','attachments','variants','activeVariantId'])delete old[key];
 for(const row of old.education)delete row.academicDegree;
 const checked=model.validateProfile(old);
 assert.equal(Object.hasOwn(checked,'languages'),false);
 assert.equal(Object.hasOwn(checked,'about'),false);
 assert.equal(Object.hasOwn(checked.education[0],'academicDegree'),false);
 assert.equal(checked.education[0].degree,'本科');
 assert.equal(typeof model.materializeProfile,'function');
 assert.deepEqual(model.materializeProfile(old),checked);
});

test('academic degree, language records and self introduction validate independently',()=>{
 const profile=model.createFictionalProfile();
 profile.education[0].academicDegree='工学学士';
 profile.languages=[{id:'english-1',name:'英语',level:'熟练',certificate:'CET-6'},{id:'japanese-1',name:'日语',level:'基础',certificate:''}];
 profile.about={introduction:'我维护过本机资料工具。',other:'可提供作品演示。'};
 const checked=model.validateProfile(profile);
 assert.equal(checked.education[0].degree,'本科');
 assert.equal(checked.education[0].academicDegree,'工学学士');
 assert.deepEqual(checked.languages.map(row=>row.name),['英语','日语']);
 assert.equal(checked.about.introduction,'我维护过本机资料工具。');
 assert.throws(()=>model.validateProfile({...profile,languages:[{...profile.languages[0],level:'a'.repeat(201)}]}));
 assert.throws(()=>model.validateProfile({...profile,about:{...profile.about,religion:'unknown'}}));
});

test('description variants materialize selected wording and cannot override identity or dates',()=>{
 const profile=model.createFictionalProfile(),workId=profile.work[0].id;
 profile.about={introduction:'基础介绍。',other:''};
 profile.variants=[{id:'tools',name:'工具岗位',descriptions:[{section:'work',recordId:workId,description:'仅为测试：维护网页应用，编写自动化检查。'}],about:{introduction:'仅为测试：参与资料工具开发。'}}];
 profile.activeVariantId='tools';
 const before=JSON.stringify(profile);
 assert.equal(typeof model.materializeProfile,'function');
 const selected=model.materializeProfile(profile);
 assert.equal(selected.work[0].description,'仅为测试：维护网页应用，编写自动化检查。');
 assert.equal(selected.work[0].organization,'示例科技有限公司');
 assert.equal(selected.work[0].startDate,'2024-07');
 assert.equal(selected.about.introduction,'仅为测试：参与资料工具开发。');
 assert.equal(JSON.stringify(profile),before);
 assert.equal(model.materializeProfile(profile,'').work[0].description,'仅为测试：维护网页应用和自动化检查。');
 assert.throws(()=>model.validateProfile({...profile,variants:[{...profile.variants[0],contact:{name:'another'}}]}));
 assert.throws(()=>model.validateProfile({...profile,variants:[{...profile.variants[0],descriptions:[{section:'work',recordId:workId,description:'x',startDate:'2030'}]}]}));
 assert.throws(()=>model.validateProfile({...profile,activeVariantId:'missing'}));
 assert.throws(()=>model.materializeProfile(profile,'missing'));
});

test('variants reject stale references and duplicate overrides instead of modifying another record',()=>{
 const profile=model.createFictionalProfile();
 profile.variants=[{id:'v',name:'版本',descriptions:[{section:'work',recordId:profile.work[0].id,description:'测试'}]}];
 assert.equal(model.validateProfile(profile).variants[0].name,'版本');
 profile.variants[0].descriptions[0].recordId='deleted-record';
 assert.throws(()=>model.validateProfile(profile));
 const entry={section:'projects',recordId:profile.projects[0].id,description:'测试'};
 profile.variants[0].descriptions=[entry,{...entry}];
 assert.throws(()=>model.validateProfile(profile));
});

test('local attachments recover the exact bytes and verify SHA256 before download',async()=>{
 assert.equal(typeof model.createAttachment,'function');
 assert.equal(typeof model.attachmentBytes,'function');
 const payload=new Uint8Array([0,1,255,42]);
 const attachment=await model.createAttachment(file(payload));
 assert.equal(attachment.name,'虚构材料.pdf');
 assert.equal(attachment.type,'application/pdf');
 assert.equal(attachment.size,4);
 assert.match(attachment.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(await model.attachmentBytes(attachment),payload);
 await assert.rejects(()=>model.attachmentBytes({...attachment,sha256:'0'.repeat(64)}),/校验/);
});

test('attachments allow two 512KiB files and reject excessive count, size or mismatched metadata',async()=>{
 assert.equal(typeof model.createAttachment,'function');
 const first=await model.createAttachment(file(new Uint8Array(512*1024),'first.pdf'));
 const second=await model.createAttachment(file(new Uint8Array(512*1024),'second.pdf'),[first]);
 const profile=model.createProfile();profile.attachments=[first,second];
 assert.equal(model.validateProfile(profile).attachments.length,2);
 await assert.rejects(()=>model.createAttachment(file(new Uint8Array([1]),'third.pdf'),[first,second]),/2/);
 await assert.rejects(()=>model.createAttachment(file(new Uint8Array(512*1024+1),'oversize.pdf')),/512/);
 assert.throws(()=>model.validateProfile({...profile,attachments:[{...first,size:1}]}));
 assert.throws(()=>model.validateProfile({...profile,attachments:[{...first,name:'../escape.pdf'}]}));
 assert.throws(()=>model.validateProfile({...profile,attachments:[{...first,dataBase64:'!!!!'}]}));
});

test('encrypted profile roundtrip includes attachments, sources and active variant without plaintext leak',async()=>{
 assert.equal(typeof model.createAttachment,'function');
 const parsed=parseDocument(document('姓名：虚构用户\n语言能力\n语种：英语 | 熟练程度：熟练 | 语言证书：CET-6\n自我介绍\n只用于验收的个人介绍。'));
 const base=model.createProfile(),profile=applyImportPlan(base,createImportPlan(base,[parsed]),{confirmed:true});
 profile.attachments=[await model.createAttachment(file(new Uint8Array([1,2,3]),'fictional.pdf'))];
 profile.variants=[{id:'v',name:'验收措辞',descriptions:[],about:{introduction:'只用于验收的另一种真实表述。'}}];profile.activeVariantId='v';
 const sealed=await encryptProfile(profile,'beta-fiction-only-2026!');
 assert.equal(JSON.stringify(sealed).includes('虚构用户'),false);
 assert.equal(JSON.stringify(sealed).includes('fictional.pdf'),false);
 const reopened=await decryptProfile(sealed,'beta-fiction-only-2026!');
 assert.deepEqual(reopened,profile);
 assert.equal(reopened.languages[0].certificate,'CET-6');
 assert.equal(reopened.importData.fields.find(ref=>ref.path==='about.introduction').quote,'只用于验收的个人介绍。');
 assert.deepEqual(await model.attachmentBytes(reopened.attachments[0]),new Uint8Array([1,2,3]));
});

test('parser separates explicit学历 and学位 and retains language and self introduction evidence',()=>{
 const parsed=parseDocument(document('教育经历\n学校：虚构大学 | 学历：本科 | 学位：工学学士 | 专业：软件工程\n语言能力\n语种：英语 | 熟练程度：熟练 | 语言证书：CET-6\n语种：日语 | 熟练程度：基础\n自我介绍\n第一段原文。\n第二段原文。\n其他信息\n可提供作品演示。'));
 assert.equal(parsed.records[0].values.degree,'本科');
 assert.equal(parsed.records[0].values.academicDegree,'工学学士');
 assert.deepEqual(parsed.records.filter(row=>row.section==='languages').map(row=>row.values.name),['英语','日语']);
 assert.equal(parsed.about.find(row=>row.key==='introduction').value,'第一段原文。\n第二段原文。');
 assert.equal(parsed.about.find(row=>row.key==='other').value,'可提供作品演示。');
 const base=model.createProfile(),result=applyImportPlan(base,createImportPlan(base,[parsed]),{confirmed:true});
 assert.equal(result.about.introduction,'第一段原文。\n第二段原文。');
 assert.equal(result.importData.fields.filter(ref=>ref.path==='about.introduction').length,2);
 assert.equal(result.importData.fields.find(ref=>ref.path==='languages.'+result.languages[0].id+'.name').line,4);
 assert.equal(result.importData.fields.find(ref=>ref.path==='education.'+result.education[0].id+'.academicDegree').line,2);
});

test('ambiguous degree and language levels remain unresolved with no invented academic degree',()=>{
 const parsed=parseDocument(document('Education\nSchool: Fictional University | Degree: Bachelor\nLanguages\nEnglish | possibly good\n教育经历\n2017 - 2021 | 虚构大学 | 本科 | 软件工程'));
 assert.equal(parsed.records[0].values.degree,'');
 assert.equal(parsed.records[0].values.academicDegree,'');
 assert.equal(parsed.records.at(-1).values.academicDegree,'');
 assert.equal(parsed.records.filter(row=>row.section==='languages').length,0);
 assert.ok(parsed.unresolved.some(row=>row.text.includes('Degree: Bachelor')));
 assert.ok(parsed.unresolved.some(row=>row.text==='English | possibly good'));
});

test('re-import after row reorder preserves stable source IDs and resolves about conflicts explicitly',()=>{
 const parsed=parseDocument(document('语言能力\n语种：英语 | 熟练程度：熟练\n语种：日语 | 熟练程度：基础\n自我介绍\n原介绍。'));
 const base=model.createProfile(),first=applyImportPlan(base,createImportPlan(base,[parsed]),{confirmed:true});
 const oldId=first.languages[0].id;first.languages.reverse();first.about.introduction='人工保留的介绍。';
 const plan=createImportPlan(first,[parsed]);
 assert.equal(plan.about.find(field=>field.key==='introduction').selected,'current');
 const second=applyImportPlan(first,plan,{confirmed:true});
 assert.equal(second.about.introduction,'人工保留的介绍。');
 assert.equal(second.languages.length,2);
 assert.equal(second.importData.sources.length,1);
 assert.equal(second.importData.fields.filter(ref=>ref.path==='languages.'+oldId+'.name').length,1);
});
