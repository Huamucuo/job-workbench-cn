import {GrantRegistry,CanonicalStore,isTrustedWorkbenchSender,assertKey,WORKBENCH_ORIGIN} from './bridge-policy.mjs';
const grants=new GrantRegistry(),local={get:async key=>(await chrome.storage.local.get(key))[key]??null,setMany:patch=>chrome.storage.local.set(patch)},canonical=new CanonicalStore(local);
const ready=(async()=>{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});grants.restore((await chrome.storage.session.get('workbenchGrants')).workbenchGrants);})();
const persist=()=>chrome.storage.session.set({workbenchGrants:grants.snapshot()});
function trustedExtension(sender){return sender.id===chrome.runtime.id&&typeof sender.url==='string'&&sender.url.startsWith(chrome.runtime.getURL(''));}
async function handle(m,sender){
 await ready;if(!m||m.protocol!=='job-beta-v1'||typeof m.type!=='string'||JSON.stringify(m).length>5700000)throw new Error('连接请求格式错误或过大');
 const control=trustedExtension(sender);if(!control&&!isTrustedWorkbenchSender(sender))throw new Error('只允许已核对的本机工作台连接');
 if(m.type==='control:status'&&control){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab)return {pending:null};const r=grants.records.get(tab.id);return {pending:r&&{...r,origin:WORKBENCH_ORIGIN},connectedTabs:grants.snapshot().filter(r=>r.expiresAt>Date.now()).map(r=>r.tabId)};}
 if(m.type==='control:grant'&&control){const tab=await chrome.tabs.get(m.tabId);if(!isTrustedWorkbenchSender({url:tab.url,tab,frameId:0}))throw new Error('目标标签页已经改变，未批准连接');const granted=grants.approve(m.tabId,m.nonce);await persist();return {connected:true,expiresAt:granted.expiresAt};}
 if(m.type==='control:revoke'&&control){for(const r of grants.snapshot())grants.revoke(r.tabId);await persist();return {connected:false};}
 if(m.type==='open-profile'){
  if(Object.keys(m).some(k=>!['protocol','type','nonce','key','value'].includes(k))||m.key!==undefined||m.value!==undefined||(!control&&(typeof m.nonce!=='string'||!/^[a-f0-9]{64}$/.test(m.nonce))))throw new Error('只能打开本机扩展档案界面');
  await chrome.runtime.openOptionsPage();return {ok:true};
 }
 if(!control){if(m.type==='probe'||m.type==='link'){const result=grants.register(sender,m.nonce);await persist();return {...result,version:chrome.runtime.getManifest().version,extensionId:chrome.runtime.id};}grants.authorize(sender,m.nonce);if(m.type==='disconnect'){grants.revoke(sender.tab.id);await persist();return {connected:false};}}
 if(m.type==='storage:get'){assertKey(m.key);return {value:await canonical.get(m.key)};}
 if(m.type==='storage:set'){await canonical.set(m.key,m.value);return {ok:true};}
 if(m.type==='storage:recovery'){await canonical.addRecovery(m.value);return {ok:true};}
 if(m.type==='storage:commit'){await canonical.commit(m.value);return {ok:true};}
 throw new Error('这个连接操作不受支持');
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{handle(m,sender).then(value=>respond({ok:true,value}),error=>respond({ok:false,error:error.message||'本机连接暂不可用，请重新连接'}));return true;});
chrome.tabs.onRemoved.addListener(id=>{grants.revoke(id);persist().catch(()=>{});});
