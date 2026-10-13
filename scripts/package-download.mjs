import {readFile,writeFile,mkdir,cp,copyFile,readdir,access} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from '../public/autofill/vendor/fflate.mjs';
import {assertDownloadContents} from './download-policy.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')),version=pkg.version;
if(!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version))throw new Error('公开候选版本必须明确标为 Beta');
const staging=process.argv.includes('--staging'),name='职有引力-'+version,bundle=resolve(root,staging?'.local/download-candidate':'release/'+name);
try{await access(bundle);throw new Error('发行目录已存在，不能覆盖。请使用新的候选目录或新版本。');}catch(e){if(e.code!=='ENOENT')throw e;}
const nodePath=process.env.JOB_BUNDLED_NODE,licensePath=process.env.JOB_NODE_LICENSE;
if(!nodePath||!licensePath)throw new Error('需指定核验过的 Node 运行时及对应许可证');
await mkdir(resolve(bundle,'runtime'),{recursive:true});await mkdir(resolve(bundle,'scripts'),{recursive:true});
await cp(resolve(root,'dist'),resolve(bundle,'public'),{recursive:true});await cp(resolve(root,'extension'),resolve(bundle,'extension'),{recursive:true});await cp(resolve(root,'docs/beta'),resolve(bundle,'说明与验收'),{recursive:true});
await copyFile(nodePath,resolve(bundle,'runtime/node.exe'));await copyFile(licensePath,resolve(bundle,'runtime/NODE-LICENSE.txt'));
for(const f of ['LICENSE','THIRD_PARTY_NOTICES.md','PRIVACY.md','README.md'])await copyFile(resolve(root,f),resolve(bundle,f));
await copyFile(resolve(root,'scripts/serve.mjs'),resolve(bundle,'scripts/serve.mjs'));
await writeFile(resolve(bundle,'package.json'),JSON.stringify({name:pkg.name,version,license:'MIT',type:'module'})+'\n');
const compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
for(const [source,dest,extra]of [['windows/Launcher.cs','开始使用.exe',[]],['windows/ExtensionInstaller.cs','安装扩展.exe',['/reference:System.Drawing.dll']]]){
 const r=spawnSync(compiler,['/nologo','/codepage:65001','/utf8output','/target:winexe','/reference:System.Windows.Forms.dll','/reference:System.Web.Extensions.dll',...extra,'/out:'+resolve(bundle,dest),resolve(root,source),resolve(root,'windows/WindowsBrowser.cs')],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error('Windows 程序编译失败：'+r.stdout+r.stderr);
}
await copyFile(resolve(bundle,'开始使用.exe'),resolve(bundle,'停止工作台.exe'));
const guide=await readFile(resolve(root,'public/help/onboarding.html'),'utf8');
await writeFile(resolve(bundle,'图文教学.html'),guide.replaceAll('href="./onboarding.css"','href="./public/help/onboarding.css"').replaceAll('src="./onboarding/','src="./public/help/onboarding/'));
await copyFile(resolve(root,'public/help/首次使用图文教学.pdf'),resolve(bundle,'图文教学.pdf'));
await writeFile(resolve(bundle,'先看这里.txt'),'\uFEFF职有引力 '+version+' · 免费 Windows 下载包\r\n\r\n只需关注三个文件：\r\n1. 开始使用.exe：双击打开工作台，无需安装 Node、账号、API 密钥或付费服务。\r\n2. 安装扩展.exe：只做一次；点你的浏览器按钮，目录自动复制，安装页自动打开。\r\n3. 图文教学.html / 图文教学.pdf：断网也能查看每一步。\r\n\r\n先把整个 ZIP 全部解压到可写文件夹。不要在压缩包内运行，不要只提取一个 EXE。\r\n安装助手不绕过浏览器确认：你还需开启开发人员模式、点击加载解压缩的扩展、粘贴目录并选择文件夹。\r\n日常只需导入并核对保存一次；招聘页点工具栏扩展，开始本次网申后逐页核对填写；默认免口令。\r\n\r\n用户资料默认免口令存于当前浏览器本机，不上传到 GitHub；可以自愿开启口令保护。请导出档案备份，未加密备份含完整个人资料，不要公开分享。\r\nBeta 已用虚构资料验证模拟流程，不保证所有真实网站均兼容，不最终提交申请。\r\n公开包的岗位列表为空；搜索、薪资、标签、收藏和投递管理功能保留。\r\n使用源码、许可证和最新下载：https://github.com/Huamucuo/job-workbench-cn\r\n');
const files=[];async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){const p=resolve(d,e.name);if(e.isSymbolicLink())throw new Error('禁止符号链接');if(e.isDirectory())await walk(p);else files.push(p);}}await walk(bundle);
const contents={},hashes={},zipEntries={};for(const p of files){const n=relative(bundle,p).replaceAll('\\','/'),b=await readFile(p);contents[n]=b;hashes[n]=hash(b);zipEntries[name+'/'+n]=new Uint8Array(b);}
const policy=assertDownloadContents(contents),zip=zipSync(zipEntries,{level:6}),back=unzipSync(zip);
for(const [n,h]of Object.entries(hashes))if(hash(back[name+'/'+n])!==h)throw new Error('ZIP 回读校验失败：'+n);
await mkdir(resolve(root,'release'),{recursive:true});const output=resolve(root,staging?'.local/download-candidate.zip':'release/zhiyouyinli-windows-'+version+'.zip');
await writeFile(output,zip);await writeFile(output+'.sha256',hash(zip)+'  '+output.split(/[\\/]/).at(-1)+'\n');
const report={version,bundle,output,bytes:zip.length,sha256:hash(zip),files:files.length,fileHashes:hashes,...policy,runtimeVersion:spawnSync(nodePath,['--version'],{encoding:'utf8'}).stdout.trim(),runtimeSHA256:hash(await readFile(nodePath)),guideIncluded:true,roundTripVerified:true,staging};
await writeFile(resolve(root,staging?'.local/download-package.json':'release/download-package.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,fileHashes:undefined},null,2));
