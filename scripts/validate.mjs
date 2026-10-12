import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { safeUrl } from '../public/core.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
export async function readJson(path){return JSON.parse(await readFile(resolve(root,path),'utf8'));}
export function validateDataset(data) {
 const errors=[],ids=new Set();
 if(data.schemaVersion!==1||!Array.isArray(data.jobs)||!Array.isArray(data.sources)) throw new Error('岗位数据结构错误');
 const sources=new Set(data.sources.map(s=>s.id));
 for(const j of data.jobs) {
  if(!j.id||ids.has(j.id)) errors.push(`重复或缺失 ID: ${j.id}`); ids.add(j.id);
  if(!sources.has(j.sourceId)) errors.push(`${j.id}: 未知来源`);
  if(!j.title||!j.company||!safeUrl(j.sourceUrl)||!safeUrl(j.applyUrl)) errors.push(`${j.id}: 缺少标题/公司/安全来源链接`);
  if(!['listed','notice','removed','unknown'].includes(j.sourceStatus)||!j.statusEvidence) errors.push(`${j.id}: 状态证据缺失`);
  if(j.sourceStatus==='listed'&&!j.lastVerifiedAt) errors.push(`${j.id}: 在列表状态缺少核验时间`);
  for(const key of ['publishedAt','deadline','lastVerifiedAt','lastAttemptAt','opensAt']) if(j[key] && (!/T.*(Z|[+-]\d\d:\d\d)$/.test(j[key])||!Number.isFinite(Date.parse(j[key])))) errors.push(`${j.id}: 日期或时区无效 ${key}`);
  for(const key of ['locations','regionScopes','education','majors','graduationYears','systemTags']) if(!Array.isArray(j[key])) errors.push(`${j.id}: ${key} 必须是数组`);
  for(const key of ['resume','email','phone','personalTags','note','stage','saved']) if(Object.hasOwn(j,key)) errors.push(`${j.id}: 公开岗位包含私有字段 ${key}`);
  if(!j.salary||!['disclosed','undisclosed','negotiable'].includes(j.salary.status)||!Array.isArray(j.salary.ranges)) errors.push(`${j.id}: 薪资结构错误`);
  for(const r of j.salary?.ranges||[]) if(!/^[A-Z]{3}$/.test(r.currency)||!['year','month','day','hour','unknown'].includes(r.period)||!['salary','ote'].includes(r.kind)||[r.min,r.max].some(x=>x!==null&&(typeof x!=='number'||!Number.isFinite(x)||x<0))||(r.min===null&&r.max===null)||(r.min!==null&&r.max!==null&&r.min>r.max)) errors.push(`${j.id}: 薪资区间无效`);
 }
 if(errors.length) throw new Error(errors.slice(0,20).join('\n'));
 return {jobs:data.jobs.length,sources:data.sources.length,withSalary:data.jobs.filter(j=>j.salary.ranges.length).length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {console.log(JSON.stringify(validateDataset(await readJson('public/data/jobs.json')),null,2));} catch(e){console.error(e.message);process.exitCode=1;}
}
