import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const sources = JSON.parse(await readFile(resolve(root,'sources/registry.json'),'utf8'));
const data = {schemaVersion:1, generatedAt:null, mode:'local-research', notice:'公开源码不附真实岗位。当前列表为空；可先使用虚构表单。来源接入另行审核。', sources, sourceRuns:[], jobs:[]};
const notes = ['职有引力 · '+version+' 开发候选','解压整个包，在 Edge/Chrome 扩展管理页开启开发者模式。','选择解压目录中的 extension 文件夹；不要选择单个文件。','不附个人简历、账号或真实招聘数据。请先用虚构表单验收。','真实网站兼容性未全面验证，不自动提交申请。','项目 MIT 和第三方通知位于 extension/autofill/vendor，字体对应源码位于 font-sources。'].join('\n')+'\n';
const files = [['public/data/jobs.json',JSON.stringify(data,null,2)+'\n'],['sources/manual.json','[]\n'],['release/安装说明-v'+version+'.txt',notes]];
await mkdir(resolve(root,'public/downloads'),{recursive:true});
for(const [name,text] of files) {
  const path=resolve(root,name); await mkdir(dirname(path),{recursive:true});
  try { await writeFile(path,text,{flag:'wx'}); console.log('创建本机文件：'+name); }
  catch(error) { if(error.code!=='EEXIST')throw error; console.log('保留已有文件：'+name); }
}
