import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { adaptAshby,adaptGreenhouse,mergeSourceSnapshot } from './adapters.mjs';
import { root,readJson,validateDataset } from './validate.mjs';
import { verifyCachedCapture,retainRegisteredJobs } from './source-policy.mjs';

const research=process.argv.includes('--research'),fromCache=process.argv.includes('--from-cache');
const registry=await readJson('sources/registry.json');
const chosen=registry.filter(s=>s.adapter!=='manual'&&(research||(s.automatedAllowed&&s.permissionEvidence)));
if(!chosen.length){console.error('没有已获使用依据的自动更新源。请先审阅 docs/02-数据来源.md，再填写来源许可；本机单次核验可显式运行 npm run update:research。未改写岗位。');process.exit(2);}
let previous={jobs:[]};try{previous=await readJson('public/data/jobs.json');}catch(e){if(e.code!=='ENOENT') throw e;}
let jobs=retainRegisteredJobs(previous.jobs,registry);const runs=[];
await mkdir(resolve(root,'.local'),{recursive:true});
for(const source of chosen) {
 let checkedAt=new Date().toISOString();
 try {
  const url=new URL(source.endpoint);
  if(!['boards-api.greenhouse.io','api.ashbyhq.com'].includes(url.hostname)||url.protocol!=='https:'||url.username||url.password) throw new Error('接口不在官方域名允许名单');
  let raw;
  if(fromCache) {
   const path=resolve(root,'.cache',`${source.id}.json`);raw=await readFile(path,'utf8');
   const capture=await readJson(`.cache/${source.id}.capture.json`);checkedAt=verifyCachedCapture(raw,source,capture);
  } else {
   const response=await fetch(url,{signal:AbortSignal.timeout(25000),redirect:'error',headers:{'Accept':'application/json','User-Agent':'JobWorkbenchLocalResearch/0.1'}});
   if(!response.ok) throw new Error(`HTTP ${response.status}，不重试绕过限制`);
   raw=await response.text();if(raw.length>15000000) throw new Error('响应超过安全上限');
   checkedAt=new Date().toISOString();
  }
  const data=JSON.parse(raw);
  if(!Array.isArray(data.jobs)||!data.jobs.length) throw new Error('职位列表为空或结构变化，需人工复核');
  const adapter=source.adapter==='ashby'?adaptAshby:adaptGreenhouse;
  const incoming=data.jobs.map(j=>adapter(j,source,checkedAt)).filter(Boolean);
  if(source.adapter==='ashby') {const notListed=new Set(data.jobs.filter(j=>j.isListed!==true).map(j=>`${source.id}:${j.id}`));jobs=jobs.filter(j=>!notListed.has(j.id));}
  validateDataset({schemaVersion:1,sources:registry,jobs:incoming});
  const run={sourceId:source.id,status:'ok',checkedAt,count:incoming.length,sha256:createHash('sha256').update(raw).digest('hex'),endpoint:source.endpoint,mode:fromCache?'cached-replay':research?'local-research':'permitted-update'};
  jobs=mergeSourceSnapshot(jobs,incoming,run);runs.push(run);
  if(research&&!fromCache){
   await mkdir(resolve(root,'.cache'),{recursive:true});
   await writeFile(resolve(root,'.cache',`${source.id}.json`),raw);
   await writeFile(resolve(root,'.cache',`${source.id}.capture.json`),JSON.stringify({sourceId:source.id,endpoint:source.endpoint,capturedAt:checkedAt,sha256:run.sha256},null,2));
  }
  console.log(`${source.id}: ${incoming.length} 条真实来源记录`);
 } catch(e) {
  const run={sourceId:source.id,status:'error',checkedAt,error:e.message};runs.push(run);jobs=mergeSourceSnapshot(jobs,[],run);console.error(`${source.id}: ${e.message}`);
 }
}
// Manual records retain their actual verification dates; running this command never re-verifies them.
let manual=[];try{manual=await readJson('sources/manual.json');}catch(e){if(e.code!=='ENOENT')throw e;}
const manualSources=new Set(registry.filter(s=>s.adapter==='manual').map(s=>s.id));
jobs=[...jobs.filter(j=>!manualSources.has(j.sourceId)),...manual.filter(j=>manualSources.has(j.sourceId))];
const data={schemaVersion:1,generatedAt:new Date().toISOString(),mode:research?'local-research':previous.mode||'permitted-update',notice:'本机研究快照；官方列表在招不保证资格或申请成功。未通过公开运营门禁。',sources:registry,sourceRuns:runs,jobs};
validateDataset(data);
if(!jobs.length) {console.error('没有可交付岗位，拒绝覆盖');process.exit(1);}
await mkdir(resolve(root,'public/data'),{recursive:true});
const dest=resolve(root,'public/data/jobs.json');
await writeFile(`${dest}.tmp`,JSON.stringify(data,null,2)+'\n');await rename(`${dest}.tmp`,dest);
await writeFile(resolve(root,'.local/update-report.json'),JSON.stringify({generatedAt:data.generatedAt,runs},null,2));
console.log(`共 ${jobs.length} 条，私有数据未参与更新。`);
if(runs.some(r=>r.status==='error'))process.exitCode=1;
