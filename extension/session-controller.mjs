// Only the actual toolbar popup can nominate an active tab for a new session.
// This handoff stores no decrypted archive, password, URL query or page content.
export const TARGET_KEY='applicationTarget';
export async function handleSessionMessage(message,sender,api=chrome){
 const plain=message&&Object.getPrototypeOf(message)===Object.prototype;
 if(!plain||Object.keys(message).some(k=>!['protocol','type','tabId'].includes(k))||message.protocol!=='job-session-v1'||message.type!=='session:request'||!Number.isSafeInteger(message.tabId)||message.tabId<1)throw new Error('无法开始本次网申，请从扩展按钮重新打开');
 if(sender?.id!==api.runtime.id||sender.url!==api.runtime.getURL('popup.html'))throw new Error('只有你点击的扩展入口可以开始网申');
 const tab=await api.tabs.get(message.tabId),[active]=await api.tabs.query({active:true,currentWindow:true});
 if(tab.id!==message.tabId||active?.id!==tab.id||!tab.active)throw new Error('请先切回要填写的招聘标签页');
 let url;try{url=new URL(tab.url)}catch{throw new Error('这个页面无法使用自动填写')}
 const loopback=url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
 if(url.username||url.password||!(url.protocol==='https:'||loopback))throw new Error('请在安全的招聘网页或本机测试页使用');
 const now=typeof api.clock==='function'?api.clock():Date.now();
 const target={requestId:crypto.randomUUID(),tabId:tab.id,windowId:tab.windowId,origin:url.origin,path:url.pathname,requestedAt:now,expiresAt:now+1800000};
 await api.storage.session.set({[TARGET_KEY]:target});
 return target;
}
