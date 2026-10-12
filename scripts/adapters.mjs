import { safeUrl } from '../public/core.mjs';
const array = x => Array.isArray(x)?x:x?[x]:[];
const unique = x => [...new Set(x.filter(Boolean))];
const amount = x => typeof x==='number' && Number.isFinite(x) && x>=0 ? x : null;
function regions(locations) {
 return unique(locations.map(l=>{
  if(/hong kong|taiwan|taipei|macau|香港|台湾|澳门/i.test(l)) return '港澳台';
  if(/\bchina\b|beijing|shanghai|shenzhen|guangzhou|中国|北京|上海|深圳|广州/i.test(l)) return '中国大陆';
  if(/^(remote|hybrid|distributed|onsite|on-site|global|worldwide)$/i.test(l.trim())) return null;
  return l ? '海外' : null;
 }));
}
function base(raw,source,checkedAt) {
 if(!raw.id || typeof raw.title!=='string' || !raw.title.trim()) throw new Error('来源缺少职位 ID 或标题');
 return {id:`${source.id}:${raw.id}`,sourceId:source.id,sourceJobId:String(raw.id),kind:'position',title:raw.title.trim(),company:source.company,companyType:source.companyType,locations:[],regionScopes:[],education:[],majors:[],graduationYears:[],experience:null,recruitmentType:null,workSchedule:null,workplaceType:null,salary:{status:'undisclosed',text:null,months:null,ranges:[]},sourceUrl:null,applyUrl:null,publishedAt:null,sourceUpdatedAt:null,opensAt:null,deadline:null,deadlinePrecision:null,lastVerifiedAt:checkedAt,lastAttemptAt:checkedAt,sourceStatus:'listed',statusEvidence:'成功读取官方公开职位列表；仅证明核验时仍在列表，未提交申请。',systemTags:[],fieldEvidence:{companyType:source.companyEvidence||null}};
}
function tags(job) {
 return unique([job.companyType,job.kind==='campaign'?'批次公告':null,job.workplaceType,job.recruitmentType,job.salary.ranges.length?'薪资已披露':'薪资未披露',job.deadline?'有截止时间':null]);
}
export function adaptGreenhouse(raw,source,checkedAt) {
 const j=base(raw,source,checkedAt);
 const places=raw.metadata?.find(m=>m.name==='Job Posting Location')?.value;
 j.locations=unique(array(places||raw.location?.name));j.regionScopes=regions(j.locations);
 j.workplaceType=({Hybrid:'混合办公',Remote:'远程','On-site':'现场办公',Onsite:'现场办公',Distributed:'分布式（原文）'})[raw.location?.name]||null;
 j.sourceUrl=safeUrl(raw.absolute_url);j.applyUrl=j.sourceUrl;
 j.publishedAt=raw.first_published||null;j.sourceUpdatedAt=raw.updated_at||null;
 j.deadline=raw.application_deadline||null;j.deadlinePrecision=j.deadline?'instant':null;
 if(raw.internal_job_id===null) {j.sourceStatus='unknown';j.statusEvidence='来源标记为人才储备（prospect），不能视为当前具体空缺。';}
 j.fieldEvidence.locations=places?'metadata.Job Posting Location':'location.name';
 j.fieldEvidence.publishedAt='first_published（不使用 updated_at 替代）';
 j.fieldEvidence.salary='列表接口未提供可确认周期的结构化薪资；不估算';
 j.systemTags=tags(j);return j;
}
export function adaptAshby(raw,source,checkedAt) {
 if(raw.isListed!==true) return null;
 const j=base(raw,source,checkedAt);
 j.locations=unique([raw.location,...array(raw.secondaryLocations).map(x=>x.location)]);j.regionScopes=regions(j.locations);
 j.workplaceType=({Remote:'远程',Hybrid:'混合办公',OnSite:'现场办公'})[raw.workplaceType]||(raw.isRemote?'远程':null);
 j.employmentType=({FullTime:'全职',PartTime:'兼职',Intern:'实习',Contract:'合同制',Temporary:'临时'})[raw.employmentType]||raw.employmentType||null;
 j.recruitmentType=raw.employmentType==='Intern'?'实习':null;
 j.publishedAt=raw.publishedAt||null;j.sourceUrl=safeUrl(raw.jobUrl);j.applyUrl=safeUrl(raw.applyUrl)||j.sourceUrl;
 if(raw.shouldDisplayCompensationOnJobPostings!==false && raw.compensation) {
  const c=raw.compensation;
  const tiers=c.compensationTiers?.length?c.compensationTiers:[{title:null,components:c.summaryComponents||[]}];
  const ranges=[];
  for(const tier of tiers) for(const part of tier.components||[]) {
   if(!['Salary','OTE'].includes(part.compensationType)) continue;
   const min=amount(part.minValue),max=amount(part.maxValue);
   if((min===null&&max===null)||!part.currencyCode||min!==null&&max!==null&&min>max) continue;
   ranges.push({min,max,currency:part.currencyCode,period:({'1 YEAR':'year','1 MONTH':'month','1 HOUR':'hour','1 DAY':'day'})[part.interval]||'unknown',kind:part.compensationType==='OTE'||/\bOTE\b|on.target earnings/i.test(part.summary||'')?'ote':'salary',label:tier.title||null});
  }
  j.salary={status:ranges.length?'disclosed':'undisclosed',text:c.compensationTierSummary||c.scrapeableCompensationSalarySummary||null,months:null,ranges};
 }
 j.fieldEvidence.salary='compensation.compensationTiers[].components；仅 Salary/OTE，排除奖金、佣金和股权；金额单位为原币种';
 j.fieldEvidence.locations='location / secondaryLocations[].location';j.systemTags=tags(j);return j;
}
export function mergeSourceSnapshot(previous,incoming,run) {
 const other=previous.filter(j=>j.sourceId!==run.sourceId),old=previous.filter(j=>j.sourceId===run.sourceId);
 if(run.status!=='ok') return [...other,...old.map(j=>({...j,lastAttemptAt:run.checkedAt,lastUpdateError:run.error||'来源更新失败'}))];
 if(!incoming.length) throw new Error('空列表需要人工确认，拒绝将全部职位下架');
 const ids=new Set(incoming.map(j=>j.id));
 if(ids.size!==incoming.length) throw new Error('来源返回重复 ID');
 const removed=old.filter(j=>!ids.has(j.id)).map(j=>({...j,sourceStatus:'removed',lastVerifiedAt:run.checkedAt,lastAttemptAt:run.checkedAt,statusEvidence:'完整官方列表已成功读取，该 ID 不再出现；具体关闭原因未披露。'}));
 return [...other,...incoming,...removed];
}
