import { STAGES,STATUS_LABELS,PERIOD_LABELS,EMPTY_PRIVATE,matchesJob,effectiveStatus,matchingSalaryRanges,salaryText,formatDate,validateBackup,normalizeFilters,safeUrl } from './core.mjs';
const $=s=>document.querySelector(s), KEY='zhiyouyinli.private.v1';
let dataset={jobs:[],sources:[],sourceRuns:[]},privateData=EMPTY_PRIVATE(),view='jobs',filters={status:'active'},page=1,storageError='',damagedRaw=null;
const size=20;
function el(tag,attrs={},children=[]) {
 const n=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)) {
  if(k==='text') n.textContent=String(v??'');
  else if(k==='class') n.className=v;
  else if(k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(),v);
  else if(v!==undefined&&v!==null&&v!==false) n.setAttribute(k,v===true?'':String(v));
 }
 for(const child of Array.isArray(children)?children:[children]) if(child!==null&&child!==undefined) n.append(child instanceof Node?child:document.createTextNode(String(child)));
 return n;
}
function link(text,url,className='') {const href=safeUrl(url);return href?el('a',{text,href,class:className,target:'_blank',rel:'noopener noreferrer'}):el('span',{text:'链接未披露',class:'muted'});}
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4800);}
function savePrivate(next) {
 try {
  const checked=validateBackup(next);
  if(damagedRaw!==null) throw new Error('检测到原记录损坏，请先在本机数据页导出原始内容并清空或导入有效备份');
  localStorage.setItem(KEY,JSON.stringify(checked));privateData=checked;storageError='';renderSidebar();return true;
 }catch(e){storageError=e.message;toast(`未保存：${e.message}`);return false;}
}
function readPrivate(){try{const raw=localStorage.getItem(KEY);if(raw){try{privateData=validateBackup(JSON.parse(raw));}catch(e){damagedRaw=raw;throw e;}}}catch(e){storageError=`本机存储不可用或内容损坏：${e.message}`;}}
function recordFor(job){return {...(privateData.records[job.id]||{saved:false,stage:'未投递',tags:[],note:''}),title:job.title,company:job.company,sourceUrl:job.sourceUrl,updatedAt:new Date().toISOString()};}
function updateRecord(job,changes){const next=structuredClone(privateData);next.records[job.id]={...recordFor(job),...changes};return savePrivate(next);}
async function action(title,message,{input=false,value='',confirm='确认'}={}) {
 const d=$('#action-dialog');$('#action-title').textContent=title;$('#action-message').textContent=message;
 $('#action-input-label').hidden=!input;$('#action-input').value=value;$('#action-confirm').textContent=confirm;d.returnValue='cancel';d.showModal();
 if(input)$('#action-input').focus();
 return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='confirm'?{value:$('#action-input').value}:null),{once:true}));
}
function download(content,name,type='application/json') {const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportPrivate(){download(JSON.stringify({...privateData,exportedAt:new Date().toISOString()},null,2),`求职工作台-个人备份-${new Date().toISOString().slice(0,10)}.private.json`);toast('已生成本机备份；请勿上传到公开仓库。');}
function renderSidebar(){
 $('#saved-count').textContent=Object.values(privateData.records).filter(r=>r.saved).length;
 $('#tracked-count').textContent=Object.values(privateData.records).filter(r=>r.stage&&r.stage!=='未投递').length;
 const container=$('#saved-searches');container.replaceChildren();
 if(!privateData.savedSearches.length) container.append(el('p',{class:'muted small',text:'把常用条件存下来，下次不用重新选。'}));
 for(const s of privateData.savedSearches) container.append(el('div',{class:'saved-search'},[
  el('button',{text:`↳ ${s.name}`,title:s.name,onClick:()=>loadSearch(s)}),el('button',{text:'×','aria-label':`删除筛选 ${s.name}`,onClick:async()=>{if(!await action('删除已保存筛选',`删除「${s.name}」？不会删除收藏或投递记录。`))return;const n=structuredClone(privateData);n.savedSearches=n.savedSearches.filter(x=>x.id!==s.id);if(savePrivate(n))toast('筛选已删除');}})
 ]));
}
function setupFilters(){
 for(const [target,name,options] of [['#company-options','companyTypes',['国企','外企','民企','其他']],['#region-options','regionScopes',['中国大陆','港澳台','海外','未披露']]]) {
  for(const value of options) $(target).append(el('label',{class:'check-chip'},[el('input',{type:'checkbox',name,value}),el('span',{text:value})]));
 }
 for(const stage of STAGES) $('#stage-filter').append(el('option',{text:stage,value:stage}));
}
function readFilters(){
 const form=$('#filters'),fd=new FormData(form),out={q:$('#search').value.trim(),sort:$('#sort').value};
 const arrays=['companyTypes','regionScopes','education','recruitmentTypes','workSchedules','workplaceTypes'];
 for(const key of new Set(fd.keys())) out[key]=arrays.includes(key)?fd.getAll(key).filter(Boolean):fd.get(key);
 out.onlySaved=view==='saved';out.onlyTracked=view==='tracked';return normalizeFilters(out);
}
function fillFilters(){
 const form=$('#filters');form.reset();
 for(const control of form.elements){if(!control.name)continue;const value=filters[control.name];if(control.type==='checkbox')control.checked=Array.isArray(value)&&value.includes(control.value);else control.value=Array.isArray(value)?value[0]||'':value??'';}
 $('#search').value=filters.q||'';$('#sort').value=filters.sort||'recommended';
 for(const button of document.querySelectorAll('[data-quick]')) {const k=button.dataset.quick;button.classList.toggle('active',k==='mainland'&&filters.regionScopes?.includes('中国大陆')||k==='salary'&&filters.salaryDisclosure==='disclosed'||k==='deadline'&&filters.deadlineDays==='7'||k==='unknown'&&!filters.status);}
}
function filterError(f){
 if((f.salaryMin!==undefined||f.salaryMax!==undefined)&&(!f.currency||!['month','year','day','hour'].includes(f.period)))return '填写金额后，请选择币种和明确的计薪周期；未知周期无法比较。';
 if(f.salaryMin!==undefined&&f.salaryMax!==undefined&&Number(f.salaryMin)>Number(f.salaryMax))return '最低金额不能高于最高金额。';
 for(const [a,b] of [['publishedAfter','publishedBefore'],['deadlineAfter','deadlineBefore']]) if(f[a]&&f[b]&&f[a]>f[b])return '开始日期不能晚于结束日期。';
 return '';
}
function applyFilters(){const next=readFilters(),error=filterError(next);$('#filter-error').textContent=error;$('#filter-error').hidden=!error;if(error)return false;filters=next;page=1;fillFilters();renderResults();return true;}
function resetFilters(){filters={status:view==='jobs'?'active':'',onlySaved:view==='saved',onlyTracked:view==='tracked'};page=1;$('#filter-error').hidden=true;fillFilters();renderResults();}
function setView(next){
 view=next;for(const n of document.querySelectorAll('[data-view]'))n.classList.toggle('active',n.dataset.view===view);
 $('#view-title').textContent=({jobs:'发现机会',saved:'我的收藏',tracked:'投递进度',sources:'数据来源',local:'本机数据与备份',help:'使用说明'})[view];
 const searchView=['jobs','saved','tracked'].includes(view);$('#workspace').hidden=!searchView;$('#other-view').hidden=searchView;
 if(searchView)resetFilters();else renderOther();
 window.scrollTo({top:0,behavior:'instant'});
}
function loadSearch(s){view='jobs';setView('jobs');filters={...s.filters};if(filters.onlySaved){view='saved';}else if(filters.onlyTracked){view='tracked';}for(const n of document.querySelectorAll('[data-view]'))n.classList.toggle('active',n.dataset.view===view);$('#view-title').textContent=view==='saved'?'我的收藏':view==='tracked'?'投递进度':'发现机会';page=1;fillFilters();renderResults();toast(`已载入「${s.name}」`);}
function renderStats(){
 const active=dataset.jobs.filter(j=>['listed','notice_open'].includes(effectiveStatus(j))),salary=dataset.jobs.filter(j=>j.salary.ranges.length),mainland=active.filter(j=>j.regionScopes.includes('中国大陆'));
 const cards=[['核验时在招',active.length,'当前有效快照','↗'],['薪资已披露',salary.length,'保留原币种与周期','¥'],['大陆工作地点',mainland.length,'以来源地点字段为准','⌖'],['已收录来源',dataset.sources.length,'含人工待复核公告','◎']];
 $('#stats').replaceChildren(...cards.map(([label,num,note,icon])=>el('div',{class:'stat'},[el('div',{},[el('div',{class:'stat-label',text:label}),el('div',{class:'stat-number',text:num.toLocaleString('zh-CN')}),el('div',{class:'stat-note',text:note})]),el('span',{class:'stat-icon',text:icon,'aria-hidden':'true'})])));
 $('#updated-at').textContent=`快照生成于 ${formatDate(dataset.generatedAt,true)}（北京时间）`;
}
const filterLabels={companyTypes:'企业',regionScopes:'地区',education:'学历',recruitmentTypes:'类型',workSchedules:'制度',workplaceTypes:'办公',location:'城市',major:'专业',graduationYear:'届别',experience:'经验',salaryDisclosure:'薪资',currency:'币种',period:'周期',salaryMin:'最低',salaryMax:'最高',payMonths:'发薪月数',salaryKind:'薪酬',salaryMode:'匹配',publishedAfter:'发布自',publishedBefore:'发布至',deadlineAfter:'截止自',deadlineBefore:'截止至',deadlineDays:'未来天数',tag:'标签',stage:'投递',status:'招聘状态'};
const displayValue=v=>({disclosed:'数字已披露',undisclosed:'未披露',negotiable:'面议',active:'核验时在招',floor:'薪资下限达标',ote:'OTE',salary:'Salary',...STATUS_LABELS,...PERIOD_LABELS})[v]||v;
function renderChips(){
 const nodes=[];
 for(const [key,label] of Object.entries(filterLabels)){const v=filters[key];if(!v||(Array.isArray(v)&&!v.length)||(key==='salaryMode'&&v==='overlap'))continue;nodes.push(el('button',{class:'active-chip',text:`${label}：${Array.isArray(v)?v.join(' / '):displayValue(v)} ×`,'aria-label':`取消${label}筛选`,onClick:()=>{delete filters[key];page=1;fillFilters();renderResults();}}));}
 $('#active-filters').replaceChildren(...nodes);
}
function sortJobs(jobs){return jobs.sort((a,b)=>{
 if((filters.sort||'recommended')==='recommended'){const mainland=(j)=>j.regionScopes.includes('中国大陆')?1:0;const diff=mainland(b)-mainland(a);if(diff)return diff;}
 if(filters.sort==='deadline')return (Date.parse(a.deadline)||Infinity)-(Date.parse(b.deadline)||Infinity);
 if(filters.sort==='verified')return (Date.parse(b.lastVerifiedAt)||0)-(Date.parse(a.lastVerifiedAt)||0);
 return (Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)||a.title.localeCompare(b.title);
});}
function renderResults(){
 renderStats();renderChips();
 const filtered=sortJobs(dataset.jobs.filter(j=>matchesJob(j,filters,privateData.records)));
 const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
 const heading=view==='saved'?'已收藏':view==='tracked'?'跟进中':'找到';$('#result-count').replaceChildren(`${heading} `,el('em',{text:filtered.length}),' 个机会');
 const unknown=dataset.jobs.filter(j=>j.sourceStatus==='unknown').length;
 $('#coverage-note').textContent=`当前为真实来源的本机研究快照。${unknown} 条公告待复核，可选「含待核验公告」查看；学历、专业、经验等大量未披露，筛选这些条件可能无结果。`;
 const container=$('#job-list');container.replaceChildren(...filtered.slice((page-1)*size,page*size).map(jobCard));
 if(!filtered.length)container.append(el('div',{class:'empty-state'},[el('span',{text:'⌕',class:'stat-icon'}),el('strong',{text:'暂时没有符合条件的机会'}),el('p',{text:'试着减少条件，或查看全部状态。未披露的信息不会被当作符合要求。'}),el('button',{class:'secondary',text:'重置筛选',onClick:resetFilters})]));
 $('#pagination').replaceChildren(el('button',{text:'← 上一页',disabled:page<=1,onClick:()=>{page--;renderResults();$('#results').scrollIntoView({block:'start'});}}),el('span',{text:`${page} / ${pages} 页 · 每页 ${size} 条`}),el('button',{text:'下一页 →',disabled:page>=pages,onClick:()=>{page++;renderResults();$('#results').scrollIntoView({block:'start'});}}));
 const missing=Object.entries(privateData.records).filter(([id,r])=>!dataset.jobs.some(j=>j.id===id)&&(view==='saved'?r.saved:view==='tracked'&&r.stage!=='未投递'));
 if(missing.length){const old=el('div',{class:'orphan-list'},[el('h3',{text:'旧快照中的本机记录（当前数据未包含）'})]);for(const [id,r] of missing)old.append(el('div',{},[el('strong',{text:r.title||id}),el('p',{text:`${r.company||''} · ${r.stage} · ${(r.tags||[]).join(' / ')}`}),el('p',{text:r.note}),link('查看保留的来源',r.sourceUrl)]));container.append(old);}
}
function jobCard(j){
 const record=privateData.records[j.id]||{},status=effectiveStatus(j),verified=['listed','notice_open'].includes(status);
 const matchingRanges=matchingSalaryRanges(j,filters);
 const shownSalary=matchingRanges.length?{...j.salary,ranges:matchingRanges}:j.salary;
 const favorite=el('button',{class:`favorite ${record.saved?'saved':''}`,text:record.saved?'★':'☆','aria-label':`${record.saved?'取消收藏':'收藏'} ${j.title}`,'aria-pressed':String(!!record.saved),onClick:()=>{if(updateRecord(j,{saved:!record.saved})){renderResults();toast(record.saved?'已取消收藏':'已收藏到本机');}}});
 const tagValues=[...(j.kind==='campaign'?['批次公告']:[]),...j.systemTags.filter(t=>!['薪资已披露','薪资未披露','批次公告'].includes(t))].slice(0,4);
 if(record.stage&&record.stage!=='未投递')tagValues.push(record.stage);
 return el('article',{class:'job-card','data-job-id':j.id},[
  el('div',{class:'job-top'},[el('div',{class:'company-avatar','data-company':j.company,text:j.company==='Cloudflare'?'C':j.company==='Ashby'?'a':j.company==='Greenhouse'?'g':j.company.slice(0,1),'aria-hidden':'true'}),el('div',{class:'job-title-area'},[el('button',{class:'job-title',text:j.title,onClick:()=>openDetail(j)}),el('div',{class:'company-line'},[j.company,'·',j.companyType||'企业类型未披露',j.kind==='campaign'?'· 招聘批次':''])]),favorite]),
  el('div',{class:'job-middle'},[el('div',{class:`salary ${j.salary.ranges.length?'':'unknown'}`,text:salaryText(shownSalary)}),el('div',{class:'location',text:`⌖ ${j.locations.slice(0,2).join(' / ')||'地点未披露'}${j.locations.length>2?` 等 ${j.locations.length} 个地点`:''}`})]),
  shownSalary.ranges.some(r=>r.label)?el('p',{class:'salary-scope',text:`薪档适用：${[...new Set(shownSalary.ranges.map(r=>r.label).filter(Boolean))].join(' / ')}。岗位地点与薪档地区需分别核对。`}):null,
  el('div',{class:'job-tags'},[...tagValues.map(t=>el('span',{class:'tag',text:t})),...(record.tags||[]).slice(0,3).map(t=>el('span',{class:'tag personal',text:t}))]),
  el('div',{class:'job-bottom'},[el('div',{class:'job-bottom-left'},[el('span',{class:`status ${verified?'':'warn'}`,text:STATUS_LABELS[status]}),el('span',{text:j.deadline?`截止 ${formatDate(j.deadline)}`:`发布 ${formatDate(j.publishedAt)}`}),el('span',{text:j.lastVerifiedAt?`核验 ${formatDate(j.lastVerifiedAt)}`:'成功核验：暂无'})]),el('div',{class:'job-actions'},[el('button',{text:'详情 / 记录',onClick:()=>openDetail(j)}),link(verified?'官方报名 ↗':'官方核对 ↗',j.applyUrl)])])
 ]);
}
function meta(label,value){return el('div',{class:'meta-item'},[el('small',{text:label}),el('span',{text:value||'未披露'})]);}
function openDetail(job){
 const r=recordFor(job),body=el('div',{class:'detail-body'}),status=effectiveStatus(job);
 const stages=el('select',{id:'detail-stage'},STAGES.map(v=>el('option',{value:v,text:v})));stages.value=r.stage;
 const tagInput=el('input',{id:'detail-tags',value:r.tags.join('，'),maxlength:1000,placeholder:'例如：重点关注，准备作品集（逗号分隔）'}),note=el('textarea',{id:'detail-note',maxlength:5000,placeholder:'写下你的准备事项、投递日期或面试安排…'});note.value=r.note;
 const saved=el('input',{type:'checkbox',id:'detail-saved'});saved.checked=r.saved;
 body.append(el('h3',{text:'来源事实'}),el('div',{class:'detail-meta'},[
  meta('公司 / 企业类型',`${job.company} · ${job.companyType}`),meta('工作地点',job.locations.join(' / ')),meta('招聘类型',job.recruitmentType),meta('工作制度 / 办公方式',`${job.workSchedule||'制度未披露'} / ${job.workplaceType||'方式未披露'}`),meta('学历',job.education.join(' / ')),meta('专业',job.majors.join(' / ')),meta('毕业届别',job.graduationYears.join(' / ')),meta('工作经验',job.experience),meta('发布日期',formatDate(job.publishedAt)),meta('报名截止（北京时间）',formatDate(job.deadline,job.deadlinePrecision!=='day')),meta('最后成功核验',job.lastVerifiedAt?formatDate(job.lastVerifiedAt,true):'尚无成功核验'),meta('最近尝试核验',formatDate(job.lastAttemptAt,true))
 ]),el('h3',{text:`报名状态 · ${STATUS_LABELS[status]}`}),el('div',{class:'evidence-box',text:job.statusEvidence+(job.lastUpdateError?` 最近更新失败：${job.lastUpdateError}`:'')+(['stale','unknown'].includes(status)?' 当前需要重新核验，不保证仍可报名。':'')}),link('查看官方来源公告 ↗',job.sourceUrl,'source-link'),el('p',{class:'hint',text:job.sourceUrl}));
 body.append(el('h3',{text:'薪资原始口径'}));
 if(job.salary.ranges.length) for(const range of job.salary.ranges)body.append(el('div',{class:'salary-range',text:`${salaryText({ranges:[range]})}${range.label?` · ${range.label}`:''}`}));else body.append(el('p',{class:'muted small',text:salaryText(job.salary)}));
 body.append(el('p',{class:'hint',text:`${job.salary.text||'来源未披露额外薪酬说明。'} 发薪月数：${job.salary.months||'未披露'}。来源 Salary 字段不自动推断税前/税后；奖金、股权不计入比较。`}),el('p',{class:'hint',text:job.fieldEvidence?.salary||'无结构化薪资证据。'}));
 body.append(el('h3',{text:'我的求职记录 · 只在本机'}),el('label',{class:'check-chip'},[saved,'收藏这个机会']),el('label',{class:'field',for:'detail-stage'},['投递进度',stages]),el('label',{class:'field',for:'detail-tags'},['自定义标签',tagInput]),el('label',{class:'field',for:'detail-note'},['备注',note]));
 const saveButton=el('button',{class:'primary',text:'保存本机记录',onClick:()=>{
  const tags=tagInput.value.split(/[,，\n]/).map(t=>t.trim()).filter(Boolean);
  if(tags.length>30||tags.some(t=>t.length>80)){toast('最多 30 个标签，每个不超过 80 字。');return;}
  if(updateRecord(job,{saved:saved.checked,stage:stages.value,tags:[...new Set(tags)],note:note.value})){renderResults();toast('修改已确认，记录已保存在本机。');$('#detail-dialog').close();}
 }});
 $('#detail-content').replaceChildren(el('div',{class:'detail-head'},[el('h2',{text:job.title}),el('button',{text:'×',class:'close-button','aria-label':'关闭职位详情',onClick:()=>$('#detail-dialog').close()})]),body,el('div',{class:'detail-footer'},[link(['listed','notice_open'].includes(status)?'前往官方报名 ↗':'前往官方核对 ↗',job.applyUrl),saveButton]));
 $('#detail-dialog').showModal();$('#detail-dialog').scrollTop=0;
}
function infoCard(title,children){return el('article',{class:'info-card'},[el('h2',{text:title}),...children]);}
function renderOther(){
 const container=$('#other-view');container.replaceChildren();
 if(view==='sources') {
  container.append(el('h1',{text:'每一个机会，都有出处。'}),el('p',{text:'下列均为真实官方来源。公开接口可读取与获得持续聚合、转载许可是两件事；当前定时更新与公开运营尚未开启。'}));
  const grid=el('div',{class:'info-grid'});
  for(const s of dataset.sources){const run=dataset.sourceRuns.find(r=>r.sourceId===s.id),count=dataset.jobs.filter(j=>j.sourceId===s.id).length;grid.append(infoCard(s.name,[el('div',{class:'source-kpi'},[String(count),el('small',{text:'条收录记录'})]),el('p',{text:run?.status==='ok'?`成功读取于 ${formatDate(run.checkedAt,true)}；只确认官方列表状态。`:run?.error?`最近读取失败：${run.error}`:'人工事实记录，尚无报名状态成功核验。'}),el('p',{text:s.permissionStatus}),el('p',{text:`自动更新：${s.automatedAllowed?'已配置允许':'未开启'} · 公开再发布：${s.redistributionAllowed?'已记录使用依据':'待确认使用依据'}`}),link('打开官方招聘网站 ↗',s.officialUrl,'source-link'),s.docsUrl?link('查看接口文档 ↗',s.docsUrl,'source-link'):null].filter(Boolean)));}
  grid.append(infoCard('更多国内招聘来源',[el('p',{text:'国聘、各央企/国企招聘网站及民企官网优先。国聘内容再使用存在协议限制，未经同意不启用自动抓取。BOSS直聘、智联、前程无忧等不在自动采集范围。'}),link('国聘官方入口 ↗','https://www.iguopin.com/','source-link'),el('p',{text:'源码交付中的「docs/02-数据来源.md」列有接入规则与核验记录。'})]));container.append(grid);
 } else if(view==='local') {
  container.append(el('h1',{text:'你的求职记录，由你保管。'}),el('p',{text:'数据保存在当前浏览器、当前网址下。清理浏览器数据、换设备或换网址不会自动迁移，请先导出备份。备份包含私人标签和备注，不要放入公开仓库。'}));
  if(storageError)container.append(el('div',{class:'notice error',text:storageError}));
  const orphanCount=Object.keys(privateData.records).filter(id=>!dataset.jobs.some(j=>j.id===id)).length;
  const controls=[el('p',{text:`已保存 ${Object.keys(privateData.records).length} 条岗位记录，${privateData.savedSearches.length} 个筛选。${orphanCount?`其中 ${orphanCount} 条岗位已不在当前数据，仍保留本机记录。`:''}`}),el('button',{class:'secondary',text:'导出我的备份',onClick:exportPrivate}),el('button',{class:'secondary',text:'导入备份',onClick:()=>$('#import-file').click()})];
  if(damagedRaw!==null)controls.push(el('button',{class:'secondary',text:'导出损坏的原始记录',onClick:()=>download(damagedRaw,'求职工作台-原始记录.private.json')}));
  container.append(el('div',{class:'info-grid'},[
   infoCard('备份与恢复',controls),infoCard('隐私边界',[el('p',{text:'本站没有账号、远程字体、广告或分析脚本。个人记录不会通过本站上传。托管服务可能保留访问 IP 日志；点击报名后适用官方招聘站自己的隐私政策。'}),el('p',{text:'本机存储未加密。同一浏览器用户或恶意扩展可能访问；请勿在备注中保存证件、密码或其他敏感材料。'}),el('p',{text:'简历资料接口已在源码中预留；首版不收集、上传简历，不自动填写或提交申请。'})]),
   infoCard('保存过的筛选',[...privateData.savedSearches.map(s=>el('button',{class:'secondary',text:s.name,onClick:()=>loadSearch(s)})),!privateData.savedSearches.length?el('p',{text:'在职位页选择条件后，点击「保存条件」。'}):null].filter(Boolean)),
   infoCard('清空当前浏览器记录',[el('p',{text:'只清除本站本机收藏、进度、标签、备注和筛选。此操作无法撤销，建议先导出备份。'}),el('button',{class:'secondary danger',text:'清空本机记录',onClick:async()=>{if(!await action('确认清空本机记录','删除当前浏览器内本站的全部个人记录。请先导出备份；此操作无法撤销。',{confirm:'确认清空'}))return;try{localStorage.removeItem(KEY);privateData=EMPTY_PRIVATE();damagedRaw=null;storageError='';renderSidebar();renderOther();toast('本站本机记录已清空');}catch(e){toast(`清空失败：${e.message}`);}}})])
  ]));
 } else {
  container.append(el('h1',{text:'从发现机会，到认真投递。'}),el('p',{text:'这是能够运行的真实数据研究版本。数据来自已记录的官方来源，并非覆盖全国的招聘库；公开部署和持续更新还需通过数据许可、合规与网络验收。'}),el('div',{class:'info-grid'},[
   infoCard('第一次使用',[el('ol',{class:'help-steps'},['搜索职位、公司或城市；中文「工程师 北京」也能找到英文岗位。','打开组合筛选，选择地区、类型、薪资等条件，点击「应用筛选」。','金额单位为元；先选币种与月/年/时/日周期，再输入区间。','点职位标题看事实、时间和状态，再去官方报名；网站不会替你提交。','收藏、记投递进度和标签，点击「保存本机记录」。','在本机数据页导出备份；保存筛选可一键复用。'].map(t=>el('li',{text:t})))]),
   infoCard('如何理解状态',[el('p',{text:'「核验时在招」表示成功读取官方列表时仍在列；「公告报名期内」基于明确的起止日期，均不保证资格或提交成功。'}),el('p',{text:'没有截止日期显示未披露。快照超过 72 小时自动标为核验已过期；到期记录标已截止。请求失败不会刷新成功核验时间。'}),el('p',{text:'报名状态与个人投递进度各自独立。没有学历、专业、经验或薪资时，不会替来源补全。'})]),
   infoCard('免费与开源',[el('p',{text:'源码 MIT，无付费 API 或自建服务器依赖。第三方招聘信息不随代码自动取得 MIT 许可。首选部署是 Cloudflare Pages + GitHub Actions；免费额度、访问稳定性和规则可能变动。'}),el('p',{text:'全部交付文档位于项目 docs 目录。公开运营前请完成来源使用依据、属地资质/备案核实与大陆三网访问测试。免费不代表不需要合规。'})]),
   infoCard('更新岗位',[el('p',{text:'研究快照不是实时搜索引擎。手动运行项目中的「更新真实岗位.cmd」会从已列出的三个公开接口进行一次核验；只请求职位事实，不访问私人数据。'}),el('p',{text:'定时工作流已提供但默认未启用。来源许可尚未确认时默认更新命令会明确停止，避免自动发布研究数据。'}),el('p',{text:'缺少条件时宁可显示暂无结果，不使用虚构岗位填充。'})])
  ]));
 }
}
async function importFile(file){
 if(!file)return;try{
  if(file.size>5*1024*1024)throw new Error('文件超过 5 MB，请检查是否为本站备份');
  const incoming=validateBackup(JSON.parse(await file.text()));
  if(!await action('导入本机备份',`将合并 ${Object.keys(incoming.records).length} 条记录与 ${incoming.savedSearches.length} 个筛选。同一岗位以备份为准，其他记录保留。${damagedRaw?'原始损坏记录将被替换，请先导出保全。':''}`,{confirm:'确认导入'}))return;
  const records={...privateData.records,...incoming.records},searches=new Map(privateData.savedSearches.map(s=>[s.id,s]));for(const s of incoming.savedSearches)searches.set(s.id,s);
  const oldDamage=damagedRaw;damagedRaw=null;
  if(savePrivate({...EMPTY_PRIVATE(),records,savedSearches:[...searches.values()]})){if(view==='local')renderOther();else renderResults();toast('导入完成，记录已保存在本机');}else damagedRaw=oldDamage;
 }catch(e){toast(`无法导入：${e.message}`);}finally{$('#import-file').value='';}
}
async function init(){
 readPrivate();setupFilters();renderSidebar();fillFilters();
 document.querySelectorAll('[data-view]').forEach(n=>n.addEventListener('click',()=>setView(n.dataset.view)));
 $('#search-form').addEventListener('submit',e=>{e.preventDefault();applyFilters();});
 $('#filters').addEventListener('submit',e=>{e.preventDefault();applyFilters();});
 $('#reset-filters').addEventListener('click',resetFilters);$('#sort').addEventListener('change',()=>{filters.sort=$('#sort').value;page=1;renderResults();});
 $('#mobile-filters').addEventListener('click',()=>{const open=$('.filters-shell').classList.toggle('open');$('#mobile-filters').setAttribute('aria-expanded',String(open));$('#mobile-filters span').textContent=open?'收起 ↑':'展开 ↓';});
 $('#import-file').addEventListener('change',e=>importFile(e.target.files[0]));
 $('#save-search').addEventListener('click',async()=>{if(!applyFilters())return;if(privateData.savedSearches.length>=100){toast('最多保存 100 个筛选，请先删除不需要的条件。');return;}const answer=await action('保存常用筛选','搜索词、薪资和其他组合条件都将保存在本机。',{input:true,value:filters.q||'我的筛选',confirm:'保存'});if(!answer)return;const name=answer.value.trim();if(!name){toast('请输入筛选名称');return;}const n=structuredClone(privateData);n.savedSearches.push({id:crypto.randomUUID(),name,filters:structuredClone(filters)});if(savePrivate(n))toast('筛选已保存，可在侧栏或本机数据页再次载入。');});
 document.querySelectorAll('[data-quick]').forEach(button=>button.addEventListener('click',()=>{const k=button.dataset.quick;if(k==='mainland')filters.regionScopes=filters.regionScopes?.includes('中国大陆')?[]:['中国大陆'];if(k==='salary')filters.salaryDisclosure=filters.salaryDisclosure==='disclosed'?'':'disclosed';if(k==='deadline')filters.deadlineDays=filters.deadlineDays==='7'?'':'7';if(k==='unknown')filters.status=filters.status?'':'active';page=1;fillFilters();renderResults();}));
 try {
  const response=await fetch('./data/jobs.json',{cache:'no-cache'});if(!response.ok)throw new Error(`读取职位文件失败（${response.status}）`);const data=await response.json();
  if(data.schemaVersion!==1||!Array.isArray(data.jobs)||!data.jobs.length||!Array.isArray(data.sources))throw new Error('岗位文件为空或版本不支持');
  dataset=data;
  const currencySelect=$('select[name="currency"]'),known=new Set([...currencySelect.options].map(o=>o.value));
  for(const currency of [...new Set(dataset.jobs.flatMap(j=>j.salary.ranges.map(r=>r.currency)))].sort())if(!known.has(currency))currencySelect.append(el('option',{text:currency,value:currency}));
  renderResults();if(storageError)toast(storageError);
 }catch(e){$('#load-error').hidden=false;$('#load-error').replaceChildren(`未能加载岗位：${e.message}。请用启动脚本或静态服务器打开。`,el('button',{text:'重新加载',onClick:()=>location.reload()}));$('#result-count').textContent='岗位数据暂不可用';}
}
init();
