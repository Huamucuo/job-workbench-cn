import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
async function walk(path){const out=[];for(const d of await readdir(path,{withFileTypes:true})){if(d.name==='vendor')continue;const p=resolve(path,d.name);if(d.isDirectory())out.push(...await walk(p));else if(/\.(mjs|js)$/.test(d.name))out.push(p);}return out;}
const files=[...await walk(resolve(root,'public')),...await walk(resolve(root,'scripts'))];
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);process.exit(1);}}
console.log(`页面与构建脚本语法检查：${files.length} 个文件通过。`);
