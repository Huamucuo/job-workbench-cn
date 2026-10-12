(()=>{
'use strict';
if(globalThis.JobAutofillEngine?.version==='0.3.0')return;
const R=globalThis.JobAutofillRules;
let session=null,preparing=false;
const pendingAdds=new Map();
const clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,300);
const visible=e=>e.isConnected&&!e.closest('[hidden],[inert],[data-autofill-ui]')&&getComputedStyle(e).visibility!=='hidden'&&e.getClientRects().length>0;
const heading=e=>clean(e.querySelector(':scope > legend,:scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > caption')?.textContent||e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' '));
function labelText(node){const copy=node.cloneNode(true);copy.querySelectorAll('input,select,textarea,button,script,style').forEach(n=>n.remove());return clean(copy.textContent);}
function label(e){
 const aria=e.getAttribute('aria-labelledby');
 if(aria){const s=clean(aria.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' '));if(s)return s;}
 return clean(e.getAttribute('aria-label')||Array.from(e.labels||[]).map(labelText).join(' ')||e.getAttribute('placeholder')||e.name||'未命名字段');
}
function groupContainer(e,tableCache=new Map()){
 let result=null;
 for(let p=e.parentElement;p&&p.tagName!=='FORM';p=p.parentElement){
  if(p.matches('fieldset,[role="group"],section,.experience-row')){
   const title=heading(p),group=R.groupFor(title);
   const specific=!p.matches('section')||/^(教育|学历|education|academic|实习|internship|工作经历|任职经历|employment|work experience|项目经历|project|技能|skills|证书|certificat)/i.test(title);
   const choiceOnly=result&&!result.element.querySelector('input:not([type="radio"]):not([type="checkbox"]),select,textarea');
   if(group&&specific&&(!result||choiceOnly&&result.group===group))result={element:p,group,title};
  }
 }
 // A table's data row can be a record boundary; a generic layout row cannot.
 const row=e.closest('tbody > tr'),table=row?.closest('table');
 if(row&&(!result||result.element.contains(row))){
  const title=heading(table)||result?.title,group=R.groupFor(title);
  if(group){
   let mode=tableCache.get(table);
   if(!mode){
    const rows=Array.from(table.querySelectorAll(':scope > tbody > tr')).map(tr=>Array.from(tr.querySelectorAll('input,textarea,select')).filter(n=>n.closest('tr')===tr)).filter(fields=>fields.length);
    const keys=rows.map(fields=>fields.map(n=>R.inferField({label:label(n),type:kind(n),group,index:0}).path).filter(Boolean));
    const identity=group+'.0.'+{education:'school',internships:'organization',work:'organization',projects:'name',skills:'name',certificates:'name'}[group],flat=keys.flat();
    const outside=result&&Array.from(result.element.querySelectorAll('input,textarea,select')).some(n=>!table.contains(n));
    mode=keys.length&&keys.every(k=>k.length>=2&&new Set(k).size===k.length&&k.includes(identity))&&!outside?'rows':flat.length>=2&&new Set(flat).size===flat.length&&flat.includes(identity)?'single':'ambiguous';
    tableCache.set(table,mode);
   }
   if(mode==='rows')result={element:row,group,title};
   else if(mode==='ambiguous')result={element:table,group,title,ambiguous:true};
   else if(!result)result={element:table,group,title};
  }
 }
 if(result&&result.group!=='skills'&&!result.element.querySelector('input:not([type="radio"]):not([type="checkbox"]),select,textarea'))return null;
 return result;
}
function safetyContext(e){const parts=[];for(let p=e.parentElement;p;p=p.parentElement){if(p.matches('fieldset,[role="group"],[role="region"],section,article,div,table,form')){const title=heading(p);if(title)parts.push(title);}if(p.tagName==='FORM')break;}return parts.join(' / ').slice(0,1200);}
const disabled=e=>e.matches(':disabled')||e.getAttribute('aria-disabled')==='true';
function kind(e){if(e.matches('select'))return e.multiple?'select-multiple':'select-one';if(e.matches('textarea'))return 'textarea';if(e.getAttribute('role')==='combobox')return 'custom';return e.type||'text';}
function readValue(entry){
 const {elements:es,descriptor:f}=entry;
 if(f.type==='radio-group')return es.find(e=>e.checked)?.value||'';
 if(f.type==='checkbox-group')return es.filter(e=>e.checked).map(e=>e.value);
 if(f.type==='select-multiple')return Array.from(es[0].selectedOptions).map(o=>o.value);
 if(f.type==='checkbox')return es[0].checked;
 return es[0].value||'';
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const equalValue=(a,b)=>Array.isArray(a)&&Array.isArray(b)?same([...a].sort(),[...b].sort()):same(a,b);
function describe(es,group,index){
 const e=es[0],type=es.length>1&&['radio','checkbox'].includes(kind(e))?kind(e)+'-group':kind(e)==='radio'?'radio-group':kind(e);
 const options=e.matches('select')?Array.from(e.options).map(o=>({value:o.value,label:clean(o.textContent),disabled:disabled(o)||o.parentElement?.disabled===true})):['radio-group','checkbox-group'].includes(type)?es.map(o=>({value:o.value,label:label(o),disabled:disabled(o)})):[];
 const groupLabel=['radio-group','checkbox-group'].includes(type)?heading(e.closest('fieldset,[role="group"]')||e.parentElement):'';
 return {label:groupLabel||label(e),name:clean(e.name),placeholder:clean(e.getAttribute('placeholder')),type,context:group?.title||'',safetyContext:safetyContext(e),group:group?.group||null,index,autocomplete:e.autocomplete||'',disabled:es.some(disabled)||(type==='select-multiple'&&Array.from(e.selectedOptions).some(disabled)),readOnly:!!e.readOnly,maxLength:e.maxLength||0,options,hasValue:false};
}
function collect(){
 const all=Array.from(document.querySelectorAll('input,textarea,select,[role="combobox"]')).filter(e=>!e.closest('[data-autofill-ui]')&&!['hidden','submit','button','reset'].includes(kind(e)));
 const controls=all.filter(visible),visited=new Set(),containers=new Map(),entries=[],tableCache=new Map(),ambiguousGroups=new Set();
 // Count connected records, including collapsed records, before filtering visible controls.
 for(const e of all){const g=groupContainer(e,tableCache);if(g){if(g.ambiguous)ambiguousGroups.add(g.group);if(!containers.has(g.group))containers.set(g.group,[]);const list=containers.get(g.group);if(!list.includes(g.element))list.push(g.element);}}
 for(const e of controls){
  if(visited.has(e))continue;
  let es=[e];
  if(['radio','checkbox'].includes(kind(e))&&e.name)es=controls.filter(x=>kind(x)===kind(e)&&x.name===e.name&&x.form===e.form&&x.getRootNode()===e.getRootNode());
  es.forEach(x=>visited.add(x));
  const group=groupContainer(e,tableCache);let index=0;
  let ambiguousGroup=false;
  if(group){const list=containers.get(group.group)||[],ordinal=group.title.match(/(?:^|\s|第)(\d{1,2})(?:\s*[条段项])?\s*$/);index=ordinal?Number(ordinal[1])-1:list.indexOf(group.element);ambiguousGroup=!!group.ambiguous||index<0||index>=30||(!ordinal&&(ambiguousGroups.has(group.group)||list.length>1&&list.some(p=>!visible(p))));}
  const descriptor={...describe(es,group,index),ambiguousGroup},entry={elements:es,descriptor,group};
  if(!R.blocked(descriptor)&&descriptor.type!=='custom'){
   entry.initial=readValue(entry);
   descriptor.hasValue=Array.isArray(entry.initial)?entry.initial.length>0:entry.initial!==''&&entry.initial!==false;
  }
  descriptor.id='f'+entries.length;entries.push(entry);
 }
 // Only connect unique native province/city/district controls in the same semantic region.
 // No labels, options or existing values from another form/region are borrowed.
 const areas=new Map();
 for(const entry of entries){
  const f=entry.descriptor,path=R.inferField(f).path;
  if(f.type!=='select-one'||!['contact.province','contact.city','contact.district'].includes(path))continue;
  const e=entry.elements[0],region=e.closest('fieldset,[role="group"],section')||e.form||document.body;
  if(!areas.has(region))areas.set(region,new Map());
  const fields=areas.get(region);if(!fields.has(path))fields.set(path,[]);fields.get(path).push(entry);
 }
 for(const fields of areas.values())for(const [path,parentPath]of [['contact.city','contact.province'],['contact.district','contact.city']]){
  const own=fields.get(path)||[],parent=fields.get(parentPath)||[];
  if(own.length===1&&parent.length===1)own[0].descriptor.cascade={parentId:parent[0].descriptor.id,path};
 }
 return {entries,counts:Object.fromEntries(Array.from(containers,([k,v])=>[k,v.length]))};
}
function scan(){
 if(preparing)throw new Error('经历分组仍在新增，请等待结果再识别');
 const {entries,counts}=collect(),id=crypto.randomUUID();
 const expiresAt=Date.now()+120000;
 session={id,href:location.href,expiresAt,entries,used:false};
 return {scanId:id,scope:location.origin+location.pathname,url:location.origin+location.pathname,title:document.title.slice(0,100),expiresAt,fields:entries.map(e=>e.descriptor),groups:counts,unsupported:{iframes:document.querySelectorAll('iframe').length,shadowHosts:Array.from(document.querySelectorAll('*')).filter(e=>e.shadowRoot).length}};
}
function setNative(e,key,value){
 const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
 const setter=Object.getOwnPropertyDescriptor(proto,key)?.set;
 if(!setter)throw new Error('控件不支持安全赋值');
 setter.call(e,value);
}
function assign(entry,value){
 const {elements:es,descriptor:f}=entry;
 if(['radio-group','checkbox-group'].includes(f.type))es.forEach(e=>setNative(e,'checked',Array.isArray(value)?value.includes(e.value):e.value===value));
 else if(f.type==='select-multiple')Array.from(es[0].options).forEach(o=>{o.selected=value.includes(o.value);});
 else setNative(es[0],'value',value);
 for(const e of es){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
}
function validTarget(entry,allowOptionChanges=false){
 if(entry.elements.some(e=>!visible(e)))return false;
 const live=collect().entries.find(x=>x.elements[0]===entry.elements[0]);
 if(!live||live.descriptor.index!==entry.descriptor.index||live.elements.length!==entry.elements.length||live.elements.some((e,i)=>e!==entry.elements[i]))return false;
 const currentGroup=groupContainer(entry.elements[0]);
 if((currentGroup?.element||null)!==(entry.group?.element||null))return false;
 const current={...live.descriptor},prior={...entry.descriptor};
 delete prior.id;delete prior.hasValue;delete current.id;delete current.hasValue;
 if(allowOptionChanges)current.options=prior.options;
 return same(current,prior)&&!R.blocked(current)&&current.type!=='custom';
}
async function apply(scanId,items){
 const begin=performance.now(),s=session;
 if(!s||s.id!==scanId||s.used||Date.now()>s.expiresAt||location.href!==s.href)throw new Error('页面或预览已变化/过期，请重新识别');
 if(!Array.isArray(items)||items.length>300)throw new Error('填写请求无效');
 s.used=true;const seen=new Set(),results=[],written=new Map(),watches=new Map();
 const entryFor=id=>s.entries.find(e=>e.descriptor.id===id);
 const depth=id=>entryFor(id)?.descriptor.cascade?.path==='contact.district'?2:entryFor(id)?.descriptor.cascade?1:0;
 const ordered=[...items].sort((a,b)=>depth(a?.fieldId)-depth(b?.fieldId));
 for(const item of ordered){
  const entry=entryFor(item?.fieldId);
  if(!item?.deferred||!entry||watches.has(item.fieldId))continue;
  const watch={changed:false};watch.observer=new MutationObserver(()=>{watch.changed=true;});
  watch.observer.observe(entry.elements[0],{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value','label','disabled','selected']});
  watches.set(item.fieldId,watch);
 }
 const parentValid=(parent,seen=new Set())=>{
  if(!parent||seen.has(parent.entry.descriptor.id))return false;
  seen.add(parent.entry.descriptor.id);
  if(!validTarget(parent.entry,!!parent.entry.descriptor.cascade)||!equalValue(readValue(parent.entry),parent.value)||!same(describe(parent.entry.elements,parent.entry.group,parent.entry.descriptor.index).options,parent.options))return false;
  const parentId=parent.entry.descriptor.cascade?.parentId;
  return !parentId||parentValid(written.get(parentId),seen);
 };
 const verifyAnchors=(entry,anchors,seen=new Set())=>{
  const parentId=entry.descriptor.cascade?.parentId;if(!parentId)return true;
  if(seen.has(parentId))return false;seen.add(parentId);
  if(written.has(parentId))return parentValid(written.get(parentId));
  if(items.some(item=>item?.fieldId===parentId)||!Array.isArray(anchors)||anchors.length>3)return false;
  const p=entryFor(parentId),matches=anchors.filter(a=>a?.fieldId===parentId),expected=matches[0]?.value;
  if(!p||matches.length!==1||!p.descriptor.hasValue||typeof expected!=='string'||!validTarget(p)||!same(readValue(p),p.initial)||!same(expected,p.initial))return false;
  const converted=R.convertValue(expected,p.descriptor);
  if(!converted.ok||!same(converted.value,expected)||!verifyAnchors(p,anchors,seen))return false;
  written.set(parentId,{entry:p,value:expected,options:p.descriptor.options,didWrite:false});return true;
 };
 try{
 for(const item of ordered){
  if(!item||typeof item!=='object'){results.push({fieldId:null,label:'未知字段',status:'skipped',reason:'填写请求无效'});continue;}
  const entry=s.entries.find(e=>e.descriptor.id===item.fieldId);
  const result={fieldId:item.fieldId,label:entry?.descriptor.label||'未知字段',status:'skipped',reason:''};results.push(result);
  if(!entry||seen.has(item.fieldId)){result.reason='重复或未知字段';continue;}seen.add(item.fieldId);
  const cascade=entry.descriptor.cascade;
  if(location.href!==s.href||!validTarget(entry,!!item.deferred)||!same(readValue(entry),entry.initial)){result.reason='页面内容已变化，为防错填已跳过';continue;}
  if(entry.descriptor.hasValue&&item.overwrite!==true){result.reason='保留已有内容';continue;}
  let value=item.value;
  if(item.deferred){
   if(!cascade||cascade.path!==item.deferred.path||entry.descriptor.type!=='select-one'||entry.descriptor.hasValue||typeof item.value!=='string'||!item.value.trim()||item.value.length>120){result.reason='级联请求不符合原预览，已跳过';continue;}
   const parent=written.get(cascade.parentId),watch=watches.get(item.fieldId);
   if(!parent?.didWrite){result.reason='上级地区未在本次成功填写，请先核对上级或手工选择';continue;}
   const observation=await observeStable(()=>{
    if(location.href!==s.href||!validTarget(entry,true)||!same(readValue(entry),entry.initial)||!parentValid(parent))return {status:'stop',reason:'等待期间页面、上级或已有内容变化，已停止级联'};
    if(!watch.changed)return {status:'waiting'};
    const live=describe(entry.elements,entry.group,entry.descriptor.index),converted=R.convertValue(item.value,live,cascade.path);
    if(!converted.ok)return {status:'waiting'};
    return {status:'ready',stamp:JSON.stringify(live.options),value:converted.value};
   });
   if(!observation.ok){result.reason=observation.reason==='等待超时，请核对页面并重新识别；仍未出现的部分请人工处理'?'地区选项缺失、重复或加载超时，请人工核对':observation.reason;continue;}
   value=observation.value;
  }else{
   const converted=R.convertValue(value,entry.descriptor);
   if(!converted.ok||!same(converted.value,value)){result.reason='值不符合控件要求';continue;}
   if(cascade&&items.some(i=>i?.fieldId===cascade.parentId)){result.reason='上级将刷新选项，请重新识别后使用级联预览';continue;}
   if(cascade&&!verifyAnchors(entry,item.anchors)){result.reason='已有上级与档案不一致或已变化，请人工核对地区';continue;}
  }
  try{
   // Require a child option mutation after its own parent was written; stale choices are never used.
   for(const [id,watch]of watches)if(entryFor(id)?.descriptor.cascade?.parentId===item.fieldId)watch.changed=false;
   assign(entry,value);
   await new Promise(resolve=>setTimeout(resolve,40));
   if(location.href!==s.href||!entry.elements.every(visible)){result.reason='填写后页面变化，请人工核对';continue;}
   if(!equalValue(readValue(entry),value)){result.reason='页面未保留填写值，请人工核对';continue;}
   written.set(item.fieldId,{entry,value,options:describe(entry.elements,entry.group,entry.descriptor.index).options,didWrite:true});
   result.status='filled';result.reason='已回读确认';
  }catch{result.reason='网站拒绝写入，请人工核对';}
 }
 for(const result of results){const record=written.get(result.fieldId);if(result.status==='filled'&&!parentValid(record)){result.status='skipped';result.reason='后续页面更新改变了已填内容，请人工核对';}}
 return {results,durationMs:Math.round(performance.now()-begin),filled:results.filter(r=>r.status==='filled').length,attempted:items.length,automaticSubmitRequested:false};
 }finally{for(const watch of watches.values())watch.observer.disconnect();}
}
async function observeStable(inspect,{timeoutMs=3500,stableMs=200}={}){
 const start=performance.now();let stamp=null,since=start;
 while(performance.now()-start<timeoutMs){
  const state=inspect(),now=performance.now();
  if(state.status==='stop')return {...state,ok:false};
  if(state.status==='ready'){
   if(stamp!==state.stamp){stamp=state.stamp;since=now;}
   if(now-since>=stableMs)return {...state,ok:true};
  }else{stamp=null;since=now;}
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 return {ok:false,reason:'等待超时，请核对页面并重新识别；仍未出现的部分请人工处理'};
}
async function prepareGroups(counts){
 if(preparing)throw new Error('正在等待经历新增，请勿重复操作');
 preparing=true;session=null;const result=[],href=location.href;
 try{
 const wanted=Object.fromEntries(Object.entries(counts||{}).filter(([k,v])=>['education','internships','work','projects','skills','certificates'].includes(k)&&Number.isInteger(v)&&v>=0&&v<=30));
 let clicks=0;
 for(const [group,count]of Object.entries(wanted)){
  if(location.href!==href){result.push({group,reason:'页面已导航，整个新增操作已停止'});break;}
  let before=collect().counts[group]||0;
  const pending=pendingAdds.get(group);
  if(pending){
   if(pending.href!==href||before===pending.before+1)pendingAdds.delete(group);
   else{result.push({group,count:before,wanted:count,reason:'上次新增尚未确认，未重复点击；请等待或手工检查新增结果'});continue;}
  }
  while(before<count&&clicks<5){
   if(location.href!==href){result.push({group,reason:'页面已导航，整个新增操作已停止'});return {clicks,groups:result};}
   if(collect().entries.some(e=>e.descriptor.group===group&&e.descriptor.ambiguousGroup)){result.push({group,reason:'记录边界或顺序不明确，请先手工整理经历'});break;}
   const candidates=Array.from(document.querySelectorAll('button[type="button"]')).filter(b=>visible(b)&&!b.disabled&&/^(新增|添加|增加|add)\s*/i.test(clean(b.textContent))&&R.groupFor(clean(b.textContent))===group&&!/提交|申请|确认|下一步|submit|apply|next|confirm/i.test(clean(b.textContent)));
   if(candidates.length!==1){result.push({group,reason:'没有唯一且安全的新增按钮；请手工添加'});break;}
   if(location.href!==href){result.push({group,reason:'页面已导航，整个新增操作已停止'});return {clicks,groups:result};}
   pendingAdds.set(group,{before,href});candidates[0].click();clicks++;
   const observation=await observeStable(()=>{
    if(location.href!==href)return {status:'stop',reason:'页面已导航，已停止新增'};
    const snapshot=collect(),after=snapshot.counts[group]||0;
    if(after===before)return {status:'waiting'};
    if(after!==before+1)return {status:'stop',reason:'新增数量不符合预期，已停止；请人工核对记录顺序'};
    return {status:'ready',count:after,stamp:JSON.stringify(snapshot.entries.filter(e=>e.descriptor.group===group).map(e=>e.descriptor))};
   });
   if(!observation.ok){result.push({group,reason:observation.reason});break;}
   pendingAdds.delete(group);before=observation.count;
  }
  result.push({group,count:before,wanted:count,...(before<count&&clicks>=5?{reason:'本次最多新增5组；请核对后再次准备或手工添加'}:{})});
 }
 return {clicks,groups:result};
 }finally{preparing=false;}
}
globalThis.JobAutofillEngine=Object.freeze({version:'0.3.0',scan,apply,prepareGroups});
})();
