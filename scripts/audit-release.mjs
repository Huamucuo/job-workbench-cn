// Local inspection only. No upload, deletion, git history rewriting or network access.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const run=(args,encoding='utf8')=>{const r=spawnSync('git',['-c','core.quotepath=false',...args],{cwd:root,encoding,maxBuffer:60*1024*1024,windowsHide:true});if(r.status!==0)throw new Error('Git本机检查失败：'+r.stderr);return r.stdout;};
const rules=[
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,})\b/g],
 ['openai-key',/\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/g],
 ['aws-access-key',/\bAKIA[A-Z0-9]{16}\b/g],
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['private-recruitment-link',/(?:inviteKey=[0-9a-f-]{36}|bc_sign=[0-9a-f]{32,}|quark_s=[0-9a-f]{48,})/gi],
 ['bearer-credential',/Bearer\s+(?:eyJ[A-Za-z0-9_.-]{35,}|[A-Za-z0-9_.-]{60,})/g]
];
const report={checkedAt:new Date().toISOString(),head:run(['rev-parse','HEAD']).trim(),workingFiles:0,historyBlobs:0,findings:[],assetMismatches:[],assetLineEndingOnly:[],privacyScope:'High-confidence credential and invitation-link patterns plus tracked-path exclusion checks. This is not a semantic detector for arbitrary personal data; independent source review and fictional-fixture provenance remain required.'};
function inspect(bytes,where){const s=bytes.toString('utf8');for(const[name,re]of rules){re.lastIndex=0;const match=re.exec(s);if(match)report.findings.push({where,rule:name,line:s.slice(0,match.index).split('\n').length});}}
const names=run(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
for(const name of names){if(/^(?:\.local|private|node_modules|release|dist)\/|(?:\.env(?:\.|$)|\.private\.json$)|^public\/data\/jobs\.json$/.test(name))report.findings.push({where:name,rule:'excluded-private-path'});const b=await readFile(resolve(root,name));inspect(b,'working:'+name);report.workingFiles++;}
const objects=[...new Set(run(['rev-list','--objects','--all']).split('\n').filter(Boolean).map(x=>x.split(' ')[0]))];
const checked=spawnSync('git',['cat-file','--batch-check=%(objectname) %(objecttype)'],{cwd:root,input:objects.join('\n')+'\n',encoding:'utf8',windowsHide:true});if(checked.status!==0)throw new Error('Git对象检查失败');
for(const line of checked.stdout.trim().split('\n')){const[id,type]=line.split(' ');if(type!=='blob')continue;inspect(run(['cat-file','blob',id],null),'history:'+id);report.historyBlobs++;}
const assets=JSON.parse(await readFile(resolve(root,'scripts/import-assets.json'),'utf8')).assets;
for(const a of assets)for(const location of ['public/'+a.path,'extension/'+a.path]){
 const b=await readFile(resolve(root,location)),raw=sha(b);if(raw===a.sha256)continue;
 // Git's Windows checkout can convert UTF-8 text LF to CRLF. Record the raw
 // hash and verify the exact original after that one reversible transformation.
 const text=b.toString('utf8'),isText=Buffer.from(text,'utf8').equals(b)&&!text.includes('\0');
 if(isText&&sha(Buffer.from(text.replaceAll('\r\n','\n'),'utf8'))===a.sha256)report.assetLineEndingOnly.push({path:location,rawSHA256:raw,originalLFSHA256:a.sha256});
 else report.assetMismatches.push(location);
}
const manifest=JSON.parse(await readFile(resolve(root,'extension/manifest.json'),'utf8'));
report.permissions={actual:manifest.permissions,hostPermissions:manifest.host_permissions||[],externallyConnectable:manifest.externally_connectable||null,contentScripts:manifest.content_scripts};
if(JSON.stringify(manifest.permissions)!==JSON.stringify(['activeTab','scripting','storage','sidePanel'])||manifest.side_panel?.default_path!=='sidepanel.html'||manifest.host_permissions?.length||manifest.externally_connectable)report.findings.push({where:'extension/manifest.json',rule:'unexpected-permission'});
const gates=JSON.parse(await readFile(resolve(root,'config/release.json'),'utf8'));report.publicReleaseGate=gates.publicReleaseApproved;
if(gates.publicReleaseApproved!==false)report.findings.push({where:'config/release.json',rule:'public-release-gate-open'});
const registry=JSON.parse(await readFile(resolve(root,'sources/registry.json'),'utf8'));report.sources=registry.map(s=>({id:s.id,automatedAllowed:s.automatedAllowed,redistributionAllowed:s.redistributionAllowed,permissionEvidence:s.permissionEvidence}));
report.vendorAssets=assets.length;report.passed=!report.findings.length&&!report.assetMismatches.length;
await mkdir(resolve(root,'.local'),{recursive:true});await writeFile(resolve(root,'.local/release-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,workingFiles:report.workingFiles,historyBlobs:report.historyBlobs,vendorAssets:report.vendorAssets,lineEndingOnly:report.assetLineEndingOnly.length,findings:report.findings,assetMismatches:report.assetMismatches,publicReleaseApproved:report.publicReleaseGate,report:'.local/release-audit.json'},null,2));if(!report.passed)process.exitCode=1;
