import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
import {BrowserHarness,until,sleep} from './beta-browser-harness.mjs';

const source=resolve(process.argv[3]||fileURLToPath(new URL('..',import.meta.url)));
const label=process.argv[2]||'beta-guide-bc';
const h=new BrowserHarness({source,out:resolve(source,'.local/beta-qa',label+'-'+Date.now())});
const pass='Guide-BC-Synthetic-2026!',vaultKey='zhiyouyinli.profile.encrypted.v2';
const sample=resolve(source,'public/autofill/samples/林知行-完整虚构简历.docx');
const sha=value=>createHash('sha256').update(value).digest('hex');
let server,serverText='',profilePage,activePage,fatal=null,serverOwned=false;
const necessaryActions=[];

async function inspectArchive(){
 const envelope=await profilePage.evaluate(async key=>(await chrome.storage.local.get(key))[key],vaultKey);
 if(!envelope)throw Error('No actual saved extension archive');
 const s=webcrypto.subtle,seed=await s.importKey('raw',Buffer.from(pass),'PBKDF2',false,['deriveKey']);
 const key=await s.deriveKey({name:'PBKDF2',salt:Buffer.from(envelope.salt,'base64'),iterations:envelope.iterations,hash:'SHA-256'},seed,{name:'AES-GCM',length:256},false,['decrypt']);
 const plain=await s.decrypt({name:'AES-GCM',iv:Buffer.from(envelope.iv,'base64'),additionalData:Buffer.from('job-workbench-profile-v2')},key,Buffer.from(envelope.ciphertext,'base64'));
 const profile=JSON.parse(Buffer.from(plain).toString('utf8'));
 return {ciphertextSha256:sha(envelope.ciphertext),profileSha256:sha(JSON.stringify(profile)),profile};
}

async function mapping(pop,label,path){
 const query=`[...document.querySelectorAll('.af-row')].find(r=>r.querySelector('strong')?.textContent===${JSON.stringify(label)})?.querySelector('select')`;
 const before=await pop.eval(`(()=>{const e=${query};if(!e)throw Error('Missing mapping select');if(e.disabled)throw Error('Protected mapping control');return {value:e.value,options:[...e.options].map(o=>({value:o.value,label:o.textContent}))}})()`);
 const ix=before.options.findIndex(o=>o.value===path);if(ix<0)throw Error('Missing approved source path '+path);
 await pop.eval(`(()=>{const e=${query};e.scrollIntoView({block:'center'});e.focus();})()`);
 for(const key of ['Home',...Array(ix).fill('ArrowDown'),'Tab']){
  const code={Home:36,ArrowDown:40,Tab:9}[key];
  await pop.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code});
  await pop.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});
 }
 await until(()=>pop.eval(`(${query})?.value===${JSON.stringify(path)}`));
 const action={case:h.current,action:'Explicitly choose source using actual native mapping select keyboard',label,from:before.value,to:path,option:before.options[ix].label};
 h.actions.push(action);necessaryActions.push(action);
}

async function screenshotPage(page,name){await page.locator('#benchmark-summary').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(h.out,name+'.png'),fullPage:false});}
async function independentCheck(page,name,total){
 await page.locator('#check-result').click();
 const report=JSON.parse(await page.locator('#benchmark-report').innerText());
 const values=await page.locator('#application input, #application textarea, #application select').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.id,['checkbox','radio'].includes(e.type)?e.checked:e.value])));
 await h.write(name+'-independent.json',{report,actualValues:values});await screenshotPage(page,name+'-report');
 await page.locator('#benchmark-summary').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(h.out,name+'-source-metadata.png'),fullPage:false});
 const sourceMetadataCorrect=report.profileSource==='extension-user-selected'&&report.profileSourceVerifiedByPage===false&&report.profileSourceNote==='网页无法读取扩展来源，请在扩展预览核对；此处仅记录本人选择的验收模式。';
 await h.check(name,report.expectedItems===total&&report.correctItems===total&&report.wrongItems===0&&report.allCheckedItems.every(x=>x.correct)&&report.protectedFieldsUnchanged&&report.submissions===0&&report.mode==='extension-manual'&&sourceMetadataCorrect&&await page.locator('#use-extension').isChecked()&&await page.locator('#assistant').isHidden(),{report,actualValues:values,sourceMetadataCorrect,truths:'Unchanged public lab.mjs independent literal checker. No input values are written by the QA runner.',toolbarArchiveSource:'The same actual DOCX import saved in this isolated extension archive. The webpage honestly marks its source as user-selected and unverified; actual toolbar archive provenance is captured independently.'});
 return report;
}

try{
 await h.open();
 server=spawn(process.execPath,[resolve(source,'scripts/serve.mjs')],{cwd:source,windowsHide:true,env:{...process.env,JOB_WORKBENCH_PORT:'47841'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>serverText+=b);server.stderr.on('data',b=>serverText+=b);
 await until(async()=>{try{return(await(await fetch('http://127.0.0.1:47841/__health')).json()).pid===server.pid;}catch{return false;}});serverOwned=true;
 await h.write('process-ownership.json',{runnerPid:process.pid,productServerPid:server.pid,port:47841,spawnWindowsHide:true,isolatedHeadlessEdge:true});
 h.current='GB01-actual-docx-import-and-same-saved-profile';
 profilePage=await h.context.newPage();await profilePage.goto(`chrome-extension://${h.extensionId}/profile.html`);
 await profilePage.locator('#vault-password').fill(pass);const chooseSample=profilePage.waitForEvent('filechooser');await profilePage.locator('#start-resume-import').click();const sampleChooser=await chooseSample;await profilePage.locator('[data-path="contact.name"]').waitFor();await profilePage.locator('#fictional-marker').check();await sampleChooser.setFiles(sample);
 await profilePage.waitForFunction(()=>document.querySelector('#resume-import-status')?.textContent.includes('已读取 1 份'));
 await profilePage.screenshot({path:resolve(h.out,'00-real-docx-preview.png'),fullPage:false});
 await profilePage.locator('#resume-reviewed').check();if(await profilePage.locator('#resume-identity').isVisible())await profilePage.locator('#resume-identity').check();
 await profilePage.locator('#resume-confirm-save').click();await profilePage.locator('.ri-dialog').waitFor({state:'detached'});
 await profilePage.waitForFunction(()=>document.querySelector('#profile-status').textContent.includes('导入并加密保存成功'));
 const saved=await inspectArchive();await h.write('actual-imported-profile.private.json',saved.profile);
 await h.write('source-provenance.json',{sample,sourceSha256:sha(await readFile(sample)),archiveCiphertextSha256:saved.ciphertextSha256,profileSha256:saved.profileSha256,importSources:saved.profile.importData.sources,explicitSave:true,fictionalOnly:saved.profile.isFictional});
 await h.check(h.current,saved.profile.contact.name==='林知行'&&saved.profile.contact.givenName==='Zhixing'&&saved.profile.contact.familyName==='Lin'&&saved.profile.education.length===2&&saved.profile.internships.length===2&&saved.profile.projects.length===2&&saved.profile.isFictional&&saved.profile.importData.sources.some(s=>s.name==='林知行-完整虚构简历.docx')&&saved.profile.importData.fields.every(f=>f.reviewed),{sourceSha256:sha(await readFile(sample)),archiveCiphertextSha256:saved.ciphertextSha256,profileSha256:saved.profileSha256,groups:{education:saved.profile.education.length,internships:saved.profile.internships.length,work:saved.profile.work.length,projects:saved.profile.projects.length}});
 await profilePage.locator('#lock-profile').click();await profilePage.locator('#editor').waitFor({state:'hidden'});
 necessaryActions.push({action:'Mark isolated archive fictional, actually import DOCX, review selected extracted values and click 确认导入并加密保存 once; use its unchanged saved archive in B and C.'});

 h.current='GB02-public-B-actual-toolbar-18';
 activePage=await h.context.newPage();await activePage.goto('http://127.0.0.1:47841/autofill/lab/dynamic.html');await activePage.locator('#use-extension').check();
 necessaryActions.push({case:h.current,action:'Check 使用已安装的扩展验收; open actual toolbar, unlock, click 准备经历分组 to add Education 2.'});
 const b=await h.unlockScan(activePage,pass,{prepare:true});await b.snapshot('01-B-prepared-preview');
 const bGroups=await activePage.locator('#education-list > fieldset').count();
 await h.write('B-preparation.json',{educationGroups:bGroups,popupBody:await b.body(),expectedEducationGroups:2});
 const bApply=await h.apply(b);await b.snapshot('02-B-toolbar-result');await b.close();await sleep(250);
 const bReport=await independentCheck(activePage,h.current,18);
 if(bGroups!==2)await h.check('GB02a-B-exact-two-education-groups',false,{actualGroups:bGroups,expected:2});
 await h.write('B-toolbar-outcome.json',bApply);await activePage.close();

 h.current='GB03-public-C-step-one-actual-toolbar';
 activePage=await h.context.newPage();await activePage.goto('http://127.0.0.1:47841/autofill/lab/wizard.html');await activePage.locator('#use-extension').check();
 const c1=await h.unlockScan(activePage,pass);const initial=await c1.snapshot('03-C-step-one-initial-preview');
 const email=initial.rows.find(r=>r.label==='联系邮址');if(email&&!email.checked)await mapping(c1,'联系邮址','contact.email');
 const qualification=initial.rows.find(r=>r.label==='学历');if(qualification&&!qualification.checked)await mapping(c1,'学历','education.0.degree');
 await c1.snapshot('04-C-step-one-reviewed-preview');const c1Apply=await h.apply(c1);await c1.snapshot('05-C-step-one-toolbar-result');await c1.close();
 const firstStep=await activePage.evaluate(()=>({name:document.querySelector('#cName').value,email:document.querySelector('#cEmail').value,phone:document.querySelector('#cPhone').value,bachelor:document.querySelector('#cBachelor').checked,master:document.querySelector('#cMaster').checked,js:document.querySelector('#cJS').checked,sql:document.querySelector('#cSQL').checked,go:document.querySelector('#cGo').checked,date:document.querySelector('#cStart').value,code:document.querySelector('#cCode').value,custom:document.querySelector('#cCustom').value,stepTwoHidden:document.querySelector('#step-two').hidden,submits:document.querySelector('#submission-count').textContent}));
 await h.write('C-step-one.json',{firstStep,popup:c1Apply});
 await h.check(h.current,firstStep.name==='林知行'&&firstStep.email==='lin.zhixing@example.com'&&firstStep.phone==='19900000000'&&firstStep.bachelor&&!firstStep.master&&firstStep.js&&firstStep.sql&&!firstStep.go&&firstStep.date===''&&firstStep.code===''&&firstStep.custom===''&&firstStep.stepTwoHidden&&firstStep.submits==='0',{firstStep});
 await activePage.locator('#next-step').click();await activePage.locator('#step-two').waitFor({state:'visible'});
 necessaryActions.push({case:h.current,action:'Click 下一步（由你点击） on webpage; the extension did not navigate steps.'});h.actions.push(necessaryActions.at(-1));
 h.current='GB04-public-C-completed-actual-toolbar-19';
 const c2=await h.unlockScan(activePage,pass);await c2.snapshot('06-C-step-two-preview');const c2Apply=await h.apply(c2);await c2.snapshot('07-C-step-two-toolbar-result');await c2.close();await sleep(250);
 await independentCheck(activePage,h.current,19);await h.write('C-step-two-toolbar-outcome.json',c2Apply);
 const after=await inspectArchive();await h.check('GB05-same-imported-archive-unchanged-for-B-and-C',after.ciphertextSha256===saved.ciphertextSha256&&after.profileSha256===saved.profileSha256,{before:{ciphertext:saved.ciphertextSha256,profile:saved.profileSha256},after:{ciphertext:after.ciphertextSha256,profile:after.profileSha256}});
 await h.check('GB06-no-outbound-and-no-unhandled-browser-errors',h.network.every(r=>r.surface!=='blocked-external')&&h.network.filter(r=>r.url.startsWith('http:')).every(r=>r.method==='GET'&&!r.postData)&&h.errors.filter(e=>e.error).length===0,{blockedOutbound:h.network.filter(r=>r.surface==='blocked-external'),errors:h.errors.filter(e=>e.error)});
 await h.write('guide-actions.json',necessaryActions);
 await h.write('scope.json',{purpose:'指南实际步骤补证',primary80NotExpanded:true,actualSavedDocxProfileOnly:true,actualToolbarOnly:true,runnerNeverFillsTargetInputs:true,publicTruthValuesNotChanged:true,sourceProfileUnchanged:true,initialPublicBExpected:18,initialPublicCExpected:19,B:bReport,necessaryActions});
}catch(e){fatal=e.stack;console.error(fatal);await h.write('infrastructure-error.txt',fatal);if(activePage)await h.capture(activePage,'interrupted-page').catch(()=>{});if(h.popup)await h.popup.snapshot('interrupted-popup').catch(()=>{});}
finally{
 if(server){const exited=new Promise(r=>server.once('exit',r));if(server.exitCode===null){server.kill();await Promise.race([exited,sleep(5000)]);}}
 await h.write('product-server.log',serverText);await h.write('process-cleanup.json',{productServerPid:server?.pid,wasOwned:serverOwned,serverExitCode:server?.exitCode,serverSignal:server?.signalCode,finishedAt:new Date().toISOString()});
 await h.close({fatal});if(fatal||h.cases.some(c=>c.status==='FAIL'))process.exitCode=1;
}
