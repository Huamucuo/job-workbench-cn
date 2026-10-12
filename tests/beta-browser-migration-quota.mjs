import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
import {BrowserHarness,until,sleep,expandConnection,waitForApprovedConnection} from './beta-browser-harness.mjs';

const source=resolve(process.argv[3]||fileURLToPath(new URL('..',import.meta.url))),label=process.argv[2]||'beta-migration-quota';
const h=new BrowserHarness({source,out:resolve(source,'.local/beta-qa',label+'-'+Date.now())});
const pass='Migration-Quota-Fiction-2026!',VAULT='zhiyouyinli.profile.encrypted.v2',PRIMARY='zhiyouyinli.primary-store.beta';
const sha=value=>createHash('sha256').update(value).digest('hex');
let server,serverText='',page,inspector,fatal=null,executedConnectionSource=null,remoteBefore=null;
async function remoteVault(){return inspector.evaluate(async key=>(await chrome.storage.local.get(key))[key]||null,VAULT);}
async function decrypt(envelope){const s=webcrypto.subtle,seed=await s.importKey('raw',Buffer.from(pass),'PBKDF2',false,['deriveKey']),key=await s.deriveKey({name:'PBKDF2',salt:Buffer.from(envelope.salt,'base64'),iterations:envelope.iterations,hash:'SHA-256'},seed,{name:'AES-GCM',length:256},false,['decrypt']);return JSON.parse(Buffer.from(await s.decrypt({name:'AES-GCM',iv:Buffer.from(envelope.iv,'base64'),additionalData:Buffer.from('job-workbench-profile-v2')},key,Buffer.from(envelope.ciphertext,'base64'))).toString('utf8'));}
async function save(){await page.locator('#save-profile').click();await page.waitForFunction(()=>!document.querySelector('#editor').inert&&document.querySelector('#profile-status').textContent.startsWith('保存成功'));}
async function downloadLocal(name){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下载工作台加密备份',exact:true}).click();const d=await pending,path=resolve(h.out,name);await d.saveAs(path);return JSON.parse(await readFile(path,'utf8'));}

try{
 await h.open();h.current='MIG01-remote-commit-local-quota-consistency';
 const connectionSource=await readFile(resolve(source,'public/autofill/workbench-connection.mjs'),'utf8');await h.write('connection-source-before.mjs',connectionSource);
 server=spawn(process.execPath,[resolve(source,'scripts/serve.mjs')],{cwd:source,windowsHide:true,env:{...process.env,JOB_WORKBENCH_PORT:'47841'},stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>serverText+=b);server.stderr.on('data',b=>serverText+=b);
 await until(async()=>{try{return(await(await fetch('http://127.0.0.1:47841/__health')).json()).pid===server.pid;}catch{return false;}});
 await h.write('process-ownership.json',{runnerPid:process.pid,productServerPid:server.pid,port:47841,spawnWindowsHide:true,isolatedProfileOnly:true});
 inspector=await h.context.newPage();await inspector.goto(`chrome-extension://${h.extensionId}/profile.html`);remoteBefore=await remoteVault();if(remoteBefore!==null)throw Error('Isolated extension should start without a remote archive');
 page=await h.context.newPage();page.on('response',async r=>{if(r.url().endsWith('/autofill/workbench-connection.mjs'))executedConnectionSource=await r.text();});
 await page.goto('http://127.0.0.1:47841/profile.html');await page.locator('#vault-password').fill(pass);await page.locator('#create').click();await page.locator('[data-path="contact.name"]').waitFor();
 await page.locator('#fictional').click();await page.getByRole('button',{name:'确认继续',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-path="contact.name"]')?.value==='林知行');
 const originalPdf=await readFile(resolve(source,'public/autofill/samples/林知行-完整虚构简历.pdf')),eof=originalPdf.lastIndexOf(Buffer.from('%%EOF'));
 if(eof<0)throw Error('Bundled fictional PDF has no EOF marker');
 const comment=Buffer.from('\n% Independent synthetic quota fixture: whitespace only, no added résumé facts.\n'),padding=Buffer.alloc(350*1024-originalPdf.length-comment.length,32),pdf=Buffer.concat([originalPdf.subarray(0,eof),comment,padding,originalPdf.subarray(eof)]),attachment=resolve(h.out,'虚构容量附件.pdf');await writeFile(attachment,pdf);
 await page.locator('#attachment-file').setInputFiles(attachment);await until(async()=>await page.locator('[data-attachment-download]').count()===1);await save();
 await page.locator('[data-path="about.other"]').fill('仅为本机迁移容量验收的虚构资料。');await save();
 const localBefore=await page.evaluate(key=>({raw:localStorage.getItem(key),previous:localStorage.getItem(key+'.previous')}),VAULT);
 const localEnvelope=JSON.parse(localBefore.raw),fiction=await decrypt(localEnvelope);await h.write('preparation-original-archive.private.json',{profile:fiction,hasPrevious:Boolean(localBefore.previous),status:await page.locator('#profile-status').innerText()});
 if(!fiction.isFictional||fiction.contact.name!=='林知行'||fiction.attachments.length!==1||fiction.attachments[0].size!==pdf.length||fiction.attachments[0].sha256!==sha(pdf)||!localBefore.previous)throw Error('Large offline archive must be valid, fictional and include the actual attachment and previous save');
 const recoveredPdf=Buffer.from(fiction.attachments[0].dataBase64,'base64');if(!recoveredPdf.equals(pdf))throw Error('Actual saved attachment bytes changed');
 await page.locator('#lock-profile').click();await page.locator('#editor').waitFor({state:'hidden'});
 const pressure=await page.evaluate(({vault,reserve})=>{
  const key='qa.quota.cache-padding',raw=localStorage.getItem(vault);let low=0,high=6*1024*1024,lastError=null;
  while(low<high){const n=Math.ceil((low+high)/2);try{localStorage.setItem(key,'q'.repeat(n));low=n;}catch(e){lastError={name:e.name,message:e.message};high=n-1;}}
  localStorage.setItem(key,'q'.repeat(Math.max(0,low-reserve)));
  localStorage.setItem('qa.quota.small-mode-probe','extension');localStorage.removeItem('qa.quota.small-mode-probe');
  let backupWouldFail=false,backupError=null;try{localStorage.setItem('qa.quota.backup-probe',raw);localStorage.removeItem('qa.quota.backup-probe');}catch(e){backupWouldFail=true;backupError={name:e.name,message:e.message};}
  return {maxPaddingChars:low,reservedChars:reserve,paddingChars:Math.max(0,low-reserve),backupWouldFail,backupError,lastError,totalStoredChars:[...Object.keys(localStorage)].reduce((n,k)=>n+k.length+localStorage.getItem(k).length,0),keys:Object.keys(localStorage)};
 },{vault:VAULT,reserve:16384});
 if(!pressure.backupWouldFail||pressure.backupError?.name!=='QuotaExceededError')throw Error('Capacity setup did not create the exact optional-backup quota condition');
 await h.write('quota-preparation.json',{pressure,source:{kind:localEnvelope.kind,rawChars:localBefore.raw.length,ciphertextSha256:sha(localEnvelope.ciphertext),previousChars:localBefore.previous.length,fictional:true,name:fiction.contact.name,attachments:fiction.attachments.map(a=>({name:a.name,size:a.size,sha256:a.sha256}))},legality:'Actual offline UI created and explicitly saved a valid encrypted fictional profile twice. Actual attachment input received the bundled fictional PDF padded only with legal PDF whitespace before EOF. Other cache pressure is isolated QA data. Small mode flag fits, additional encrypted backup does not.'});
 await expandConnection(page);await page.locator('#connect-extension').click();const pop=await h.openPopup(page,{fromConnection:true});await until(()=>pop.eval('!document.querySelector("#workbench-approval").hidden'));await pop.click('#connection-consent');await pop.click('#approve-workbench');await until(()=>pop.eval('document.querySelector("#connection-result").textContent.includes("连接已批准")'));await pop.snapshot('01-actual-approved-toolbar');await pop.close();await waitForApprovedConnection(page);
 await page.locator('#use-shared-profile').click();await page.locator('.beta-sync-dialog').waitFor();
 const downloaded=await downloadLocal('migration-before-export.private.json');if(downloaded.ciphertext!==localEnvelope.ciphertext)throw Error('Actual pre-migration download did not preserve the offline archive');
 await page.locator('#sync-confirm').check();await page.getByRole('button',{name:'确认将工作台档案迁入扩展',exact:true}).click();
 await until(async()=>{const remote=await remoteVault(),status=await page.locator('#connection-feedback').innerText();return remote?.ciphertext===localEnvelope.ciphertext&&status.length>0;});await sleep(200);
 const remoteAfter=await remoteVault(),state=await page.evaluate(({vault,primary})=>({sharedMode:localStorage.getItem(primary),localRaw:localStorage.getItem(vault),migrationBackup:localStorage.getItem(vault+'.migration-backup'),status:document.querySelector('#connection-feedback').textContent,connectionState:document.querySelector('#extension-state').textContent,storageState:document.querySelector('#profile-storage-state').textContent,sourceDialogOpen:!!document.querySelector('.beta-sync-dialog[open]')}),{vault:VAULT,primary:PRIMARY});
 await page.locator('#extension-connection').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(h.out,'02-migration-actual-result.png'),fullPage:false});
 const afterProfile=await decrypt(remoteAfter);let exportAfterValid=false;
 if(state.sourceDialogOpen){const retained=await downloadLocal('migration-after-export.private.json');exportAfterValid=retained.ciphertext===localEnvelope.ciphertext;}
 else{await page.locator('#vault-password').fill(pass);await page.locator('#unlock').click();await page.locator('[data-path="contact.name"]').waitFor();const pending=page.waitForEvent('download');await page.locator('#export-profile').click();const d=await pending,path=resolve(h.out,'migration-after-shared-export.private.json');await d.saveAs(path);const exported=await decrypt(JSON.parse(await readFile(path,'utf8')));exportAfterValid=exported.contact.name==='林知行'&&exported.attachments[0]?.sha256===sha(pdf);}
 const details={pressure,remoteCommitted:remoteBefore===null&&remoteAfter?.ciphertext===localEnvelope.ciphertext,remoteStillValidFiction:afterProfile.isFictional&&afterProfile.attachments[0]?.sha256===sha(pdf),sharedMode:state.sharedMode,localOriginalRetained:state.localRaw===localBefore.raw,migrationBackupPresent:Boolean(state.migrationBackup),status:state.status,connectionState:state.connectionState,storageState:state.storageState,sourceDialogOpen:state.sourceDialogOpen,preMigrationDownloadPreserved:true,postMigrationExportUsable:exportAfterValid,sourceSha256:sha(connectionSource),executedConnectionSha256:executedConnectionSource?sha(executedConnectionSource):null,sameSourceExecuted:connectionSource===executedConnectionSource};
 await h.write('migration-observation.json',details);if(executedConnectionSource)await h.write('connection-source-actually-executed.mjs',executedConnectionSource);
 await h.check(h.current,details.remoteCommitted&&details.remoteStillValidFiction&&state.sharedMode==='extension'&&details.localOriginalRetained&&exportAfterValid&&!state.sourceDialogOpen&&!state.migrationBackup&&details.sameSourceExecuted&&state.status.includes('额外副本未能保存')&&state.status.includes('原工作台档案仍保留')&&state.status.includes('导出备份')&&!/Failed to execute|exceeded the quota|QuotaExceededError/i.test(state.status),details);
}catch(e){fatal=e.stack;console.error(fatal);await h.write('infrastructure-error.txt',fatal);if(page)await page.screenshot({path:resolve(h.out,'interrupted.png'),fullPage:false}).catch(()=>{});if(h.popup)await h.popup.snapshot('interrupted-popup').catch(()=>{});}
finally{if(server){const exited=new Promise(r=>server.once('exit',r));if(server.exitCode===null){server.kill();await Promise.race([exited,sleep(5000)]);}}await h.write('product-server.log',serverText);await h.write('process-cleanup.json',{productServerPid:server?.pid,serverSignal:server?.signalCode,serverExitCode:server?.exitCode,finishedAt:new Date().toISOString()});await h.close({fatal});if(fatal||h.cases.some(c=>c.status==='FAIL'))process.exitCode=1;}
