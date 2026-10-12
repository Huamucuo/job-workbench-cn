import {mkdir,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {root,readJson,validateDataset} from './validate.mjs';
const data=await readJson('public/data/jobs.json');const summary=validateDataset(data);
if(process.argv.includes('--public')){
 const release=await readJson('config/release.json');
 const required=['publicReleaseApproved','operatorAndJurisdictionReviewed','telecomAndRecruitmentRequirementsReviewed','privacyAndLogsReviewed','mainlandAccessTested'];
 const missing=required.filter(key=>release[key]!==true);
 if(!release.complaintsContact)missing.push('complaintsContact');
 const registry=await readJson('sources/registry.json');
 const sources=new Map(registry.map(s=>[s.id,s]));
 for(const id of new Set(data.jobs.map(j=>j.sourceId)))if(!sources.get(id)?.redistributionAllowed||!sources.get(id)?.permissionEvidence)missing.push(`来源许可:${id}`);
 if(missing.length){console.error('公开构建已阻止。未满足：'+missing.join('、'));process.exit(2);}
 data.mode='public';data.notice='招聘信息以官方最新公告为准。';data.sources=registry;
}
// Only explicit public assets enter dist; private records, raw responses, docs and tests never do.
const importAssets=JSON.parse(await readFile(resolve(root,'scripts/import-assets.json'),'utf8')).assets.map(a=>a.path);
const publicFiles=["help/crosspage.html","help/beta/crosspage-edit.png","help/crosspage-report.html","help/crosspage-handoff.txt","help/beta/crosspage-start.png","help/beta/crosspage-preview.png","help/beta/crosspage-education.png","help/beta/crosspage-work.png","help/beta/crosspage-paused.png","autofill/page-watch.js","autofill/lab/flow/contact.html","autofill/lab/flow/education.html","autofill/lab/flow/work.html","autofill/lab/flow/questions.html","autofill/lab/flow/attachments.html","autofill/lab/flow/review.html","autofill/lab/flow/flow.mjs","autofill/lab/flow/style.css",'help/beta/home-simple.png','help/beta/first-import.png','help/beta.html','help/beta-report.html','help/beta-guide.css','help/beta-handoff.txt','help/beta/extension-card.png','help/beta/install-buttons.png','help/beta/import-preview.png','help/beta/ordinary-filled.png','help/beta/rollback-results.png','help/beta/complex-check.png','help/beta/grant.png','autofill/samples/沈星澄-Beta增强虚构简历.docx','autofill/samples/沈星澄-Beta增强虚构简历.pdf',"autofill/lab/complex-checker.mjs","autofill/lab/complex.mjs","autofill/lab/complex.css","autofill/lab/complex.html","autofill/beta-start.mjs","autofill/profile-extras-ui.mjs","autofill/profile-editor-state.mjs",'beta.css','autofill/bridge-client.mjs','autofill/workbench-connection.mjs',"help/v0.3.0.html","help/guide.css","help/docx-preview.jpg","help/import-saved.jpg","help/pdf-conflicts.jpg","help/scan-rejected.jpg","help/import-form-A.jpg","help/import-form-B.jpg","help/import-form-C.jpg","help/unsaved-import-locked.jpg","help/unsaved-import-vault-unchanged.jpg","help/unsaved-import-recovery.jpg","help/backup-reimport.jpg","help/home-entry.jpg",'autofill/samples/index.html',...['林知行-完整虚构简历.docx','林知行-完整虚构简历.pdf','林知行-冲突版本.pdf','扫描件-应提示未识别.pdf'].map(n=>'autofill/samples/'+n),...importAssets,'autofill/import-parser.mjs','autofill/import-meta.mjs','autofill/import-merge.mjs','autofill/document-reader.mjs','autofill/import-ui.mjs','autofill/import.css','autofill-start.html','autofill/start.css','autofill/start.mjs','downloads/求职自动填写扩展.zip','index.html','styles.css','app.mjs','core.mjs','icon.svg','_headers','profile.html',...['profile.mjs','recoveries.mjs','vault.mjs','ui.mjs','rules.js','engine.js','panel.mjs','profile-ui.mjs','autofill.css'].map(n=>'autofill/'+n),...['index.html','basic.html','dynamic.html','wizard.html','guards.html','qa-regression.html','qa-regression.mjs','lab.mjs'].map(n=>'autofill/lab/'+n)];
const dest=resolve(root,'dist');await mkdir(resolve(dest,'data'),{recursive:true});
for(const file of publicFiles){await mkdir(resolve(dest,file,'..'),{recursive:true});await cp(resolve(root,'public',file),resolve(dest,file));}
await writeFile(resolve(dest,'data/jobs.json'),JSON.stringify(data)+'\n');
const allowed=new Set([...publicFiles,'data/jobs.json']);
async function files(dir){let out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isSymbolicLink())throw new Error('构建目录不能包含符号链接');if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
for(const file of await files(dest))if(!allowed.has(relative(dest,file).replaceAll('\\','/')))throw new Error(`构建目录含非发布文件，请人工检查：${file}`);
console.log(JSON.stringify({mode:data.mode,files:allowed.size,...summary,output:dest},null,2));
