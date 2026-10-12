import {probeBridge,bridgeStatus,requestLink,bridgeRequest,sharedMode,setSharedMode} from './bridge-client.mjs';
import {VAULT_KEY,validateEnvelope,downloadJson} from './vault.mjs';
import {el} from './ui.mjs';
const box=document.querySelector('#extension-connection');
if(box){
 const state=el('strong',{id:'extension-state',text:'正在检查扩展…'}),note=el('p',{id:'extension-note'}),link=el('button',{class:'primary',id:'connect-extension',text:'连接扩展'}),use=el('button',{class:'secondary',id:'use-shared-profile',text:'共用这份档案',hidden:true}),guide=el('a',{href:'./autofill-start.html#install',class:'secondary',text:'安装扩展 / 操作说明'}),status=el('p',{role:'status',id:'connection-feedback'}),advanced=el('details',{id:'connection-advanced',class:'beta-connection-advanced'}),offline=el('a',{href:'./profile.html','data-offline-profile':'true',class:'secondary',text:'打开旧离线档案'});
 const hasLocal=()=>!!localStorage.getItem(VAULT_KEY);
 advanced.append(el('summary',{text:'旧资料迁移与网页连接（按需）'}),el('p',{text:'新用户直接使用扩展档案即可。只有迁移旧工作台资料或在网页编辑共用档案时，才需明确批准连接；刷新网页后需重新批准。'}),el('div',{class:'beta-connect-actions'},[link,use,offline]));
 box.replaceChildren(el('div',{},[el('span',{class:'eyebrow',text:'自动填写准备'}),state,note]),el('div',{class:'beta-connect-actions'},[guide]),advanced,status);
 function draw(s){let old=false,shared=false;try{old=hasLocal();shared=sharedMode();}catch{status.textContent='无法检查旧档案，暂不切换资料来源。请允许本机存储后刷新。';}
  state.textContent=!s.installed?'先安装自动填写扩展':old&&!shared?'扩展已安装 · 旧档案待迁移':s.connected&&shared?'扩展已安装 · 网页档案已连接':'扩展已安装 · 可以打开我的档案';
  note.textContent=!s.installed?'安装只做一次。加载后刷新本页，即可导入简历或打开档案。':old&&!shared?'检测到旧工作台档案。展开下方“旧资料迁移”选择来源，避免建立第二份资料。':'点击上方“导入简历”或“我的档案”直接使用扩展档案；投递时打开工具栏扩展。';
  link.textContent=s.connected?'重新核对网页连接':old&&!shared?'迁移旧资料：连接扩展':'连接网页编辑（可选）';use.hidden=!s.connected||shared;offline.hidden=!old;
 }
 window.addEventListener('job-bridge-status',e=>draw(e.detail));
 link.addEventListener('click',async()=>{link.disabled=true;try{await requestLink();status.textContent='请打开工具栏“职有引力”扩展，勾选并点击“批准工作台连接”，然后回到本页。';}catch(e){status.textContent=e.message;}finally{link.disabled=false;}});
 use.addEventListener('click',async()=>{use.disabled=true;try{const s=await probeBridge();if(!s.connected)throw new Error('请先批准连接');const remote=(await bridgeRequest('storage:get',{key:VAULT_KEY})).value,raw=localStorage.getItem(VAULT_KEY),local=raw?JSON.parse(raw):null;if(local)validateEnvelope(local);if(remote)validateEnvelope(remote);
  if(!local||local.ciphertext===remote?.ciphertext){setSharedMode(true);status.textContent='已共用扩展档案，打开“我的档案”即可导入或编辑。';return;}
  const dialog=el('dialog',{class:'beta-sync-dialog'}),close=()=>{dialog.close();dialog.remove();use.disabled=false;};
  dialog.append(el('h2',{text:'两边已有档案，请选择来源'}),el('p',{text:'现有内容不会默认互相覆盖。可以先下载工作台中的加密备份；没有口令不能读取备份。'}),el('button',{class:'secondary',text:'下载工作台加密备份',onClick:()=>downloadJson(local,'工作台迁移前.private.json')}));
  const consent=el('input',{type:'checkbox',id:'sync-confirm'}),send=el('button',{class:'primary',text:remote?'确认用工作台档案替换扩展':'确认将工作台档案迁入扩展',disabled:true}),keep=el('button',{class:'secondary',text:remote?'使用扩展原档案':'在扩展建立新的档案'});
  dialog.append(el('label',{},[consent,'我已保留备份，并确认选择的档案来源。']),send,keep,el('button',{class:'secondary',text:'取消',onClick:close}));consent.addEventListener('change',()=>{send.disabled=!consent.checked;});
  send.addEventListener('click',async()=>{if(!consent.checked)return;send.disabled=true;let committed=false;try{await bridgeRequest('storage:commit',{value:{expectedCiphertext:remote?.ciphertext||null,next:local,recovered:null}},15000);committed=true;setSharedMode(true);let note='原工作台档案和额外加密副本保留。';try{localStorage.setItem(VAULT_KEY+'.migration-backup',raw);}catch{note='额外副本未能保存（本机空间可能不足）；原工作台档案仍保留。请下载加密备份，或从扩展“我的档案”导出备份。';}status.textContent='迁移完成，工作台和扩展使用同一份档案；'+note;close();}catch(e){status.textContent=committed?'档案已经迁入扩展，但本页共用标记未能保存。请从工具栏“我的档案”查看并导出备份，整理本机存储后重新选择共用。原工作台档案仍保留。':e.message;send.disabled=false;if(committed)close();}});
  keep.addEventListener('click',()=>{setSharedMode(true);status.textContent='已选择扩展档案；原工作台加密备份仍保留在本机。';close();});dialog.addEventListener('cancel',close);document.body.append(dialog);dialog.showModal();
 }catch(e){status.textContent=e.message;}finally{use.disabled=false;}});
 await probeBridge();setInterval(()=>{if(document.visibilityState==='visible')probeBridge();},4000);
 for(const a of document.querySelectorAll('a[href^="./profile.html"]:not([data-offline-profile])'))a.addEventListener('click',async event=>{event.preventDefault();try{
  if(hasLocal()&&!sharedMode()){advanced.open=true;status.textContent='先选择旧资料的去向：迁移到扩展，或打开旧离线档案。原内容不会自动覆盖。';advanced.scrollIntoView({block:'nearest'});return;}
  const s=bridgeStatus().installed?bridgeStatus():await probeBridge();if(!s.installed){location.assign('./autofill-start.html#install');return;}
  await bridgeRequest('open-profile');status.textContent='已打开扩展里的我的档案。保存一次，工具栏即可复用；无需先批准网页连接。';
 }catch(e){status.textContent=e.message;}});
}
