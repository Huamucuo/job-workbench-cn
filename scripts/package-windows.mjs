import {readFile,writeFile,mkdir,cp,readdir,stat,copyFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from '../public/autofill/vendor/fflate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),bundle=resolve(root,'release/求职工作台-Beta-0.4.0-rc.1'),nodePath=process.env.JOB_BUNDLED_NODE,licensePath=process.env.JOB_NODE_LICENSE;
if(!nodePath||!licensePath)throw new Error('打包需指定已核验的Node运行时和对应许可证');
const version=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;if(version!=='0.4.0-beta.1')throw new Error('候选版本不正确');
await mkdir(bundle,{recursive:true});await mkdir(resolve(bundle,'runtime'),{recursive:true});await mkdir(resolve(bundle,'scripts'),{recursive:true});
await cp(resolve(root,'dist'),resolve(bundle,'public'),{recursive:true});await cp(resolve(root,'extension'),resolve(bundle,'extension'),{recursive:true});await cp(resolve(root,'docs/beta'),resolve(bundle,'说明与验收'),{recursive:true});
await copyFile(nodePath,resolve(bundle,'runtime/node.exe'));await copyFile(licensePath,resolve(bundle,'runtime/NODE-LICENSE.txt'));await copyFile(resolve(root,'LICENSE'),resolve(bundle,'LICENSE'));
await copyFile(resolve(root,'THIRD_PARTY_NOTICES.md'),resolve(bundle,'THIRD_PARTY_NOTICES.md'));
await copyFile(resolve(root,'scripts/serve.mjs'),resolve(bundle,'scripts/serve.mjs'));await writeFile(resolve(bundle,'package.json'),JSON.stringify({name:'job-workbench-cn',version,license:'MIT',type:'module'})+'\n');
const compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';const compiled=spawnSync(compiler,['/nologo','/codepage:65001','/utf8output','/target:winexe','/reference:System.Windows.Forms.dll','/reference:System.Web.Extensions.dll','/out:'+resolve(bundle,'开始使用.exe'),resolve(root,'windows/Launcher.cs')],{encoding:'utf8',windowsHide:true});if(compiled.status!==0)throw new Error('Windows启动器编译失败：'+compiled.stdout+compiled.stderr);await copyFile(resolve(bundle,'开始使用.exe'),resolve(bundle,'停止工作台.exe'));
await writeFile(resolve(bundle,'先读我.txt'),'职有引力 Beta 0.4.0 RC1\r\n1. 请把整个ZIP全部解压到一个可写目录。\r\n2. 双击 开始使用.exe；无需安装Node，不需要账号。\r\n3. 在日常Edge/Chrome手动加载本目录extension一次，回首页刷新。\r\n4. 首页直接点击导入简历：设置口令，选择PDF/DOCX，核对后点击确认导入并加密保存。\r\n5. 投递时在网页打开工具栏扩展，解锁、识别、核对预览、填写、检查；最后提交由你完成。\r\n6. 日常无需批准网页连接。旧资料迁移与网页编辑共用档案才在首页折叠说明里连接。\r\n7. 完整图文指南在首页安装入口或说明与验收。请保留个人口令并导出加密备份。\r\n8. 旧版目录未覆盖；个人记录升级前可在旧版导出本机备份，在Beta导入。\r\n9. 本包不附未经许可的岗位快照。你原来的本机研究数据保留在原目录，可按指南继续使用。\r\n');
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(e.name==='.local')continue;const p=resolve(dir,e.name);if(e.isSymbolicLink())throw new Error('发行目录不得包含符号链接');if(e.isDirectory())await walk(p);else files.push(p);}}await walk(bundle);
const entries={},hashes={};for(const p of files){const n=relative(bundle,p).replaceAll('\\','/'),b=await readFile(p);if(/private\.json$|^\.git\/|^\.local\//.test(n))throw new Error('私人数据混入发行文件');entries['求职工作台-Beta-0.4.0-rc.1/'+n]=new Uint8Array(b);hashes[n]=createHash('sha256').update(b).digest('hex');}
const zip=zipSync(entries,{level:6});const unpacked=unzipSync(zip);for(const[n,h]of Object.entries(hashes)){const b=unpacked['求职工作台-Beta-0.4.0-rc.1/'+n];if(!b||createHash('sha256').update(b).digest('hex')!==h)throw new Error('发行ZIP回读不一致：'+n);}
const output=resolve(root,'release/求职工作台-Beta-0.4.0-rc.1-Windows.zip');await writeFile(output,zip);const sha256=createHash('sha256').update(zip).digest('hex');await writeFile(output+'.sha256',sha256+'\n');await writeFile(resolve(root,'release/beta-package.json'),JSON.stringify({version,files:files.length,bytes:zip.length,sha256,runtime:spawnSync(nodePath,['--version'],{encoding:'utf8'}).stdout.trim(),fileHashes:hashes,containsPersonalData:false,jobsIncluded:0},null,2)+'\n');console.log(JSON.stringify({bundle,output,bytes:zip.length,sha256,files:files.length},null,2));
