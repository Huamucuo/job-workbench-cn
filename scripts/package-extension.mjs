import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from '../public/autofill/vendor/fflate.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(resolve(root,'extension/manifest.json'),'utf8'));
const staging=process.argv.includes('--staging'),label='0.4.0-rc.1';
if(manifest.version!=='0.4.0')throw new Error('Beta扩展版本不正确');
async function files(dir,prefix=''){
 let list=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(e.isSymbolicLink())throw new Error('Package cannot include symlinks');
  const name=prefix+e.name;
  if(e.isDirectory())list.push(...await files(resolve(dir,e.name),name+'/'));
  else list.push(name);
 }
 return list.sort();
}
const extensionFiles=await files(resolve(root,'extension')),checks={},entries={};
for(const n of extensionFiles){const b=await readFile(resolve(root,'extension',n));checks[n]=hash(b);entries['extension/'+n]=new Uint8Array(b);}
entries['安装说明.txt']=new Uint8Array(await readFile(resolve(root,'docs/beta/扩展安装说明.txt')));
const zip=zipSync(entries,{level:6}),unpacked=unzipSync(zip);
if(Object.keys(unpacked).length!==extensionFiles.length+1)throw new Error('ZIP contains unexpected entries');
for(const n of extensionFiles)if(hash(unpacked['extension/'+n])!==checks[n])throw new Error('ZIP mismatch '+n);
await mkdir(resolve(root,'public/downloads'),{recursive:true});
await mkdir(resolve(root,'release'),{recursive:true});
const target=resolve(root,'release/求职自动填写扩展-'+label+(staging?'-集成检查':'')+'.zip');
if(!staging){
 const frozen=resolve(root,'release/candidate-v'+label);
 for(const n of extensionFiles){
  const b=unpacked['extension/'+n],dest=resolve(frozen,'extension',n);
  try{if(hash(await readFile(dest))!==checks[n])throw new Error('冻结版本不同，不能覆盖：'+dest);}
  catch(e){if(e.code!=='ENOENT')throw e;await mkdir(dirname(dest),{recursive:true});await writeFile(dest,b);}
 }
 const metadata={version:manifest.version,label,status:'local-beta-release-candidate',frozenAt:new Date().toISOString(),extensionFiles:checks,zipSHA256:hash(zip),zipBytes:zip.length,dailyEdgeInstalled:'requires-user-manual-install',actualAcceptanceReport:'说明与验收/验收报告.html',humanTimeSaving:'user-waived-no-human-result'};
 try{const prior=JSON.parse(await readFile(resolve(frozen,'candidate.json'),'utf8'));if(prior.zipSHA256!==metadata.zipSHA256)throw new Error('冻结ZIP不同，不能覆盖');}
 catch(e){if(e.code!=='ENOENT')throw e;await writeFile(resolve(frozen,'candidate.json'),JSON.stringify(metadata,null,2)+'\n');}
}
await writeFile(target,zip);
await copyFile(target,resolve(root,'public/downloads/求职自动填写扩展.zip'));
await writeFile(target+'.sha256',hash(zip)+'  '+target.split(/[\\/]/).at(-1)+'\n');
console.log(JSON.stringify({version:manifest.version,label,staging,files:extensionFiles.length,zipBytes:zip.length,sha256:hash(zip),output:target,roundTripVerified:true},null,2));
