import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createFictionalProfile,validateProfile,materializeProfile} from '../public/autofill/profile.mjs';

async function editor(){const path=new URL('../public/autofill/profile-editor-state.mjs',import.meta.url);assert.ok(existsSync(path),'资料编辑状态模块尚未实现');return import(path);}
function sourcedProfile(){const profile=createFictionalProfile(),id=profile.work[0].id;profile.importData={version:1,sources:[{id:'d'.repeat(64),name:'fiction.docx',type:'docx',text:'工作描述：维护工具',warnings:[],importedAt:'2026-10-12T00:00:00.000Z'}],fields:[{path:'work.'+id+'.description',sourceId:'d'.repeat(64),line:1,page:1,quote:'工作描述：维护工具',confidence:'high',reason:'明确标签',reviewed:true,edited:false}],unresolved:[]};return profile;}

test('editing a sourced field marks it pending and rejects unknown fact paths',async()=>{
 const {updateProfileField,profileReviewStatus,confirmProfileSources}=await editor();
 const profile=sourcedProfile();updateProfileField(profile,'work.0.description','人工核对后的描述。');
 assert.equal(profile.work[0].description,'人工核对后的描述。');
 assert.equal(profile.importData.fields[0].edited,true);assert.equal(profile.importData.fields[0].reviewed,false);
 assert.equal(profileReviewStatus(profile).pending,1);
 assert.throws(()=>updateProfileField(profile,'contact.__proto__','x'));
 assert.throws(()=>updateProfileField(profile,'work.0.birthDate','2020'));
 const saved=structuredClone(profile);confirmProfileSources(saved);
 assert.equal(profileReviewStatus(saved).pending,0);assert.equal(profileReviewStatus(profile).pending,1);
});

test('moving and deleting records preserve IDs and remove only their own sources and variant references',async()=>{
 const {moveProfileRecord,removeProfileRecord}=await editor(),profile=sourcedProfile();
 const first=profile.education[0].id,second=profile.education[1].id,workId=profile.work[0].id;
 profile.variants=[{id:'wording',name:'措辞',descriptions:[{section:'work',recordId:workId,description:'真实另一种表述。'},{section:'projects',recordId:profile.projects[0].id,description:'项目表述。'}]}];profile.activeVariantId='wording';
 moveProfileRecord(profile,'education',second,-1);
 assert.deepEqual(profile.education.map(row=>row.id),[second,first]);
 assert.equal(profile.importData.fields[0].path,'work.'+workId+'.description');
 removeProfileRecord(profile,'work',workId);
 assert.equal(profile.work.length,0);assert.equal(profile.importData.fields.length,0);
 assert.deepEqual(profile.variants[0].descriptions.map(row=>row.section),['projects']);
 assert.equal(validateProfile(profile).education[0].id,second);
});

test('creating, renaming and removing a wording version keeps facts outside the overlay',async()=>{
 const {addProfileVariant,removeProfileVariant}=await editor(),profile=createFictionalProfile(),id=profile.work[0].id;
 profile.variants=[{id:'existing',name:'已有措辞',descriptions:[{section:'work',recordId:id,description:'当前选定表述。'}]}];profile.activeVariantId='existing';
 const variant=addProfileVariant(profile,'第二份');
 assert.equal(profile.activeVariantId,variant.id);assert.equal(variant.name,'第二份');
 assert.equal(materializeProfile(profile).work[0].description,'当前选定表述。');
 assert.equal(materializeProfile(profile).work[0].organization,'示例科技有限公司');
 variant.name='重命名';assert.equal(validateProfile(profile).variants.at(-1).name,'重命名');
 removeProfileVariant(profile,variant.id);assert.equal(profile.activeVariantId,'');
 assert.equal(profile.variants.length,1);assert.throws(()=>addProfileVariant(profile,'   '));
});

test('review status distinguishes missing contact data from unresolved original text',async()=>{
 const {profileReviewStatus}=await editor(),profile=sourcedProfile();profile.contact.email='';profile.contact.phone='';
 profile.importData.unresolved=[{sourceId:'d'.repeat(64),line:1,page:1,text:'程度可能较好',reason:'含义不明确'}];
 assert.deepEqual(profileReviewStatus(profile).missing,['电子邮箱','手机号码']);
 assert.equal(profileReviewStatus(profile).unresolved,1);
});
