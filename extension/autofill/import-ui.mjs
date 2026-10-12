import {CONTACT_FIELDS,SECTIONS} from './profile.mjs';
import {readResumeFile} from './document-reader.mjs';
import {parseDocument} from './import-parser.mjs';
import {createImportPlan,applyImportPlan,appendSeparateRecord} from './import-merge.mjs';
import {el,message} from './ui.mjs';
const confidence={high:'明确',medium:'需核对',low:'低置信度'};
export function mountResumeImport({getDraft,applyDraft,onActivity,say}){
 const input=document.querySelector('#resume-files'),button=document.querySelector('#import-resume');let dialog=null,controller=null,documents=[],plan=null;
 const reset=()=>{controller?.abort();controller=null;documents=[];plan=null;input.value='';if(dialog){dialog.close();dialog.remove();dialog=null;}};
 button.addEventListener('click',()=>{if(getDraft())input.click();});
 const note=(refs)=>el('p',{class:'ri-source'},(refs||[]).map(e=>{const s=documents.find(d=>d.source.id===e.sourceId)?.source;return `${s?.name||'原文'} · ${s?.type==='pdf'?'第'+e.page+'页 · ':''}第${e.line}行/段 · ${confidence[e.confidence]}\n“${e.quote}”`;}).join('\n'));
 input.addEventListener('change',async()=>{
  const files=[...input.files];input.value='';if(!files.length||!getDraft())return;if(files.length>5){say('每次最多选择5份简历；原资料未改变。',true);return;}reset();controller=new AbortController();const signal=controller.signal;onActivity();
  const status=el('div',{class:'af-message',role:'status',id:'resume-import-status'}),body=el('div',{class:'ri-body'}),footer=el('div',{class:'ri-footer'});
  dialog=el('dialog',{class:'ri-dialog','aria-label':'简历提取预览'},[el('header',{class:'ri-head'},[el('div',{},[el('h2',{text:'先核对，再加入档案'}),el('p',{text:'所有处理都在本机。原简历不会上传；冲突资料不会自动覆盖。'})]),el('button',{class:'af-button secondary',text:'取消并关闭',onClick:reset})]),status,body,footer]);
  dialog.addEventListener('cancel',e=>{e.preventDefault();reset();});document.body.append(dialog);dialog.showModal();const errors=[];
  for(let i=0;i<files.length;i++){message(status,`正在本机读取 ${i+1}/${files.length}：${files[i].name}`);try{const doc=await readResumeFile(files[i],{signal});if(signal.aborted)return;documents.push(parseDocument(doc));}catch(e){if(signal.aborted)return;errors.push(files[i].name+'：'+e.message);}}
  if(signal.aborted||!getDraft())return;controller=null;
  if(!documents.length){message(status,'未提取到可用文字。'+errors.join('；')+'。原档案未改变。',true);return;}
  const ids=new Set();documents=documents.filter(d=>!ids.has(d.source.id)&&ids.add(d.source.id));let selected=new Set(documents.map(d=>d.source.id));
  const rebuild=()=>{try{plan=createImportPlan(getDraft(),documents.filter(d=>selected.has(d.source.id)));render();}catch(e){plan=null;body.replaceChildren(el('p',{text:e.message}));footer.replaceChildren();}};
  function render(){
   body.replaceChildren();footer.replaceChildren();
   const conflictCount=plan.contacts.filter(c=>c.status==='conflict').length+plan.records.filter(c=>c.status==='conflict').length,duplicates=plan.contacts.filter(c=>c.status==='duplicate').length+plan.records.filter(c=>c.status==='duplicate').length;
   message(status,`已读取 ${plan.documents.length} 份：${plan.contacts.length} 项个人资料、${plan.records.length} 组经历；${conflictCount} 项冲突、${duplicates} 项重复。${errors.length?'另有文件未读入：'+errors.join('；'):''}`,Boolean(errors.length));
   const filesBox=el('section',{class:'ri-section'},[el('h3',{text:'文件与原文'}),el('p',{class:'af-small',text:'取消勾选文件可排除错误版本；重新选择文件会重建预览并清除本次预览编辑。置信度为规则提示，不是准确率。'})]);
   for(const doc of documents){const checked=selected.has(doc.source.id),toggle=el('input',{type:'checkbox','aria-label':'使用文件 '+doc.source.name});toggle.checked=checked;toggle.addEventListener('change',()=>{toggle.checked?selected.add(doc.source.id):selected.delete(doc.source.id);if(!selected.size){selected.add(doc.source.id);toggle.checked=true;message(status,'至少保留一份文件；如要取消导入，请点右上角取消。',true);return;}rebuild();});
    filesBox.append(el('details',{class:'ri-file'},[el('summary',{},[el('label',{class:'af-check'},[toggle,doc.source.name+' · '+doc.source.type.toUpperCase()+' · '+doc.source.text.length+' 字'])]),...doc.source.warnings.map(w=>el('p',{class:'ri-warning',text:w})),el('pre',{text:doc.source.text})]));}
   body.append(filesBox);
   const contacts=el('section',{class:'ri-section'},[el('h3',{text:'个人资料 · 保留原值或选择候选'}),el('p',{class:'af-small',text:'姓名、邮箱、手机号请逐项核对。性别、政治面貌和出生日期只提取明确提供的内容。未识别的字段继续留空。'})]);
   for(const field of plan.contacts){const card=el('div',{class:'ri-item'},[el('h4',{text:field.label+' · '+({new:'新增候选',conflict:'有冲突，默认保留',duplicate:'重复，无需覆盖'}[field.status])})]);
    const select=el('select',{'aria-label':field.label+'的来源'});select.append(el('option',{value:'current',text:'保留现有：'+(field.current||'（空白）')}),...field.options.map(o=>el('option',{value:o.id,text:'使用候选：'+o.value})));select.value=field.selected;
    const value=el('input',{'aria-label':'预览修改 · '+field.label,maxlength:field.key==='website'?500:120}),proof=el('div');
    const update=()=>{const o=field.options.find(o=>o.id===field.selected);value.disabled=!o;value.value=o?.value??field.current;proof.replaceChildren(...(o?[note(o.evidence)]:[el('p',{class:'af-small',text:'现有内容保持不变。如需修改，请先选择候选来源。'})]));};
    select.addEventListener('change',()=>{field.selected=select.value;update();});value.addEventListener('input',()=>{const o=field.options.find(o=>o.id===field.selected);if(o)o.value=value.value;});card.append(select,value,proof);update();contacts.append(card);
   }body.append(contacts);
   for(const [section,config]of Object.entries(SECTIONS)){const groups=plan.records.filter(g=>g.section===section);if(!groups.length)continue;const box=el('section',{class:'ri-section'},[el('h3',{text:config.label+' · '+groups.length+' 组'})]);
    groups.forEach((group,index)=>{const card=el('div',{class:'ri-item'},[el('h4',{text:config.label+' '+(index+1)+' · '+({new:'新增候选',duplicate:'与现有重复',conflict:'有冲突，需选择'}[group.status])})]);
     const select=el('select',{'aria-label':config.label+' '+(index+1)+'的处理方式'});if(group.current)select.append(el('option',{value:'current',text:'保留现有经历（不覆盖）'}));else select.append(el('option',{value:'skip',text:'不加入此条'}));
     select.append(...group.options.map((o,i)=>el('option',{value:o.id,text:(group.current?'替换此经历为候选 ':'加入候选 ')+(i+1)+' · '+Object.values(o.values).filter(Boolean).slice(0,3).join(' / ')})));select.value=group.selected;
     const fields=el('div',{class:'af-grid'}),evidence=el('div');
     const update=()=>{fields.replaceChildren();evidence.replaceChildren();const opt=group.options.find(o=>o.id===group.selected),values=opt?.values||group.current;if(values)for(const[key,label]of config.fields){const control=el(key==='description'?'textarea':'input',{'aria-label':'预览修改 · '+config.label+' '+(index+1)+' · '+label,maxlength:key==='description'?6000:200,disabled:!opt});control.value=values[key]||'';control.addEventListener('input',()=>{opt.values[key]=control.value;});fields.append(el('label',{class:'af-field'+(key==='description'?' wide':'')},[label,control]));}
      if(opt){const refs=[...new Map(Object.values(opt.evidence).flat().map(e=>[e.sourceId+':'+e.line,e])).values()];evidence.append(...opt.warnings.map(w=>el('p',{class:'ri-warning',text:w})),el('details',{},[el('summary',{text:'查看此条原始描述与来源'}),note(refs),el('pre',{text:opt.raw})]));}
      if(group.current&&opt)evidence.append(el('details',{open:true},[el('summary',{text:'将被替换的原经历（请核对差异）'}),el('pre',{text:config.fields.map(([key,label])=>label+'：'+(group.current[key]||'（空白）')).join('\n')})]));};
     const separate=el('button',{class:'af-button secondary',text:'将选中候选作为另一段经历保留',disabled:['current','skip'].includes(group.selected),onClick:()=>{try{appendSeparateRecord(plan,group);render();message(status,'已新增独立经历候选，原经历保留。请核对下方新增条目。');}catch(e){message(status,e.message,true);}}});
     select.addEventListener('change',()=>{group.selected=select.value;separate.disabled=['current','skip'].includes(group.selected);update();});card.append(select,fields,evidence);if((group.current||group.options.length>1)&&!group.separate)card.append(el('p',{class:'af-small',text:'若同一单位的不同职位是两段真实经历，可逐个选择候选并单独保留；完全相同的记录仍会去重。'}),separate);update();box.append(card);
    });body.append(box);
   }
   const unknown=plan.documents.flatMap(d=>d.unresolved);if(unknown.length){const details=el('details',{class:'ri-section'},[el('summary',{text:'未识别 / 存在歧义的原文 · '+unknown.length+' 处（保留来源，可手动归类）'})]);
    for(const u of unknown.slice(0,100)){const choose=el('select',{'aria-label':(documents.find(d=>d.source.id===u.sourceId)?.source.name||'')+'第'+u.line+'行的手动归类'});choose.append(el('option',{value:'',text:'选择归类目标'}),...CONTACT_FIELDS.map(([key,label])=>el('option',{value:'contact.'+key,text:'个人资料 · '+label})),...Object.entries(SECTIONS).map(([key,v])=>el('option',{value:key,text:'新增'+v.label})));
     details.append(el('div',{class:'ri-item'},[el('p',{class:'af-small',text:(documents.find(d=>d.source.id===u.sourceId)?.source.name||'')+' · 第'+u.line+'行：'+u.reason}),el('pre',{text:u.text}),choose,el('button',{class:'af-button secondary',text:'加入可编辑候选',onClick:()=>{
      const target=choose.value;if(!target)return;const ref={sourceId:u.sourceId,line:u.line,page:u.page,quote:u.text.slice(0,300),confidence:'low',reason:'用户从未识别原文手动归类'};
      if(target.startsWith('contact.')){const key=target.split('.')[1];let f=plan.contacts.find(c=>c.key===key);if(!f){f={key,label:CONTACT_FIELDS.find(([k])=>k===key)[1],current:getDraft().contact[key]||'',options:[],selected:'current',status:'conflict'};plan.contacts.push(f);}const id='manual-'+crypto.randomUUID();f.options.push({id,value:u.text.slice(0,key==='website'?500:120),original:u.text,evidence:[ref]});f.selected=id;}
      else{const values=Object.fromEntries(SECTIONS[target].fields.map(([k])=>[k,k==='description'?u.text:''])),id='manual-'+crypto.randomUUID();plan.records.push({id,section:target,current:null,options:[{id,values,original:{...values},evidence:Object.fromEntries(SECTIONS[target].fields.map(([k])=>[k,[ref]])),raw:u.text,warnings:['请补全名称、机构和时间；这里只保留你选择的原文，没有推测其他字段']}],selected:id,status:'new'});}
      render();message(status,'已加入可编辑候选。请在对应类别补全和核对，然后确认。');
     }})]));}
    if(unknown.length>100)details.append(el('p',{text:'其余原文保存在文件全文与来源记录中，请在档案中手动补录。'}));body.append(details);
   }
   const reviewed=el('input',{type:'checkbox',id:'resume-reviewed'}),identity=el('input',{type:'checkbox',id:'resume-identity'}),apply=el('button',{class:'af-button',text:'确认所选结果，加入档案草稿',disabled:true});
   if(plan.identityConflict)footer.append(el('label',{class:'af-check ri-warning'},[identity,'检测到不同姓名。我已确认所选文件属于同一个人，且已选择正确身份资料。']));
   footer.append(el('label',{class:'af-check'},[reviewed,'我已核对关键资料、经历顺序与冲突选项。加入草稿后还需点击“确认并加密保存”。']),el('div',{class:'af-actions'},[apply,el('button',{class:'af-button secondary',text:'取消导入',onClick:reset})]));
   const ready=()=>{apply.disabled=!reviewed.checked||(plan.identityConflict&&!identity.checked);};reviewed.addEventListener('change',ready);identity.addEventListener('change',ready);
   apply.addEventListener('click',()=>{try{const next=applyImportPlan(getDraft(),plan,{confirmed:reviewed.checked,identityConfirmed:identity.checked});applyDraft(next);reset();say('导入结果已加入统一档案草稿，尚未写入有效档案。请核对并点击底部“确认并加密保存”。');}catch(e){message(status,'未应用：'+e.message+'。原档案未改变。',true);}});
  }
  rebuild();
 });
 return {reset};
}
export function renderImportHistory(root,profile,onClear){
 root.replaceChildren();if(!profile?.importData)return;const data=profile.importData;
 const box=el('details',{class:'af-card'},[el('summary',{text:'导入来源记录 · '+data.sources.length+' 份文件 · '+data.fields.length+' 条字段来源'}),el('p',{class:'af-small',text:'来源文字与档案一起在本机加密保存。原始 DOCX/PDF 文件不保留。清空来源记录不会删除已录入的字段。'})]);
 for(const source of data.sources)box.append(el('details',{class:'ri-file'},[el('summary',{text:source.name+' · '+source.type.toUpperCase()}),el('pre',{text:source.text})]));
 const table=el('div',{class:'ri-history'});for(const f of data.fields){let label=f.path;if(f.path.startsWith('contact.'))label=CONTACT_FIELDS.find(([k])=>k===f.path.split('.')[1])?.[1]||label;else {const[s,id,k]=f.path.split('.');label=SECTIONS[s]?.label+' '+(profile[s].findIndex(r=>r.id===id)+1)+' · '+(SECTIONS[s]?.fields.find(([key])=>key===k)?.[1]||k);}const source=data.sources.find(s=>s.id===f.sourceId);table.append(el('p',{text:label+' ← '+source?.name+' · 第'+f.line+'行/段 · '+confidence[f.confidence]+(f.edited?' · 已人工修改':'')+'\n“'+f.quote+'”'}));}box.append(table,el('button',{class:'af-button secondary',text:'清空来源历史（字段保留，待保存）',onClick:onClear}));root.append(box);
}
