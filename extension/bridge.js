(()=>{
 if(location.origin!=='http://127.0.0.1:47841'||window.top!==window||window.__jobBetaBridgeLoaded)return;
 if(!(/^\/(?:index\.html|profile\.html|autofill-start\.html)?$/.test(location.pathname)||/^\/autofill\/lab\/[a-z0-9-]+\.html$/.test(location.pathname)||location.pathname==='/help/beta.html'))return;
 window.__jobBetaBridgeLoaded=true;
 const nonce=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join(''),methods=new Set(['probe','link','disconnect','open-profile','storage:get','storage:set','storage:commit','storage:recovery']);let inFlight=0;
 window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==location.origin)return;const d=event.data;
  if(!d||d.channel!=='JOB_BETA_PAGE'||typeof d.id!=='string'||d.id.length>80||!methods.has(d.type)||(d.targetId&&d.targetId!==chrome.runtime.id))return;
  if(inFlight>=12){window.postMessage({channel:'JOB_BETA_EXTENSION',id:d.id,ok:false,error:'操作太快，请稍后重试'},location.origin);return;}
  inFlight++;try{if(JSON.stringify(d).length>5600000)throw new Error('资料过大，请减少附件');const reply=await chrome.runtime.sendMessage({protocol:'job-beta-v1',nonce,type:d.type,key:d.key,value:d.value});window.postMessage({channel:'JOB_BETA_EXTENSION',id:d.id,...reply},location.origin);}catch(e){window.postMessage({channel:'JOB_BETA_EXTENSION',id:d.id,ok:false,error:'扩展连接已中断，请重新加载页面并批准连接'},location.origin);}finally{inFlight--;}
 });
})();
