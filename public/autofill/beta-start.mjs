import {probeBridge,bridgeRequest} from './bridge-client.mjs';
import {installationState} from './install-state.mjs';
const status=document.querySelector('#copy-status'),input=document.querySelector('#extension-dir'),install=document.querySelector('#install-state'),note=document.querySelector('#install-note'),ready=document.querySelector('#continue-import'),expected=document.documentElement.dataset.extensionVersion;
let actualDirectory=null;
try{const response=await fetch('/__installation',{cache:'no-store'});if(!response.ok)throw new Error('服务未返回安装目录');const data=await response.json();if(typeof data.extensionDir!=='string'||!data.extensionDir.trim())throw new Error('安装目录不可用');actualDirectory=data.extensionDir;input.value=actualDirectory;document.querySelector('#extension-version').textContent=data.extensionVersion||data.version;}catch{input.value='请从解压文件夹双击开始使用.exe';status.textContent='未取得本机实际目录。请重新启动完整下载包，不能把这行提示当作安装路径。';}
async function copy(value,message){try{await navigator.clipboard.writeText(value);status.textContent=message;}catch{status.textContent='浏览器未允许自动复制；请按 Ctrl+C 复制选中的内容。';const fallback=document.createElement('input');fallback.readOnly=true;fallback.value=value;fallback.setAttribute('aria-label','手动复制内容');status.append(fallback);fallback.focus();fallback.select();}}
document.querySelector('#copy-extension-dir').addEventListener('click',()=>{if(!actualDirectory){status.textContent='未取得实际目录，请先双击完整下载包中的开始使用.exe。';return;}return copy(actualDirectory,'安装目录已复制；在浏览器弹出的文件夹窗口粘贴，再选择文件夹。');});
for(const button of document.querySelectorAll('[data-copy-address]'))button.addEventListener('click',()=>copy(button.dataset.copyAddress,'安装页地址已复制；粘贴到 Edge / Chrome 地址栏后回车。'));
async function check(){const s=installationState(await probeBridge(),expected);ready.hidden=s.kind!=='ready';install.textContent=s.kind==='ready'?'安装完成 · 可以导入简历':s.kind==='update'?'检测到旧版或另一版本 '+(s.version||'未知'):'这个浏览器尚未检测到扩展';note.textContent=s.kind==='ready'?'扩展版本 '+s.version+'。下一步只需导入并核对保存。无需先授权网页读取资料。':s.kind==='update'?'请先导出加密备份，再按下方更新步骤使用 '+expected+'；不要删掉原档案。':'请在你日常使用的 Edge / Chrome 安装。安装完成后刷新本页，再点击检查。';return s;}
// A newly loaded extension's content script starts in a fresh document.
// One explicit check therefore refreshes this page and runs the startup probe.
document.querySelector('#check-installed').addEventListener('click',()=>{location.reload();});
ready.addEventListener('click',async event=>{event.preventDefault();try{if((await check()).kind!=='ready')return;await bridgeRequest('open-profile');status.textContent='已打开扩展档案。导入、核对并保存一次即可复用。';}catch(e){status.textContent=e.message;}});
await check();window.addEventListener('focus',()=>check());
