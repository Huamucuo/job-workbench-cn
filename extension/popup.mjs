import {storage,VAULT_KEY,decryptProfile} from './autofill/vault.mjs';
import {mountPanel} from './autofill/panel.mjs';
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
  $('#unlock-box').hidden=true;$('#panel').hidden=false;
  panel=await mountPanel($('#panel'),{transport:{scan:()=>invoke('scan'),apply:(id,items)=>invoke('apply',[id,items]),prepareGroups:counts=>invoke('prepareGroups',[counts])},getProfile:()=>profile});
  touch();
 }catch(e){profile=null;$('#unlock-status').textContent=e.message;}finally{button.disabled=false;}
});
document.addEventListener('keydown',touch);document.addEventListener('pointerdown',touch);
window.addEventListener('pagehide',lock);
