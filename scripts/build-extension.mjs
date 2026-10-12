import {cp,mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './validate.mjs';
const importAssets=JSON.parse(await readFile(resolve(root,'scripts/import-assets.json'),'utf8')).assets.map(a=>a.path);
const modules=['import-parser.mjs','import-meta.mjs','import-merge.mjs','document-reader.mjs','import-ui.mjs','import.css','profile.mjs','recoveries.mjs','vault.mjs','ui.mjs','rules.js','engine.js','panel.mjs','profile-ui.mjs','autofill.css'];
const dir=resolve(root,'extension');await mkdir(resolve(dir,'autofill'),{recursive:true});
for(const name of modules)await cp(resolve(root,'public/autofill',name),resolve(dir,'autofill',name));
for(const name of ['profile.html','icon.svg'])await cp(resolve(root,'public',name),resolve(dir,name));
for(const file of importAssets){await mkdir(resolve(dir,file,'..'),{recursive:true});await cp(resolve(root,'public',file),resolve(dir,file));}
const manifest=JSON.parse(await readFile(resolve(dir,'manifest.json'),'utf8'));
if(JSON.stringify(manifest.permissions)!==JSON.stringify(['activeTab','scripting','storage'])||manifest.host_permissions||manifest.externally_connectable||manifest.content_scripts)throw new Error('扩展权限超出设计范围');
const allowed=new Set([...importAssets,'manifest.json','popup.html','popup.css','popup.mjs','profile.html','icon.svg',...modules.map(n=>'autofill/'+n)]);
async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){const p=resolve(d,e.name);if(e.isSymbolicLink())throw new Error('禁止符号链接');if(e.isDirectory())await walk(p);else if(!allowed.has(relative(dir,p).replaceAll('\\','/')))throw new Error('扩展包含非白名单文件：'+p);}}
await walk(dir);
const hashes={};for(const name of ['rules.js','engine.js','panel.mjs'])hashes[name]=createHash('sha256').update(await readFile(resolve(dir,'autofill',name))).digest('hex');
console.log(JSON.stringify({output:dir,version:manifest.version,files:allowed.size,permissions:manifest.permissions,sharedEngineHashes:hashes},null,2));
