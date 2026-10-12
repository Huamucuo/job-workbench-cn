import {CONTACT_FIELDS,SECTIONS,newRecord,validateProfile} from './profile.mjs';
const norm=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const primary=s=>s==='education'?'school':['work','internships'].includes(s)?'organization':'name';
const signature=(s,v)=>JSON.stringify(SECTIONS[s].fields.map(([k])=>norm(v[k])));
const identity=(s,v)=>[norm(v[primary(s)]),norm(v.startDate||v.date)].join('|');
export function appendSeparateRecord(plan,group){
 if(!plan.records.includes(group))throw new Error('经历候选已失效');
 const option=group.options.find(o=>o.id===group.selected);if(!option)throw new Error('请先选择要单独保留的候选');
 plan.records.push({id:'separate-'+crypto.randomUUID(),section:group.section,identity:null,current:null,ambiguous:false,options:[structuredClone(option)],selected:option.id,status:'new',separate:true});
 group.selected=group.current?'current':'skip';
}
export function createImportPlan(base,documents){
 const docs=documents.filter((d,i,a)=>a.findIndex(x=>x.source.id===d.source.id)===i);
 if(!docs.length)throw new Error('请先选择至少一份可读取的简历');
 const names=[base.contact.name,...docs.flatMap(d=>d.contact.filter(c=>c.key==='name').map(c=>c.value))].filter(Boolean).map(norm);
 const plan={baseline:JSON.stringify(base),documents:docs,contacts:[],records:[],identityConflict:new Set(names).size>1};
 for(const [key,label]of CONTACT_FIELDS){const entries=docs.flatMap(d=>d.contact.filter(c=>c.key===key));if(!entries.length)continue;
  const options=[];for(const c of entries){const found=options.find(o=>norm(o.value)===norm(c.value));if(found)found.evidence.push(c.evidence);else options.push({id:'value-'+options.length,value:c.value,original:c.value,evidence:[c.evidence]});}
  const current=base.contact[key]||'',matching=options.find(o=>norm(o.value)===norm(current));
  plan.contacts.push({key,label,current,options,selected:current||options.length!==1||options[0].evidence.some(e=>e.confidence==='low')?'current':options[0].id,status:matching&&options.length===1?'duplicate':current||options.length>1?'conflict':'new'});
 }
 for(const doc of docs)for(const record of doc.records){const section=record.section;const id=identity(section,record.values);if(!norm(record.values[primary(section)]))continue;
  let group=plan.records.find(g=>g.section===section&&g.identity===id);
  if(!group){const existing=base[section].filter(r=>identity(section,r)===id);group={id:'record-'+plan.records.length,section,identity:id,current:existing.length===1?structuredClone(existing[0]):null,ambiguous:existing.length>1,options:[],selected:'skip',status:'new'};plan.records.push(group);}
  const sig=signature(section,record.values);let opt=group.options.find(o=>signature(section,o.values)===sig);
  if(opt){for(const[k,e]of Object.entries(record.evidence))(opt.evidence[k]??=[]).push(e);}
  else group.options.push({id:'option-'+group.options.length,values:{...record.values},original:{...record.values},evidence:Object.fromEntries(Object.entries(record.evidence).map(([k,v])=>[k,[v]])),warnings:[...record.warnings],raw:record.raw});
 }
 for(const group of plan.records){const equal=group.current&&group.options.every(o=>signature(group.section,o.values)===signature(group.section,group.current));
  group.status=equal?'duplicate':group.current||group.options.length>1||group.ambiguous?'conflict':'new';
  const low=group.options.some(o=>Object.values(o.evidence).flat().some(e=>e.confidence==='low'));
  group.selected=group.current?'current':group.status==='new'&&!low&&!plan.identityConflict?group.options[0].id:'skip';
 }
 return plan;
}
export function applyImportPlan(base,plan,{confirmed=false,identityConfirmed=false}={}){
 if(!confirmed)throw new Error('请先核对并确认导入结果');
 if(JSON.stringify(base)!==plan.baseline)throw new Error('预览期间档案发生变化。为防止覆盖，请关闭预览后重新选择文件');
 if(plan.identityConflict&&!identityConfirmed)throw new Error('身份信息存在冲突，请先确认这些文件属于同一个人');
 const next=structuredClone(base),history=next.importData||{version:1,sources:[],fields:[],unresolved:[]};next.importData=history;
 for(const doc of plan.documents){if(!history.sources.some(s=>s.id===doc.source.id))history.sources.push(structuredClone(doc.source));for(const u of doc.unresolved)if(!history.unresolved.some(v=>v.sourceId===u.sourceId&&v.line===u.line))history.unresolved.push({...u});}
 const track=(path,refs,edited)=>{history.fields=history.fields.filter(f=>f.path!==path);for(const e of refs||[])history.fields.push({path,...e,reviewed:true,edited});};
 for(const field of plan.contacts){if(field.selected==='current')continue;const option=field.options.find(o=>o.id===field.selected);if(!option)throw new Error('字段选择已失效');next.contact[field.key]=option.value;track('contact.'+field.key,option.evidence,option.value!==option.original);}
 for(const group of plan.records){if(['current','skip'].includes(group.selected))continue;const option=group.options.find(o=>o.id===group.selected);if(!option)throw new Error('经历选择已失效');if(!option.values[primary(group.section)]?.trim())throw new Error(SECTIONS[group.section].label+'缺少机构或名称，请补全或选择不加入');const row={...newRecord(group.section),...option.values,id:group.current?.id||crypto.randomUUID()};
  if(group.current){const i=next[group.section].findIndex(r=>r.id===group.current.id);if(i<0)throw new Error('原经历已变化');next[group.section][i]=row;}else if(!next[group.section].some(r=>signature(group.section,r)===signature(group.section,row)))next[group.section].push(row);else continue;
  for(const[key]of SECTIONS[group.section].fields)track(group.section+'.'+row.id+'.'+key,option.evidence[key],row[key]!==option.original[key]);
 }
 next.updatedAt=new Date().toISOString();return validateProfile(next);
}
