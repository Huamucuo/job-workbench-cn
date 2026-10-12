import {mountResumeImport,renderImportHistory} from './import-ui.mjs';
import {CONTACT_FIELDS,ABOUT_FIELDS,SECTIONS,createProfile,newRecord,validateProfile,createFictionalProfile} from './profile.mjs';
import {updateProfileField,removeProfileRecord,moveProfileRecord,confirmProfileSources,profileReviewStatus} from './profile-editor-state.mjs';
import {renderProfileExtras} from './profile-extras-ui.mjs';
import {probeBridge,sharedMode} from './bridge-client.mjs';
import {VAULT_KEY,DRAFT_KEY,storage,encryptProfile,decryptProfile,encryptDraft,decryptDraft,validateEnvelope,downloadJson,isExtension} from './vault.mjs';
import {el,message} from './ui.mjs';
import {readRecoveries,addRecovery,removeRecovered} from './recoveries.mjs';
const $=s=>document.querySelector(s),status=$('#profile-status');
let requireExplicitSave=false;
let recovered=null;let draft=null,pass='',envelope=null,pending=null,idle=null,dirty=false,busy=false,leaving=false,gateReady=false;
const importer=mountResumeImport({getDraft:()=>busy||leaving?null:draft,applyDraft:next=>{draft=next;requireExplicitSave=true;markDirty();render();},saveDraft:async()=>{if(!await save())throw new Error(status.textContent.replace(/^未保存：/,''));return true;},savedMessage:()=>isExtension()||sharedMode()?'导入并加密保存成功。扩展现在可以使用这份已确认的档案。':'导入并加密保存成功。当前为本机离线档案，可在首页选择与扩展共用。',onActivity:touch,say:(text,bad)=>say(text,bad)});
function setBusy(value){busy=value;$('#editor').inert=value;$('#profile-controls').inert=value;$('#vault-gate').inert=value;}
async function ask(text){return new Promise(resolve=>{const dialog=el('dialog',{class:'af-dialog'});const close=value=>{dialog.close();dialog.remove();resolve(value);};dialog.append(el('h2',{text:'确认修改'}),el('p',{text}),el('div',{class:'af-actions'},[el('button',{type:'button',class:'af-button',text:'确认继续',onClick:()=>close(true)}),el('button',{type:'button',class:'af-button secondary',text:'取消',onClick:()=>close(false)})]));dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});document.body.append(dialog);dialog.showModal();});}
async function loadRecoveries(selectLatest=false){const list=readRecoveries(await storage.get(DRAFT_KEY)),select=$('#recovery-list');select.replaceChildren(el('option',{value:'',text:'选择一份加密恢复草稿'}),...list.map((r,i)=>el('option',{value:r.id,text:'草稿 '+(i+1)+' · '+(r.createdAt?new Date(r.createdAt).toLocaleString():'历史草稿')})));select.hidden=!list.length;if(selectLatest&&list.length){recovered=list[0];pending=recovered.envelope;select.value=recovered.id;}updateGateActions();return list;}
function say(text,bad=false){message(status,text,bad);}
function updateGateActions(){const hasArchive=Boolean(envelope||pending);$('#start-resume-import').hidden=!gateReady||hasArchive;$('#unlock').hidden=gateReady&&!hasArchive;$('#profile-gate-title').textContent=gateReady&&!hasArchive?'从已有简历开始':'解锁统一档案';$('#gate-first-help').textContent=gateReady&&!hasArchive?'先设置至少12字符的口令，再点击“导入已有简历”。核对预览后，一次确认导入并加密保存。':'输入口令解锁后，可以导入新的 PDF / DOCX 简历或继续编辑。已有加密文件请使用“恢复加密备份”。';}
function markDirty(){dirty=true;requireExplicitSave=true;$('#save-state').textContent='草稿有修改，待确认保存';renderReview();touch();}
function touch(){clearTimeout(idle);if(draft&&!leaving)idle=setTimeout(()=>lock(true),5*60*1000);}
function renderReview(){
 const root=$('#profile-review');if(!root)return;root.replaceChildren();if(!draft)return;
 const review=profileReviewStatus(draft);
 root.append(el('strong',{text:dirty?'修改待确认保存':'当前有效档案'}),el('p',{text:review.missing.length?'常用资料待补充：'+review.missing.join('、')+'。未填写时会跳过对应表单。':'姓名、邮箱和手机已录入。请按原资料核对。'}));
 if(review.pending)root.append(el('p',{class:'ri-warning',text:review.pending+' 项来源字段经过编辑，待你核对并确认保存。'}));
 if(review.unresolved)root.append(el('p',{class:'ri-warning',text:review.unresolved+' 处原文尚未归类；可在来源记录中查看并手动补充。'}));
}
async function refreshStorageBanner(knownState=null){
 const banner=$('#profile-storage-state');if(!banner)return;
 if(isExtension()){message(banner,'当前资料位置：扩展加密主档案。保存后，填写扩展使用同一份资料。');return;}
 if(!sharedMode()){message(banner,'当前资料位置：本机离线档案。返回首页连接扩展并选择共享档案，或用加密备份迁移。');return;}
 try{const state=knownState||await probeBridge();message(banner,state.connected?'当前资料位置：扩展加密主档案。连接已批准，工作台与扩展共同维护这份档案。':'已选共享档案，但连接尚未批准或已失效。请到扩展弹窗批准连接；保存会等待有效连接，不会改存到另一份资料。',!state.connected);}catch(error){message(banner,'共享档案暂不可访问：'+error.message,true);}
}
function render(){
 updateGateActions();
 $('#vault-gate').hidden=Boolean(draft);$('#editor').hidden=!draft;$('#profile-controls').hidden=!draft;
 if(!draft){$('#import-history').replaceChildren();renderReview();return;}
 renderImportHistory($('#import-history'),draft,async()=>{if(await ask('清空导入来源的原文和追溯记录？已录入的个人资料与经历保留。保存前可关闭并恢复原有效档案。建议先导出加密备份。')){delete draft.importData;requireExplicitSave=true;markDirty();render();}});
 $('#fictional-marker').checked=draft.isFictional;
 $('#draft-state').textContent=draft.isFictional?'当前是虚构测试档案，请勿用于真实投递。':'每条经历独立保存；未提供的内容不会在填表时猜测补齐。';
 $('#save-state').textContent=dirty?'草稿有修改，尚未保存':'已加密保存';
 renderReview();const activeDraft=draft;
 const box=$('#profile-fields');box.replaceChildren();
 function field(label,path,value){
  const name=path.split('.').at(-1),long=name==='description'||path.startsWith('about.'),max=long?6000:name==='website'?500:path.startsWith('contact.')?120:200;
  const input=el(long?'textarea':'input',{'data-path':path,autocomplete:'off',maxlength:max,'aria-label':label,type:long?undefined:'text',placeholder:/Date$/.test(name)||name==='date'?'YYYY、YYYY-MM 或 YYYY-MM-DD':['gender','politicalStatus','academicDegree'].includes(name)?'可留空；仅按明确资料填写':''});
  const parts=path.split('.'),stable=parts.length===2?path:parts[0]+'.'+draft[parts[0]][Number(parts[1])].id+'.'+name,refs=(draft.importData?.fields||[]).filter(ref=>ref.path===stable);
  const note=el('small',{class:'af-field-state'}),wrapper=el('label',{class:'af-field'+(long?' wide':'')},[label,input,note]);
  const updateNote=()=>{const empty=!input.value.trim();wrapper.classList.toggle('is-missing',empty);note.textContent=empty?'未提供 · 填写时跳过':refs.length?(refs.some(ref=>!ref.reviewed)?'来源已编辑 · 待核对保存':'已核对来源')+' · '+(draft.importData.sources.find(source=>source.id===refs[0].sourceId)?.name||'原文')+' · 第'+refs[0].line+'行/段':'手动资料 · 按原文核对';};
  input.value=value||'';updateNote();input.addEventListener('input',()=>{if(!draft||busy)return;updateProfileField(draft,path,input.value);markDirty();updateNote();});return wrapper;
 }
 box.append(el('section',{class:'af-card'},[el('h2',{text:'个人资料'}),el('p',{class:'af-small',text:'性别、政治面貌均为选填；只有你输入并确认加密保存后才会使用，留空时不推断。省、市、区填写现居地，不用于户籍或出生地。'}),el('div',{class:'af-grid'},CONTACT_FIELDS.map(([key,label])=>field(label,'contact.'+key,draft.contact[key])))]));
 box.append(el('section',{class:'af-card'},[el('h2',{text:'自我介绍与补充'}),el('p',{class:'af-small',text:'保存你确认过的原文。不同岗位的描述可以在下方创建版本，未提供内容保持空白。'}),el('div',{class:'af-grid'},ABOUT_FIELDS.map(([key,label])=>field(label,'about.'+key,draft.about?.[key])))]));
 for(const[key,section]of Object.entries(SECTIONS)){
  const rows=draft[key]||[],card=el('section',{class:'af-card','data-profile-section':key},[el('div',{class:'af-section-head'},[el('h2',{text:section.label+' · '+rows.length+' 条'}),el('button',{class:'af-button secondary',text:'＋ 添加'+section.label,onClick:()=>{if(busy)return;if(rows.length>=30)return say('每类最多30条',true);draft[key]??=[];draft[key].push(newRecord(key));markDirty();render();}})])]);
  if(key==='education')card.append(el('p',{class:'af-small',text:'学历（本科、硕士等）与学位分别保存。学位未明确提供时留空；多个教育经历不会自动选第一条当作最高学历。'}));
  if(!rows.length)card.append(el('p',{class:'af-empty',text:'暂无记录，可按需要添加；填写时跳过此类。'}));
  rows.forEach((record,index)=>{const name=record.school||record.organization||record.name||'名称待补充',missing=section.fields.filter(([name])=>!record[name]?.trim()).length;
   card.append(el('details',{class:'af-record',open:true,'data-record-id':record.id},[
    el('summary',{class:'af-record-title'},[el('strong',{text:section.label+' '+(index+1)+' · '+name}),el('span',{class:'af-pill'+(missing?' pending':''),text:missing?'有'+missing+'项未提供':'资料已录入'})]),
    el('div',{class:'af-record-head'},[el('span',{class:'af-small',text:[record.startDate||record.date,record.endDate].filter(Boolean).join(' → ')||'日期未提供'}),el('div',{class:'af-record-actions'},[
     el('button',{class:'af-button secondary',text:'上移',disabled:index===0,'aria-label':'上移'+section.label+' '+(index+1),onClick:()=>{if(busy)return;moveProfileRecord(draft,key,record.id,-1);markDirty();render();}}),
     el('button',{class:'af-button secondary',text:'下移',disabled:index===rows.length-1,'aria-label':'下移'+section.label+' '+(index+1),onClick:()=>{if(busy)return;moveProfileRecord(draft,key,record.id,1);markDirty();render();}}),
     el('button',{class:'af-button danger',text:'移除此条（待保存）',onClick:()=>{if(busy)return;removeProfileRecord(draft,key,record.id);markDirty();render();}})
    ])]),el('div',{class:'af-grid'},section.fields.map(([name,label])=>field(section.label+' '+(index+1)+' · '+label,key+'.'+index+'.'+name,record[name])))
   ]));});box.append(card);
 }
 renderProfileExtras(box,{profile:draft,canEdit:()=>draft===activeDraft&&!busy&&!leaving,isCurrent:()=>draft===activeDraft&&!leaving,onChange:rerender=>{markDirty();if(rerender)render();},onBusy:setBusy,say});
}
async function save(){
 if(!draft||busy||leaving)return false;setBusy(true);
 try{
  const candidate=structuredClone(draft);confirmProfileSources(candidate);
  const validated=validateProfile({...candidate,updatedAt:new Date().toISOString()}),next=await encryptProfile(validated,pass);
  if(typeof storage.commitVault==='function'){await storage.commitVault({expectedCiphertext:envelope?.ciphertext??null,next,recovered});envelope=next;}
  else{if(!navigator.locks)throw new Error('此浏览器不支持跨窗口保存保护，请用新版 Chrome / Edge');await navigator.locks.request(VAULT_KEY,async()=>{
   const old=await storage.get(VAULT_KEY);
   if((old?.ciphertext||null)!==(envelope?.ciphertext||null))throw new Error('另一窗口已更新档案。未覆盖它；请先导出当前草稿备份，再重新打开最新档案');
   if(old)await storage.set(VAULT_KEY+'.previous',old);
   await storage.set(VAULT_KEY,next);
   // The valid profile has now committed. Update this tab's baseline before optional draft cleanup.
   envelope=next;
   if(recovered)await storage.set(DRAFT_KEY,removeRecovered(await storage.get(DRAFT_KEY),recovered));
  });}
  if(leaving)return false;draft=validated;pending=null;recovered=null;dirty=false;requireExplicitSave=false;render();$('#save-state').textContent='修改已确认 · 已加密保存';say('保存成功。当前资料位置保持一致；个人内容未发送到服务器。');try{await loadRecoveries();}catch(error){console.warn('档案已保存，但恢复草稿列表未刷新',error);}return true;
 }catch(e){say('未保存：'+e.message,true);refreshStorageBanner();return false;}
 finally{setBusy(false);touch();}
}
async function lock(auto=false){
 if(!draft)return;
 if(busy){if(auto)idle=setTimeout(()=>lock(true),1000);return;}
 let recovery=false,durable=true;
 if(dirty){
  setBusy(true);
  try{pending=await encryptDraft(draft,pass);recovery=true;try{const record={id:crypto.randomUUID(),createdAt:new Date().toISOString(),envelope:pending};await storage.addRecovery({record,recovered});recovered=record;await loadRecoveries();$('#recovery-list').value=record.id;}catch{durable=false;}}
  catch(e){setBusy(false);say('暂不能安全锁定，输入仍保留。请修正或导出备份：'+e.message,true);touch();return;}
  finally{setBusy(false);}
 }
 importer.reset();draft=null;pass='';dirty=recovery&&!durable;clearTimeout(idle);$('#profile-fields').replaceChildren();$('#vault-password').value='';render();
 $('#vault-exists').textContent='档案已锁定。口令不会保留在页面或存储中。';
 say(recovery?(durable?'已锁定。未完成的输入已作为独立加密草稿保留；重新解锁后修正并保存，扩展不会使用无效草稿。':'已锁定。存储已满，恢复草稿仅暂存在此标签页的加密内存中；请勿关闭或刷新，立即解锁并导出备份。'):(auto?'闲置5分钟，已锁定。':'已锁定。再次打开需要口令。'),!durable);
}
$('#unlock').addEventListener('click',async()=>{
 if(busy)return;setBusy(true);
 try{const candidate=pending||envelope;if(!candidate)throw new Error('尚无档案，请新建或选择加密文件');pass=$('#vault-password').value;draft=candidate.kind==='job-workbench-encrypted-draft'?await decryptDraft(candidate,pass):await decryptProfile(candidate,pass);$('#vault-password').value='';dirty=Boolean(pending);requireExplicitSave=Boolean(pending);render();touch();say(pending?'恢复/导入草稿已解锁。修正资料后确认保存，才会替换有效档案。':'档案已解锁。修改后请确认保存。');}
 catch(e){draft=null;pass='';say(e.message,true);}finally{setBusy(false);}
});
async function createBlankDraft(chooseResume=false){
 if(busy)return;setBusy(true);
 try{if(chooseResume&&(!gateReady||envelope||pending))throw new Error('请先解锁现有档案，再导入新的简历');if((envelope||pending)&&!await ask('本机已有档案或恢复草稿。新建后确认保存才替换，旧有效档案保留一版。继续？'))return;pass=$('#vault-password').value;const p=createProfile();await encryptProfile(p,pass);draft=p;requireExplicitSave=false;pending=null;recovered=null;$('#vault-password').value='';dirty=true;render();touch();say(chooseResume?'请选择 PDF / DOCX 简历，核对预览后确认导入并加密保存。':'空白档案已建立在草稿中，请录入资料并保存。');if(chooseResume){setBusy(false);$('#resume-files').click();}}
 catch(e){pass='';say(e.message,true);}finally{setBusy(false);}
}
$('#create').addEventListener('click',()=>createBlankDraft());
$('#start-resume-import').addEventListener('click',()=>createBlankDraft(true));
$('#fictional-marker').addEventListener('change',e=>{if(!draft||busy)return;draft.isFictional=e.target.checked;markDirty();render();});
$('#fictional').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{if(!await ask('载入虚构测试资料会替换当前未保存草稿。仅用于本机验收，继续？'))return;draft=createFictionalProfile();requireExplicitSave=true;markDirty();render();say('已载入虚构资料；姓名、学校、单位和证书均为测试示例。');}finally{setBusy(false);}});
$('#save-profile').addEventListener('click',save);
$('#export-profile').addEventListener('click',async()=>{
 if(busy||!draft)return;setBusy(true);
 try{let file,name='求职档案-加密备份.private.json';try{file=await encryptProfile(draft,pass);}catch{file=await encryptDraft(draft,pass);name='求职档案-待修正草稿.private.json';}downloadJson(file,name);say('已导出加密备份。草稿备份需在档案管理中修正保存，才能交给扩展填写；导出不会覆盖本机有效档案。');}
 catch(e){say('导出失败：'+e.message,true);}finally{setBusy(false);touch();}
});
$('#lock-profile').addEventListener('click',()=>lock());
$('#recovery-list').addEventListener('change',async e=>{const chosen=e.target.value,list=await loadRecoveries();recovered=list.find(r=>r.id===chosen)||null;pending=recovered?.envelope||null;updateGateActions();if(recovered){$('#recovery-list').value=recovered.id;say('已选择加密恢复草稿，请用原口令解锁。');}});
$('#import').addEventListener('click',()=>$('#profile-file').click());
$('#restore-previous').addEventListener('click',async()=>{try{const previous=await storage.get(VAULT_KEY+'.previous');if(!previous)throw new Error('尚无上一版加密档案');validateEnvelope(previous);pending=previous;recovered=null;updateGateActions();say('已选中上一版加密档案，输入那一版口令预览，确认保存后才恢复。');}catch(e){say(e.message,true);}});
$('#profile-file').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw new Error('文件超过5MB限制');const input=JSON.parse(await file.text());validateEnvelope(input,{allowDraft:true});pending=input;recovered=null;updateGateActions();say('已选择加密档案或恢复草稿。输入该文件口令并解锁预览；尚未覆盖本机内容。');}catch(error){say(error.message,true);}finally{e.target.value='';}});
document.addEventListener('keydown',touch);document.addEventListener('pointerdown',touch);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{leaving=true;importer.reset();draft=null;pass='';pending=null;clearTimeout(idle);$('#profile-fields').replaceChildren();$('#vault-password').value='';render();});
window.addEventListener('pageshow',async()=>{leaving=false;try{if(!draft){envelope=await storage.get(VAULT_KEY);await loadRecoveries(true);gateReady=true;updateGateActions();}}catch(error){say('档案暂不可访问：'+error.message,true);}});
if(isExtension()){$('#extension-connection').hidden=true;$('#autofill-help').href='http://127.0.0.1:47841/autofill-start.html';$('#resume-samples').href='http://127.0.0.1:47841/autofill/samples/index.html';$('#workbench-link').href='http://127.0.0.1:47841/';$('#lab-link').href='http://127.0.0.1:47841/autofill/lab/index.html';}
let gateRefreshing=false,wasShared=false,wasConnected=false;
window.addEventListener('job-bridge-status',async event=>{
 refreshStorageBanner(event.detail);const usingShared=sharedMode(),connected=Boolean(event.detail?.connected),newlyAvailable=usingShared&&connected&&(!wasShared||!wasConnected);wasShared=usingShared;wasConnected=connected;
 if(!newlyAvailable||draft||busy||leaving||gateRefreshing)return;gateRefreshing=true;
 try{envelope=await storage.get(VAULT_KEY);await loadRecoveries(true);gateReady=true;updateGateActions();$('#vault-exists').textContent=pending?'共享档案中发现加密恢复草稿，可用原口令继续。':envelope?'共享加密档案已就绪，请用档案原口令解锁。':'扩展尚无档案，可设置口令并导入简历，或恢复加密备份。';say('共享档案已就绪。输入口令解锁；无需刷新页面。');}catch(error){say('共享档案读取失败：'+error.message,true);}finally{gateRefreshing=false;}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStorageBanner();});refreshStorageBanner();
try{envelope=await storage.get(VAULT_KEY);await loadRecoveries(true);gateReady=true;updateGateActions();$('#vault-exists').textContent=pending?'发现加密恢复草稿，解锁后可继续修正。':envelope?'本机已有加密档案。输入口令解锁，或恢复一份加密备份。':'尚未创建档案。先设置口令，再选择已有简历；也可以新建空白档案或恢复加密备份。';say('资料只在本机加密保存。性别与政治面貌可留空；不采集身份证、银行账号。');}catch(e){say('本机存储读取失败：'+e.message,true);}
