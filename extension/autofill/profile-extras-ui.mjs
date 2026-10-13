import {ABOUT_FIELDS,SECTIONS,DESCRIPTION_SECTIONS,createAttachment,attachmentBytes} from './profile.mjs';
import {addProfileVariant,removeProfileVariant} from './profile-editor-state.mjs';
import {el} from './ui.mjs';

export function renderProfileExtras(root,{profile,canEdit,isCurrent,onChange,onBusy,say}){
 const changed=()=>onChange(true);
 const variants=el('section',{class:'af-card',id:'profile-variants'},[el('h2',{text:'描述版本 · 同一份真实资料'}),el('p',{class:'af-small',text:'为不同岗位整理已有经历的表述。这里只能编辑自我介绍与经历描述；姓名、机构、职位和日期共同使用基础资料。请自行核对每段表述，不新增未经证实的成果。'})]);
 const select=el('select',{id:'variant-select','aria-label':'填写时使用的描述版本'});
 select.append(el('option',{value:'',text:'基础表述'}),...(profile.variants||[]).map(variant=>el('option',{value:variant.id,text:variant.name})));select.value=profile.activeVariantId||'';
 select.addEventListener('change',()=>{if(!canEdit())return;profile.activeVariantId=select.value;changed();});
 const name=el('input',{id:'new-variant-name',maxlength:80,'aria-label':'新描述版本名称',placeholder:'例如：数据分析岗位'});
 variants.append(el('label',{class:'af-field'},['填写时使用',select]),el('div',{class:'af-variant-create'},[name,el('button',{id:'add-variant',type:'button',class:'af-button secondary',text:'复制当前表述为新版本',onClick:()=>{if(!canEdit())return;try{addProfileVariant(profile,name.value);changed();say('已建立描述版本草稿。请核对表述并确认保存。');}catch(error){say(error.message,true);}}})]));
 const selected=profile.variants?.find(variant=>variant.id===profile.activeVariantId);
 if(selected){
  const rename=el('input',{id:'variant-name',maxlength:80,'aria-label':'当前描述版本名称'});rename.value=selected.name;rename.addEventListener('input',()=>{if(!canEdit())return;selected.name=rename.value;onChange(false);});
  variants.append(el('div',{class:'af-section-head'},[el('label',{class:'af-field'},['当前版本名称',rename]),el('button',{id:'remove-variant',type:'button',class:'af-button danger',text:'移除此版本（待保存）',onClick:()=>{if(!canEdit())return;removeProfileVariant(profile,selected.id);changed();}})]));
  const wording=(label,value,onInput,attrs={})=>{const input=el('textarea',{'aria-label':label,maxlength:6000,...attrs});input.value=value;input.addEventListener('input',()=>{if(!canEdit())return;onInput(input.value);onChange(false);});return el('label',{class:'af-field wide'},[label,input]);};
  for(const[key,label]of ABOUT_FIELDS)variants.append(wording('当前版本 · '+label,selected.about?.[key]??profile.about?.[key]??'',value=>{selected.about??={};selected.about[key]=value;},{'data-variant-about':key}));
  for(const section of DESCRIPTION_SECTIONS)for(const[rowIndex,row]of (profile[section]||[]).entries()){
   const title=SECTIONS[section].label+' '+(rowIndex+1)+' · '+(row.organization||row.name||'名称待补充'),entry=selected.descriptions.find(entry=>entry.section===section&&entry.recordId===row.id);
   variants.append(el('details',{class:'af-variant-wording'},[el('summary',{text:title+' · 描述表述'}),el('p',{class:'af-small',text:'机构/项目、职位和日期沿用基础资料；此处只编辑描述。'}),wording('当前版本 · '+title,entry?.description??row.description??'',value=>{let target=selected.descriptions.find(entry=>entry.section===section&&entry.recordId===row.id);if(!target){target={section,recordId:row.id,description:''};selected.descriptions.push(target);}target.description=value;},{'data-variant-record':row.id})]));
  }
 }else variants.append(el('p',{class:'af-small',text:'当前填写使用基础表述。新版本会复制当前文字，所有编辑在确认保存后生效。'}));
 root.append(variants);

 const attachments=el('section',{class:'af-card',id:'profile-attachments'},[el('div',{class:'af-section-head'},[el('h2',{text:'加密附件 · '+(profile.attachments?.length||0)+' / 2 份'})]),el('p',{class:'af-small',text:'保存简历或补充材料原件，最多2份、每份512 KiB、内容合计1 MiB。附件随加密档案备份与恢复；下载后由你选择招聘页上传，不会自动上传。'})]);
 const input=el('input',{id:'attachment-file',type:'file',hidden:true,'aria-label':'选择本机附件'}),button=el('button',{id:'add-attachment',class:'af-button secondary',type:'button',text:'＋ 从本机添加附件',disabled:(profile.attachments?.length||0)>=2,onClick:()=>{if(canEdit())input.click();}});
 input.addEventListener('change',async()=>{
  const file=input.files[0];input.value='';if(!file||!canEdit())return;onBusy(true);
  try{const item=await createAttachment(file,profile.attachments||[]);if(!isCurrent())return;profile.attachments??=[];profile.attachments.push(item);changed();say('附件已加入草稿，确认保存后随档案加密。');}
  catch(error){say('未加入附件：'+error.message,true);}finally{onBusy(false);}
 });attachments.append(button,input);
 if(!profile.attachments?.length)attachments.append(el('p',{class:'af-empty',text:'尚未保存附件。已导入简历的文字来源可在上方查看。'}));
 for(const item of profile.attachments||[])attachments.append(el('div',{class:'af-attachment'},[
  el('div',{},[el('strong',{text:item.name}),el('p',{class:'af-small',text:(item.size/1024).toFixed(1)+' KiB · '+item.type}),el('details',{},[el('summary',{text:'查看完整性校验信息'}),el('code',{class:'af-attachment-hash',text:'SHA256 '+item.sha256})])]),
  el('div',{class:'af-actions'},[el('button',{type:'button',class:'af-button secondary','data-attachment-download':item.id,text:'校验并下载原件',onClick:async()=>{if(!canEdit())return;onBusy(true);try{const bytes=await attachmentBytes(item);if(!isCurrent())return;const url=URL.createObjectURL(new Blob([bytes],{type:item.type})),link=el('a',{href:url,download:item.name});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('已校验并下载附件原件。');}catch(error){say('未下载：'+error.message,true);}finally{onBusy(false);}}}),el('button',{type:'button',class:'af-button danger','data-attachment-remove':item.id,text:'移除（待保存）',onClick:()=>{if(!canEdit())return;profile.attachments=profile.attachments.filter(attachment=>attachment.id!==item.id);changed();}})])
 ]));root.append(attachments);
}
