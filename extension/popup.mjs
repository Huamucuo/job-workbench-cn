import {storage,VAULT_KEY,decryptProfile,usesLocalAccess} from './autofill/vault.mjs';
import {mountPanel} from './autofill/panel.mjs';
import {materializeProfile} from './autofill/profile.mjs';
const $=s=>document.querySelector(s);
let profile=null,panel=null,idle=null,target=null,localAccess=false;
async function refreshAccess(){try{localAccess=usesLocalAccess(await storage.get(VAULT_KEY));$('#password').closest('label').hidden=localAccess;$('#unlock').textContent=localAccess?'使用我的档案':'解锁档案';$('#unlock-status').textContent=localAccess?'使用已确认的本机档案，无需口令；随后核对预览并填写。':'首次使用请进入我的档案。已开启保护的档案需要原口令。';}catch(e){$('#unlock-status').textContent=e.message;}}
$('#manage').addEventListener('click',()=>chrome.runtime.openOptionsPage());
let sessionTab=null;
$('#open-session').addEventListener('click',async()=>{
 const button=$('#open-session');if(!sessionTab)return;button.disabled=true;
 try{
  // Both calls start directly inside the click; waiting can lose the gesture.
  const request=chrome.runtime.sendMessage({protocol:'job-session-v1',type:'session:request',tabId:sessionTab.id});
  const opening=chrome.sidePanel.open({tabId:sessionTab.id});
  const [reply]=await Promise.all([request,opening]);
  if(!reply?.ok)throw new Error(reply?.error||'请从招聘页面重新开始');
  window.close();
 }catch(e){$('#session-open-status').textContent='未打开跨页助手：'+e.message+'。请使用新版Edge或Chrome，重新点击扩展。';button.disabled=false;}
});
try{[sessionTab]=await chrome.tabs.query({active:true,currentWindow:true});if(sessionTab&&chrome.sidePanel?.open)$('#open-session').disabled=false;else $('#session-open-status').textContent='此浏览器暂不支持常驻侧栏，请更新Edge或Chrome；下方单页入口仍可用。';}catch{sessionTab=null;}
async function destination(){
 if(!target)throw new Error('没有选中的网页');
 const tab=await chrome.tabs.get(target.id),u=new URL(tab.url||'about:blank');
 if(tab.url!==target.url)throw new Error('目标网页已导航。请关闭后重新打开扩展');
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('仅支持 HTTPS 网站或本机测试页面；浏览器内部页面不可填写');
 return tab;
}
async function invoke(method,args=[]){
 await destination();
 await chrome.scripting.executeScript({target:{tabId:target.id},files:['autofill/rules.js','autofill/engine.js'],world:'ISOLATED'});
 const result=await chrome.scripting.executeScript({target:{tabId:target.id},world:'ISOLATED',func:async(method,args)=>{
  try{return {ok:true,data:await globalThis.JobAutofillEngine[method](...args)};}catch(e){return {ok:false,error:e.message};}
 },args:[method,args]});
 const main=result.find(r=>r.frameId===0)?.result;
 if(!main?.ok)throw new Error(main?.error||'页面没有返回结果，请重新打开扩展');
 return main.data;
}
function touch(){clearTimeout(idle);if(profile)idle=setTimeout(lock,300000);}
function lock(){profile=null;panel?.destroy();panel=null;$('#panel').hidden=true;$('#unlock-box').hidden=false;$('#password').value='';$('#unlock-status').textContent=localAccess?'本页预览已结束。需要时点击“使用我的档案”重新开始。':'已锁定，请重新输入口令。';clearTimeout(idle);}
$('#unlock').addEventListener('click',async()=>{
 const button=$('#unlock');button.disabled=true;
 try{
  const envelope=await storage.get(VAULT_KEY);if(!envelope)throw new Error('尚无档案，请先打开档案管理');
  const tabs=await chrome.tabs.query({active:true,currentWindow:true});target=tabs[0];
  await destination();
  const password=$('#password').value;$('#password').value='';profile=await decryptProfile(envelope,password);
  profile=materializeProfile(profile,profile.activeVariantId);$('#unlock-box').hidden=true;$('#panel').hidden=false;
  panel=await mountPanel($('#panel'),{transport:{scan:()=>invoke('scan'),apply:(id,items)=>invoke('apply',[id,items]),prepareGroups:counts=>invoke('prepareGroups',[counts])},getProfile:()=>profile});
  touch();
 }catch(e){profile=null;$('#unlock-status').textContent=e.message;}finally{button.disabled=false;}
});
document.addEventListener('keydown',touch);document.addEventListener('pointerdown',touch);
window.addEventListener('pagehide',lock);
let pendingWorkbench=null;
async function control(type,params={}){const r=await chrome.runtime.sendMessage({protocol:'job-beta-v1',type,...params});if(!r?.ok)throw new Error(r?.error||'连接暂不可用，请重新打开扩展');return r.value;}
$('#connection-consent').addEventListener('change',e=>{$('#approve-workbench').disabled=!e.target.checked;});
$('#approve-workbench').addEventListener('click',async()=>{if(!pendingWorkbench||!$('#connection-consent').checked)return;const b=$('#approve-workbench');b.disabled=true;try{await control('control:grant',{tabId:pendingWorkbench.tabId,nonce:pendingWorkbench.nonce});$('#connection-result').textContent='连接已批准。回到工作台选择共用档案，然后导入简历。';}catch(e){$('#connection-result').textContent=e.message;}finally{b.disabled=!$('#connection-consent').checked;}});
$('#revoke-workbench').addEventListener('click',async()=>{try{await control('control:revoke');$('#connection-result').textContent='工作台连接已断开，扩展中的加密档案保留。';}catch(e){$('#connection-result').textContent=e.message;}});
try{const r=await control('control:status');pendingWorkbench=r.pending;if(r.pending||r.connectedTabs?.length){$('#workbench-approval').hidden=false;$('#workbench-approval').open=Boolean(r.pending);$('#connection-details').textContent=r.pending?'目标：'+r.pending.origin+'。请核对是你启动的求职工作台。':'已有工作台连接，你可以随时断开。';}}catch(e){$('#unlock-status').textContent=e.message;}
await refreshAccess();
