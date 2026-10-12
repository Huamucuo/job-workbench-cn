import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from '../public/autofill/vendor/fflate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const version=JSON.parse(await readFile(resolve(root,'extension/manifest.json'),'utf8')).version;
async function files(dir,prefix=''){let list=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw new Error('Package cannot include symlinks');const name=prefix+e.name;if(e.isDirectory())list.push(...await files(resolve(dir,e.name),name+'/'));else list.push(name);}return list.sort();}
const extensionFiles=await files(resolve(root,'extension')),frozen=resolve(root,'release/candidate-v'+version),checks={},entries={};
for(const n of extensionFiles){const b=await readFile(resolve(root,'extension',n)),dest=resolve(frozen,'extension',n);checks[n]=hash(b);try{const old=await readFile(dest);if(hash(old)!==checks[n])throw new Error('Frozen candidate differs; do not overwrite: '+dest);}catch(e){if(e.code!=='ENOENT')throw e;await mkdir(dirname(dest),{recursive:true});await writeFile(dest,b);}entries['extension/'+n]=new Uint8Array(b);}
entries['安装说明.txt']=new Uint8Array(await readFile(resolve(root,'release/安装说明-v'+version+'.txt')));
const zip=zipSync(entries,{level:6}),unpacked=unzipSync(zip);
if(Object.keys(unpacked).length!==extensionFiles.length+1)throw new Error('ZIP contains unexpected entries');
for(const n of extensionFiles)if(hash(unpacked['extension/'+n])!==checks[n])throw new Error('ZIP mismatch '+n);
const target=resolve(root,'release/求职自动填写扩展-v'+version+'.zip');await writeFile(target,zip);await copyFile(target,resolve(root,'public/downloads/求职自动填写扩展.zip'));
const candidate={version,status:'local-candidate-edge-acceptance-pending',frozenAt:new Date().toISOString(),extensionFiles:checks,zipSHA256:hash(zip),zipBytes:zip.length,dailyEdgeInstalled:false,actualExtensionAcceptance:'pending',humanTimeSaving:'pending'};
await writeFile(resolve(frozen,'candidate.json'),JSON.stringify(candidate,null,2)+'\n');
await writeFile(target+'.sha256',hash(zip)+'  '+target.split(/[\\/]/).at(-1)+'\n');
console.log(JSON.stringify({version,files:extensionFiles.length,zipBytes:zip.length,sha256:hash(zip),output:target,roundTripVerified:true},null,2));
