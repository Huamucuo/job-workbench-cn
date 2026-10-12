export const STAGES = ['未投递','准备中','已投递','面试中','已录用','已结束'];
export const STATUS_LABELS = {listed:'核验时在招',notice_open:'公告报名期内',not_started:'尚未开始',expired:'已截止',stale:'核验已过期',removed:'来源已下架',unknown:'待核验'};
export const PERIOD_LABELS = {month:'月',year:'年',hour:'小时',day:'日',unknown:'周期未披露'};
export const EMPTY_PRIVATE = () => ({schemaVersion:1,kind:'job-workbench-private',records:{},savedSearches:[]});
const finite = value => typeof value === 'number' && Number.isFinite(value);
const present = value => value !== '' && value !== undefined && value !== null;
const list = value => Array.isArray(value) ? value : value ? [value] : [];

export function safeUrl(value) {
 try { const u=new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function effectiveStatus(job, now=Date.now()) {
 if(job.sourceStatus==='removed') return 'removed';
 if(job.deadline && Date.parse(job.deadline)<now) return 'expired';
 if(job.opensAt && Date.parse(job.opensAt)>now) return 'not_started';
 const verified=Date.parse(job.lastVerifiedAt);
 if(!Number.isFinite(verified) || verified>now+300000) return 'unknown';
 if(now-verified>72*3600000) return 'stale';
 if(job.sourceStatus==='listed') return 'listed';
 if(job.sourceStatus==='notice' && job.opensAt && job.deadline) return 'notice_open';
 return 'unknown';
}
export function salaryMatches(salary={}, f={}) {
 const status=salary.status || 'undisclosed';
 if(f.salaryDisclosure && f.salaryDisclosure!==status) return false;
 if(present(f.payMonths) && Number(salary.months)!==Number(f.payMonths)) return false;
 const hasAmount=present(f.salaryMin)||present(f.salaryMax);
 if(hasAmount && (!f.currency || !['month','year','day','hour'].includes(f.period))) return false;
 const lo=present(f.salaryMin)?Number(f.salaryMin):-Infinity;
 const hi=present(f.salaryMax)?Number(f.salaryMax):Infinity;
 if(Number.isNaN(lo)||Number.isNaN(hi)||(present(f.salaryMin)&&lo<0)||(present(f.salaryMax)&&hi<0)||lo>hi) return false;
 if(!(hasAmount||f.currency||f.period||f.salaryKind)) return true;
 return (salary.ranges||[]).some(r=>{
  if(f.currency && r.currency!==f.currency || f.period && r.period!==f.period) return false;
  if((r.kind||'salary')!==(f.salaryKind||'salary')) return false;
  if(!finite(r.min)&&!finite(r.max)) return false;
  if(f.salaryMode==='floor' && hasAmount && present(f.salaryMin) && (!finite(r.min)||r.min<lo)) return false;
  return (finite(r.max)?r.max:Infinity)>=lo && (finite(r.min)?r.min:-Infinity)<=hi;
 });
}
const ALIASES = [['北京','beijing'],['上海','shanghai'],['深圳','shenzhen'],['香港','hong kong'],['新加坡','singapore'],['中国','china'],['美国','united states','us'],['工程师','engineer'],['软件','software'],['产品','product'],['设计','design'],['销售','sales','account executive'],['法务','counsel','legal'],['市场','marketing'],['经理','manager'],['远程','remote'],['实习','intern']];
function searchable(job, personal) {return [job.title,job.company,...list(job.locations),...list(job.majors),...list(job.systemTags),...(personal?.tags||[]),job.workplaceType].join(' ').toLocaleLowerCase();}
function keywordMatches(text,q) {
 return String(q||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every(word=>{
  const alternatives=ALIASES.find(a=>a.includes(word))||[word];
  return alternatives.some(a=>text.includes(a));
 });
}
function groupMatches(selected,actual) {return !selected?.length || selected.some(s=>s==='未披露'?list(actual).length===0:list(actual).includes(s));}
export function matchingSalaryRanges(job,f={}) {
 const salary=job.salary||{ranges:[]};
 const scoped=present(f.salaryMin)||present(f.salaryMax)||f.currency||f.period||f.salaryKind;
 return (salary.ranges||[]).filter(r=>{
  if(!salaryMatches({...salary,ranges:[r]},f))return false;
  // Tier labels are the only declared range/location link exposed by these feeds.
  // Be conservative when combining a city with pay on multi-location jobs.
  if(scoped&&f.location&&job.locations?.length>1) return !!r.label&&keywordMatches(r.label.toLowerCase(),f.location);
  return true;
 });
}
export function matchesJob(job, f={}, personal={}, now=Date.now()) {
 const record=personal[job.id]||{};
 if(!keywordMatches(searchable(job,record),f.q)) return false;
 for(const [key,field] of [['companyTypes','companyType'],['regionScopes','regionScopes'],['education','education'],['recruitmentTypes','recruitmentType'],['workSchedules','workSchedule'],['workplaceTypes','workplaceType']]) {
  if(!groupMatches(f[key],job[field])) return false;
 }
 if(f.location && !keywordMatches(list(job.locations).join(' ').toLowerCase(),f.location)) return false;
 if(f.major && !keywordMatches(list(job.majors).join(' ').toLowerCase(),f.major)) return false;
 if(f.graduationYear && !list(job.graduationYears).map(String).includes(String(f.graduationYear))) return false;
 if(f.experience && (f.experience==='未披露' ? !!job.experience : job.experience!==f.experience)) return false;
 const status=effectiveStatus(job,now);
 if(f.status==='active' && !['listed','notice_open'].includes(status)) return false;
 if(f.status && f.status!=='active' && f.status!==status) return false;
 if(f.onlySaved && !record.saved) return false;
 if(f.onlyTracked && (!record.stage || record.stage==='未投递')) return false;
 if(f.stage && (record.stage||'未投递')!==f.stage) return false;
 if(f.tag && !(record.tags||[]).some(t=>t.toLowerCase().includes(f.tag.toLowerCase())) && !(job.systemTags||[]).some(t=>t.toLowerCase().includes(f.tag.toLowerCase()))) return false;
 for(const [key,field,end] of [['publishedAfter','publishedAt',false],['publishedBefore','publishedAt',true],['deadlineAfter','deadline',false],['deadlineBefore','deadline',true]]) {
  if(f[key]) {
   if(!job[field] || !Number.isFinite(Date.parse(job[field]))) return false;
   const boundary=Date.parse(`${f[key]}T${end?'23:59:59.999':'00:00:00'}+08:00`);
   if(!Number.isFinite(boundary) || (end?Date.parse(job[field])>boundary:Date.parse(job[field])<boundary)) return false;
  }
 }
 if(f.deadlineDays && (!job.deadline || Date.parse(job.deadline)<now || Date.parse(job.deadline)>now+Number(f.deadlineDays)*86400000)) return false;
 if(!salaryMatches(job.salary,f))return false;
 const scoped=present(f.salaryMin)||present(f.salaryMax)||f.currency||f.period||f.salaryKind;
 return !(scoped&&f.location&&job.locations?.length>1)||matchingSalaryRanges(job,f).length>0;
}
export function salaryText(salary={}) {
 if(salary.status==='negotiable') return '薪资面议';
 const ranges=salary.ranges||[];
 if(!ranges.length) return '薪资未披露';
 const r=ranges.find(x=>x.kind==='salary')||ranges[0];
 const n=x=>Number(x).toLocaleString('zh-CN',{maximumFractionDigits:2});
 const amount=finite(r.min)&&finite(r.max)?`${n(r.min)}–${n(r.max)}`:finite(r.min)?`${n(r.min)} 起`:`最高 ${n(r.max)}`;
 return `${r.currency} ${amount} / ${PERIOD_LABELS[r.period]||r.period}${r.kind==='ote'?' · OTE':''}${ranges.length>1?' · 多档薪资':''}`;
}
export function formatDate(value,withTime=false) {
 if(!value) return '未披露';
 const date=new Date(value); if(!Number.isFinite(+date)) return '未披露';
 return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',...(withTime?{hour:'2-digit',minute:'2-digit',hour12:false}:{})}).format(date);
}
const FILTER_ARRAYS=['companyTypes','regionScopes','education','recruitmentTypes','workSchedules','workplaceTypes'];
const FILTER_STRINGS=['q','location','major','graduationYear','experience','status','stage','tag','salaryDisclosure','salaryMin','salaryMax','currency','period','payMonths','salaryMode','salaryKind','publishedAfter','publishedBefore','deadlineAfter','deadlineBefore','deadlineDays','sort'];
const badKey = key => ['__proto__','constructor','prototype'].includes(key);
function plain(x) {return x && typeof x==='object' && !Array.isArray(x);}
export function normalizeFilters(f={}) {
 if(!plain(f)) throw new Error('筛选格式无效');
 const result={};
 for(const key of FILTER_ARRAYS) if(Array.isArray(f[key])) result[key]=f[key].filter(x=>typeof x==='string').slice(0,30).map(x=>x.slice(0,80));
 for(const key of FILTER_STRINGS) if(present(f[key])) result[key]=String(f[key]).slice(0,300);
 for(const key of ['onlySaved','onlyTracked']) if(f[key]===true) result[key]=true;
 return result;
}
export function validateBackup(value) {
 if(!plain(value)||value.schemaVersion!==1||value.kind!=='job-workbench-private') throw new Error('不是受支持的求职工作台备份（版本 1）');
 if(!plain(value.records)||!Array.isArray(value.savedSearches)) throw new Error('备份内容不完整');
 if(Object.keys(value.records).length>20000 || value.savedSearches.length>100) throw new Error('备份条目超过限制');
 const result=EMPTY_PRIVATE();
 for(const [id,r] of Object.entries(value.records)) {
  if(badKey(id)||id.length>240||!plain(r)) throw new Error('备份记录键无效');
  if(r.tags!==undefined && (!Array.isArray(r.tags)||r.tags.length>30||r.tags.some(t=>typeof t!=='string'||t.length>80))) throw new Error('标签格式或长度无效');
  if(r.note!==undefined && (typeof r.note!=='string'||r.note.length>5000)) throw new Error('备注过长或格式无效');
  if(r.stage!==undefined&&!STAGES.includes(r.stage)) throw new Error('投递状态无效');
  result.records[id]={saved:r.saved===true,stage:r.stage||'未投递',tags:[...new Set(r.tags||[])],note:r.note||'',title:typeof r.title==='string'?r.title.slice(0,300):'',company:typeof r.company==='string'?r.company.slice(0,120):'',sourceUrl:safeUrl(r.sourceUrl),updatedAt:typeof r.updatedAt==='string'?r.updatedAt:null};
 }
 for(const search of value.savedSearches) {
  if(!plain(search)||typeof search.name!=='string'||!search.name.trim()||search.name.length>80) throw new Error('已保存筛选名称无效');
  result.savedSearches.push({id:String(search.id||search.name).slice(0,100),name:search.name,filters:normalizeFilters(search.filters)});
 }
 return result;
}
