import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const runtime=process.env.BETA_PLAYWRIGHT||'playwright';
const {chromium}=require(runtime);
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),out=resolve(root,'.local/beta-enhanced-samples'),port=47950;
const expected=JSON.parse(await readFile(resolve(out,'expected.private.json'),'utf8'));
const report={startedAt:new Date().toISOString(),scope:'Original enhanced DOCX and standard-CID text PDF through actual isolated Edge web UI only. No MV3/shared-vault claim.',port,files:[],pageErrors:[],consoleWarnings:[],requests:[],cases:[]};
const pass='Enhanced-Fictional-Beta-2026!',key='zhiyouyinli.profile.encrypted.v2';
const until=async(fn,timeout=25000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('UI wait timeout');};
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
async function decrypt(envelope){const c=webcrypto.subtle,seed=await c.importKey('raw',Buffer.from(pass),'PBKDF2',false,['deriveKey']),k=await c.deriveKey({name:'PBKDF2',salt:Buffer.from(envelope.salt,'base64'),iterations:envelope.iterations,hash:'SHA-256'},seed,{name:'AES-GCM',length:256},false,['decrypt']);return JSON.parse(Buffer.from(await c.decrypt({name:'AES-GCM',iv:Buffer.from(envelope.iv,'base64'),additionalData:Buffer.from('job-workbench-profile-v2')},k,Buffer.from(envelope.ciphertext,'base64'))).toString());}
function expectedFields(){const rows={};for(const[section,value]of Object.entries(expected)){if(Array.isArray(value)){value.forEach((row,index)=>{for(const[field,value]of Object.entries(row))rows[section+'.'+index+'.'+field]=value;});}else for(const[field,text]of Object.entries(value))rows[section+'.'+field]=text;}return rows;}
const wants=expectedFields();
const UI=async page=>Object.fromEntries(await page.locator('[data-path]').evaluateAll(nodes=>nodes.map(node=>[node.dataset.path,node.value])));
function compare(actual,label){const diffs=[];for(const[path,want]of Object.entries(wants))if(actual[path]!==want)diffs.push({path,want,actual:actual[path]});if(diffs.length)throw Error(label+' field differences '+JSON.stringify(diffs));return Object.keys(wants).length;}
function profileValues(profile){const values={};for(const[section,value]of Object.entries(expected)){if(Array.isArray(value)){assert.equal(profile[section].length,value.length,section+' record count');profile[section].forEach((row,index)=>{for(const[field]of Object.entries(value[index]))values[section+'.'+index+'.'+field]=row[field];});}else for(const[field]of Object.entries(value))values[section+'.'+field]=profile[section][field];}return values;}
let server,browser,fatal=null,serverText='';
try{
 await mkdir(out,{recursive:true});
 server=spawn(process.execPath,[resolve(root,'scripts/serve.mjs')],{cwd:root,env:{...process.env,JOB_WORKBENCH_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>serverText+=data);server.stderr.on('data',data=>serverText+=data);
 await until(async()=>{try{const response=await fetch('http://127.0.0.1:'+port+'/__health');return response.ok&&(await response.json()).pid===server.pid;}catch{return false;}});
 report.server={pid:server.pid,port,ownedByRunner:true,windowsHide:true};
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const ext of ['docx','pdf']){
  const name='沈星澄-Beta增强虚构简历.'+ext,file=resolve(root,'public/autofill/samples',name),bytes=await readFile(file);
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  context.on('request',request=>report.requests.push({format:ext,url:request.url(),method:request.method(),postData:request.postData()}));
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='http://127.0.0.1:'+port||['data:','about:','blob:'].includes(u.protocol))return route.continue();report.pageErrors.push('Unexpected external request '+u.href);return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',error=>report.pageErrors.push({format:ext,message:error.message}));
  page.on('console',message=>{if(['warning','error'].includes(message.type()))report.consoleWarnings.push({format:ext,type:message.type(),text:message.text()});});
  const proof={name,sha256:sha(bytes),size:bytes.length,format:ext,manualCorrections:[],checks:[]};report.files.push(proof);
  try{
   await page.goto('http://127.0.0.1:'+port+'/profile.html');
   await page.locator('#vault-password').fill(pass);await page.locator('#create').click();await page.locator('#editor').waitFor({state:'visible'});await page.locator('#fictional-marker').check();
   await page.locator('#resume-files').setInputFiles(file);
   await page.waitForFunction(()=>document.querySelector('#resume-import-status')?.textContent.includes('已读取 1 份'),null,{timeout:30000});
   const preview=await page.locator('.ri-dialog').textContent(),previewStatus=await page.locator('#resume-import-status').innerText();
   proof.previewStatus=previewStatus;proof.previewSourceNotes=await page.locator('.ri-dialog .ri-source').allTextContents();
   assert.ok(preview.includes(name));
   assert.ok(proof.previewSourceNotes.some(note=>note.includes('学位')||note.includes('工学学士')));
   assert.ok(proof.previewSourceNotes.some(note=>note.includes('语种：英语')));
   assert.ok(proof.previewSourceNotes.some(note=>note.includes('仅为测试：我参与资料工具维护')));
   if(ext==='pdf')assert.ok(preview.includes('第3页'),'actual PDF sources include page 3');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null,'preview does not commit valid profile');
   await page.screenshot({path:resolve(out,ext+'-actual-preview.png')});
   await writeFile(resolve(out,ext+'-preview.private.txt'),preview);
   proof.checks.push({id:'actual-file-preview-and-source',status:'PASS'});
   await page.locator('#resume-reviewed').check();if(await page.locator('#resume-identity').isVisible())await page.locator('#resume-identity').check();
   await page.locator('#resume-confirm-save').click();await page.locator('.ri-dialog').waitFor({state:'detached'});
   proof.appliedFieldCount=compare(await UI(page),ext+' applied');
   proof.checks.push({id:'one-confirmation-applies-and-saves-all-explicit-fields',status:'PASS',fieldCount:proof.appliedFieldCount});
   await page.waitForFunction(key=>!document.querySelector('#profile-controls').inert&&document.querySelector('#save-state').textContent.includes('已加密保存')&&localStorage.getItem(key),key);
   assert.match(await page.locator('#profile-status').innerText(),/导入并加密保存成功/);
   const raw=await page.evaluate(key=>localStorage.getItem(key),key);assert.equal(raw.includes('沈星澄'),false);
   const saved=await decrypt(JSON.parse(raw));proof.savedFieldCount=compare(profileValues(saved),ext+' saved');
   assert.equal(saved.importData.sources.length,1);assert.equal(saved.importData.sources[0].id,sha(bytes));assert.equal(saved.importData.sources[0].name,name);
   assert.equal(saved.importData.fields.length,Object.keys(wants).length);assert.ok(saved.importData.fields.every(ref=>ref.reviewed&&ref.quote));
   proof.sources=saved.importData.sources.map(source=>({id:source.id,name:source.name,type:source.type,warnings:source.warnings}));
   proof.provenance=saved.importData.fields.map(ref=>({path:ref.path,line:ref.line,page:ref.page,quote:ref.quote,confidence:ref.confidence,reviewed:ref.reviewed}));
   proof.unresolved=saved.importData.unresolved;proof.counts=Object.fromEntries(Object.keys(expected).filter(section=>Array.isArray(expected[section])).map(section=>[section,saved[section].length]));
   await writeFile(resolve(out,ext+'-saved-profile.private.json'),JSON.stringify(saved,null,2));
   proof.checks.push({id:'encrypted-save-and-full-source-provenance',status:'PASS',fieldCount:proof.savedFieldCount,sourceFieldCount:saved.importData.fields.length});
   await page.locator('#lock-profile').click();await page.locator('#vault-gate').waitFor({state:'visible'});
   await page.locator('#vault-password').fill(pass);await page.locator('#unlock').click();await page.locator('#editor').waitFor({state:'visible'});
   proof.reopenedFieldCount=compare(await UI(page),ext+' reopened');
   await page.locator('#import-history > details > summary').click();
   await page.screenshot({path:resolve(out,ext+'-actual-saved-reopened.png')});
   await writeFile(resolve(out,ext+'-history.private.txt'),await page.locator('#import-history').textContent());
   proof.checks.push({id:'actual-reopen-all-explicit-fields',status:'PASS',fieldCount:proof.reopenedFieldCount});
   report.cases.push({id:ext+'-enhanced-file-import',status:'PASS',fieldCount:proof.reopenedFieldCount,manualCorrections:proof.manualCorrections.length,unresolved:proof.unresolved.length});
   console.log('PASS '+ext+' explicitFields='+proof.reopenedFieldCount+' sourceFields='+saved.importData.fields.length+' unresolved='+proof.unresolved.length);
  }catch(error){proof.failure=error.stack;await page.screenshot({path:resolve(out,ext+'-failure.png')}).catch(()=>{});await writeFile(resolve(out,ext+'-failure-ui.private.txt'),await page.locator('body').innerText().catch(()=>''));throw error;}
  finally{await context.close();}
 }
 assert.deepEqual(report.pageErrors,[]);
 assert.ok(report.requests.every(request=>request.method==='GET'&&!request.postData));
}catch(error){fatal=error.stack;console.error(fatal);process.exitCode=1;}
finally{
 if(browser)await browser.close();
 if(server){server.kill();await new Promise(resolve=>{if(server.exitCode!==null)return resolve();server.once('exit',resolve);setTimeout(resolve,2000);});}
 report.fatal=fatal;report.finishedAt=new Date().toISOString();report.serverLog=serverText;
 await writeFile(resolve(out,'actual-file-ui-report.private.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:!fatal,cases:report.cases,report:resolve(out,'actual-file-ui-report.private.json')}));
}

