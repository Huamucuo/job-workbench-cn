import {storage,VAULT_KEY,decryptProfile,usesLocalAccess} from './autofill/vault.mjs';
import {materializeProfile} from './autofill/profile.mjs';
import {mountPanel} from './autofill/panel.mjs';
import {SessionScope} from './session-policy.mjs';
import {TARGET_KEY} from './session-controller.mjs';
const $=s=>document.querySelector(s);
const texts={
 'inactive-tab':'已暂停：请切回开始时的招聘标签页，助手会自动重新检测。',
 'wrong-tab':'目标标签页已改变，请从招聘页面重新点击扩展开始。',
 'origin-changed':'已暂停：进入了不同网站。请在新网站点击扩展，开始新的网申。',
 'context-changed':'已暂停：检测到不同岗位或申请。请结束本次网申，再从扩展开始。',
 'invalid-url':'这个页面不可填写。请回到安全的招聘网页。',
 'idle-expired':'5分钟没有操作助手，资料已锁定。请重新解锁。',
 'session-expired':'本次30分钟授权已到期。请在招聘页重新点击扩展开始。',
 'ended':'本次网申已结束。请在招聘页点击扩展，开始下一次。',
};
let target=null,scope=null,profile=null,panel=null,revision=null,epoch=0,observed=null,candidate=null,stamp=null,polling=false,operation=false,paused='',alive=true,unlocking=null,inFlight=null,knownContextKey='';
let localAccess=false;
async function refreshAccess(){try{localAccess=usesLocalAccess(await storage.get(VAULT_KEY));$('#session-password').closest('label').hidden=localAccess;$('#session-unlock').textContent=localAccess?'开始本次网申':'解锁并开始本次网申';$('#session-lock').textContent=localAccess?'暂停填写':'锁定资料';$('#session-gate h1').textContent=localAccess?'直接使用我的档案':'解锁一次，接着填下一页';}catch(e){status(e.message,true);}}
function status(text,bad=false){$('#session-status').textContent=text;$('#session-status').classList.toggle('bad',bad)}
function cancelCurrent(){
 const running=inFlight;inFlight=null;if(!running)return;
 void chrome.scripting.executeScript({target:{tabId:running.tabId,documentIds:[running.documentId]},world:'ISOLATED',func:id=>globalThis.JobAutofillEngine?.cancelOperation(id),args:[running.operationId]}).catch(()=>{});
}
function clearPreview(reason){cancelCurrent();epoch++;stamp=null;observed=null;candidate=null;panel?.invalidate(reason)}
function lock(reason=localAccess?'填写已暂停，点击“开始本次网申”可继续，无需口令。':'资料已锁定，请输入口令继续。'){
 cancelCurrent();epoch++;unlocking=null;scope?.end();scope=null;profile=null;revision=null;stamp=null;observed=null;candidate=null;paused='';
 panel?.destroy();panel=null;$('#continuous-panel').hidden=true;$('#session-gate').hidden=false;$('#session-password').value='';
 status(reason);$('#session-unlock').disabled=!target||target.expiresAt<=Date.now();
}
async function adopt(next){
 if(next?.requestId===target?.requestId)return;
 lock();target=next&&Number.isInteger(next.tabId)&&Number.isInteger(next.windowId)&&typeof next.origin==='string'&&typeof next.path==='string'&&typeof next.requestId==='string'&&Number.isFinite(next.requestedAt)&&Number.isFinite(next.expiresAt)?next:null;
 knownContextKey='';
 $('#session-history').replaceChildren();$('#session-log').hidden=true;
 $('#session-target').textContent=target?'本次目标：'+target.origin+target.path:'请在招聘页面点击扩展，选择“开始跨页填写”。';
 $('#session-unlock').disabled=!target||target.expiresAt<=Date.now();
 await refreshAccess();status(target?(target.expiresAt<=Date.now()?texts['session-expired']:localAccess?'无需口令。开始本次网申后，后续页面会自动准备预览。':'输入一次口令，本次网申后续页面会自动准备预览。'):'请先从招聘页面点击扩展，开始跨页填写。');
}
function refused(decision){
 if(decision.lock){lock(texts[decision.reason]||'资料已锁定，请重新开始。');return;}
 if(paused!==decision.reason){clearPreview(texts[decision.reason]||'目标页面发生变化，已暂停填写。');paused=decision.reason}
 status(texts[decision.reason]||'目标页面发生变化，已暂停填写。',true);
}
async function boundary(contextKey=''){
 if(!target||!scope||!profile)throw new Error('请先解锁本次网申档案');
 const currentTarget=target,currentScope=scope,ticket=epoch;
 let tab,active;
 try{tab=await chrome.tabs.get(currentTarget.tabId);[active]=await chrome.tabs.query({active:true,windowId:currentTarget.windowId})}catch{if(currentTarget===target&&currentScope===scope)lock('原招聘标签页已关闭，请在新页面点击扩展重新开始。');throw new Error('招聘标签页已关闭')}
 if(ticket!==epoch||currentTarget!==target||currentScope!==scope||!profile||!alive)throw new Error('本次目标或解锁状态已变化，旧操作已取消');
 const decision=currentScope.inspect({tabId:tab.id,activeTabId:active?.id,url:tab.url,contextKey,now:Date.now()});
 if(!decision.allowed){refused(decision);throw new Error(texts[decision.reason]||'页面权限已改变，请重新开始')}
 return {tab,decision};
}
async function execute(method,args=[],documentId=null,ticket=epoch){
 if(ticket!==epoch||!target||!profile||!scope||!alive)throw new Error('旧操作已取消，请核对当前预览');
 const currentTarget=target;
 const result=await chrome.scripting.executeScript({target:documentId?{tabId:currentTarget.tabId,documentIds:[documentId]}:{tabId:currentTarget.tabId},world:'ISOLATED',func:async(method,args)=>{
  try{return {ok:true,data:method==='watch'?await globalThis.JobAutofillPageWatcher.read():await globalThis.JobAutofillEngine[method](...args)}}catch(e){return {ok:false,error:e.message||'页面未返回结果'}};
 },args:[method,args]});
 const main=result.find(r=>r.frameId===0);if(!main?.result?.ok)throw new Error(main?.result?.error||'页面暂未准备好，请稍候或重新检测');
 if(method!=='apply'&&(ticket!==epoch||currentTarget!==target||!profile))throw new Error('页面已变化，旧操作已取消');
 return {data:main.result.data,documentId:main.documentId};
}
async function inspectPage(){
 const ticket=epoch;await boundary();
 await chrome.scripting.executeScript({target:{tabId:target.tabId},files:['autofill/rules.js','autofill/engine.js','autofill/page-watch.js'],world:'ISOLATED'});
 const read=await execute('watch',[],null,ticket);
 if(ticket!==epoch||!profile)throw new Error('页面已变化，正在重新检测');
 const {decision}=await boundary(read.data.contextKey);
 if(!read.documentId)throw new Error('浏览器无法确认当前页面，请更新浏览器后再试');
 if(!paused&&scope.bindContext(read.data.contextKey)&&!knownContextKey)knownContextKey=read.data.contextKey;
 return {...read.data,documentId:read.documentId,decision};
}
const equivalent=(a,b)=>Boolean(a&&b&&a.documentId===b.documentId&&a.fingerprint===b.fingerprint&&a.url===b.url&&a.contextKey===b.contextKey);
function beginOperation(page){
 const guard={operationId:crypto.randomUUID(),contextKey:page.contextKey,expiresAt:Math.min(Date.now()+110000,target.expiresAt)};
 inFlight={tabId:target.tabId,documentId:page.documentId,operationId:guard.operationId};return guard;
}
const transport={
 async scan(){
  if(operation)throw new Error('上一项操作尚未结束，请稍候');operation=true;
  const ticket=epoch;
  try{
   const page=await inspectPage(),result=await execute('scan',[],page.documentId,ticket),after=await execute('watch',[],page.documentId,ticket);
   if(ticket!==epoch||!profile||!equivalent(page,{...after.data,documentId:after.documentId}))throw new Error('页面仍在加载或发生变化，稍后会自动重新检测');
   await boundary(after.data.contextKey);stamp={...page,scanId:result.data.scanId,expiresAt:result.data.expiresAt};observed=page;candidate=null;
   const unknown=page.decision.reason==='context-unconfirmed';
   status('已自动检测当前页。'+(unknown?'本页无法确定岗位标识，请逐页核对是否同一次网申。':'')+'核对预览后点击“核对并填写本页”。');
   return result.data;
  }finally{operation=false}
 },
 async apply(scanId,items){
  if(operation)throw new Error('上一项操作尚未结束，请稍候');operation=true;
  const expected=stamp,ticket=epoch;
  try{
   if(!expected||expected.scanId!==scanId||Date.now()>expected.expiresAt)throw new Error('预览已过期，正在重新检测，请重新核对');
   const page=await inspectPage();
   if(!equivalent(expected,page))throw new Error('网页内容已改变，未写入旧预览；请等待重新检测后核对');
   const guard=beginOperation(page);const result=await execute('apply',[scanId,items,guard],page.documentId,ticket);
   if(ticket!==epoch||!profile) return {...result.data,pageChanged:true,pagePath:new URL(page.url).pathname};
   try{const after=await execute('watch',[],page.documentId,ticket);await boundary(after.data.contextKey);observed={...after.data,documentId:after.documentId};candidate=null}catch{observed=null}
   stamp=null;return {...result.data,pagePath:new URL(page.url).pathname};
  }catch(e){stamp=null;observed=null;throw e}finally{inFlight=null;operation=false}
 },
 async prepareGroups(counts){
  if(operation)throw new Error('上一项操作尚未结束，请稍候');operation=true;
  const ticket=epoch;
  try{const page=await inspectPage();const guard=beginOperation(page);const result=await execute('prepareGroups',[counts,guard],page.documentId,ticket);stamp=null;observed=null;return result.data}finally{inFlight=null;operation=false}
 }
};
function record(result){
 if(!profile)return;
 const item=document.createElement('li'),heading=document.createElement('strong');
 heading.textContent=new Date().toLocaleTimeString('zh-CN')+' · '+(result.pagePath||(observed?new URL(observed.url).pathname:target?.path||'招聘页面'));
 item.append(heading,document.createTextNode('：稳定回读 '+result.filled+' 项，失败 '+(result.failed||0)+'，跳过 '+(result.skipped||0)+'，待处理 '+(result.pending||0)+(result.pageChanged?'。填写时页面变化，请核对已填部分。':'。请核对网站保存结果。')));
 if(result.failed||result.pending||result.pageChanged){const detail=document.createElement('p');detail.textContent=(result.results||[]).filter(r=>r.status!=='filled').map(r=>r.label+'：'+r.reason).join('；');item.append(detail)}
 $('#session-history').prepend(item);while($('#session-history').children.length>30)$('#session-history').lastElementChild.remove();$('#session-log').hidden=false;
 status(result.pageChanged?'填写时页面变化，请核对已填部分；新页面会重新检测。':result.failed||result.pending?'本页有未保留或待处理项，请查看结果并在网页核对。':'本页填写已完成。请在网页核对、保存并进入下一步。',Boolean(result.failed||result.pending||result.pageChanged));
}
$('#session-unlock').addEventListener('click',async()=>{
 if(unlocking!==null)return;
 const ticket=++epoch;unlocking=ticket;
 const button=$('#session-unlock');button.disabled=true;let password=$('#session-password').value;$('#session-password').value='';
 const requestId=target?.requestId;
 try{
  if(!target||target.expiresAt<=Date.now())throw new Error(texts['session-expired']);
  const envelope=await storage.get(VAULT_KEY);if(!envelope)throw new Error('请先点“我的档案”，导入并确认保存简历');
  const decoded=await decryptProfile(envelope,password);password='';
  if(ticket!==epoch||target?.requestId!==requestId||target.expiresAt<=Date.now()||!alive)throw new Error('本次目标或解锁状态已改变，旧解锁已取消');
  const current=await storage.get(VAULT_KEY);
  if(ticket!==epoch||target?.requestId!==requestId||!alive)throw new Error('旧解锁已取消');
  if(current?.ciphertext!==envelope.ciphertext)throw new Error('档案在解锁期间已更新，请重新解锁最新资料');
  profile=materializeProfile(decoded,decoded.activeVariantId);revision=envelope.ciphertext;
  const now=Date.now();scope=new SessionScope({tabId:target.tabId,origin:target.origin,startedAt:now,maxAgeMs:target.expiresAt-now});
  if(knownContextKey)scope.bindContext(knownContextKey);
  await boundary();$('#session-gate').hidden=true;$('#continuous-panel').hidden=false;
  const ownerScope=scope,ownerTarget=target;
  panel=await mountPanel($('#continuous-panel'),{transport,getProfile:()=>profile,onResult:result=>{if(scope===ownerScope&&target===ownerTarget)record(result)},continuous:true});
  observed=null;candidate=null;paused='';status(localAccess?'已读取本机档案，正在自动检测当前页。':'已解锁，正在自动检测当前页。');await tick();
 }catch(e){if(ticket===epoch&&target?.requestId===requestId)lock(e.message||'解锁失败，请重新尝试')}finally{password='';if(unlocking===ticket){unlocking=null;button.disabled=!target||target.expiresAt<=Date.now()}}
});
async function tick(){
 if(!alive||!profile||polling)return;polling=true;
 try{
  await boundary();if(operation||panel?.isBusy())return;
  const page=await inspectPage();
  if(paused){paused='';clearPreview('已回到本次招聘页面，正在重新检测。')}
  if(!page.fieldCount){if(observed?.fieldCount){clearPreview('本页没有可填写字段；附件、声明和最终提交请手工处理。')}observed=page;status('本页没有可填写字段；附件、声明和最终提交请手工处理。');return;}
  const expired=stamp&&Date.now()>stamp.expiresAt;
  // A TTL refresh already queued for an unchanged page must reach the scan.
  if(!candidate&&equivalent(page,observed)&&!expired)return;
  if(!candidate||!equivalent(page,candidate.page)){
   candidate={page,at:Date.now()};epoch++;stamp=null;panel?.invalidate('页面已变化，正在自动重新检测。');
   return;
  }
  if(Date.now()-candidate.at<350)return;
  observed=page;candidate=null;await panel?.scan();
 }catch(e){
  if(profile&&!paused){clearPreview('暂未完成检测，旧预览已清除。');status('暂未完成检测：'+e.message+'。请保持本次招聘页打开；仍无响应可点击“重新检测”。',true)}
 }finally{polling=false}
}
function touch(event){if(event.isTrusted&&scope&&profile){if(!scope.touch(Date.now()))lock('本次授权已过期，请重新开始。')}}
document.addEventListener('pointerdown',touch);document.addEventListener('keydown',touch);
$('#session-manage').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('#session-lock').addEventListener('click',()=>lock());
$('#session-end').addEventListener('click',async()=>{lock(texts.ended);knownContextKey='';const id=target?.requestId;target=null;$('#session-unlock').disabled=true;$('#session-target').textContent='本次网申已结束';const current=(await chrome.storage.session.get(TARGET_KEY))[TARGET_KEY];if(current?.requestId===id)await chrome.storage.session.remove(TARGET_KEY)});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==='session'&&changes[TARGET_KEY])void adopt(changes[TARGET_KEY].newValue);
 if(area==='local'&&changes[VAULT_KEY]&&profile&&changes[VAULT_KEY].newValue?.ciphertext!==revision)lock('档案已在另一窗口更新，旧预览已清除。请重新解锁最新资料。');
 if(area==='local'&&changes[VAULT_KEY]&&!profile)void refreshAccess();
});
chrome.tabs.onUpdated.addListener((id,info)=>{if(id===target?.tabId&&profile&&(info.status==='loading'||info.url)){clearPreview('正在进入新页面，加载完成后会自动准备预览。')}});
chrome.tabs.onRemoved.addListener(id=>{if(id===target?.tabId)lock('原招聘标签页已关闭，请在新页面点击扩展开始。')});
chrome.tabs.onActivated.addListener(info=>{if(info.windowId===target?.windowId&&profile){clearPreview('标签页已切换，正在核对本次目标。');void tick()}});
if(chrome.sidePanel.onClosed?.addListener)chrome.sidePanel.onClosed.addListener(info=>{if(!info?.windowId||info.windowId===target?.windowId)lock('侧栏已关闭，资料已锁定。')});
window.addEventListener('pagehide',()=>{alive=false;lock('侧栏已关闭，资料已锁定。')});
await adopt((await chrome.storage.session.get(TARGET_KEY))[TARGET_KEY]);
setInterval(()=>void tick(),750);
