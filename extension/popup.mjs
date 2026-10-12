import {storage,VAULT_KEY,decryptProfile} from './autofill/vault.mjs';
import {mountPanel} from './autofill/panel.mjs';
import {materializeProfile} from './autofill/profile.mjs';
const $=s=>document.querySelector(s);
let profile=null,panel=null,idle=null,target=null;
$('#manage').addEventListener('click',()=>chrome.runtime.openOptionsPage());
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
function lock(){profile=null;panel?.destroy();panel=null;$('#panel').hidden=true;$('#unlock-box').hidden=false;$('#password').value='';$('#unlock-status').textContent='已锁定，请重新输入口令。';clearTimeout(idle);}
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
try{const r=await control('control:status');pendingWorkbench=r.pending;if(r.pending||r.connectedTabs?.length){$('#workbench-approval').hidden=false;$('#connection-details').textContent=r.pending?'目标：'+r.pending.origin+'。请核对是你启动的求职工作台。':'已有工作台连接，你可以随时断开。';}}catch(e){$('#unlock-status').textContent=e.message;}
