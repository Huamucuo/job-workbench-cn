import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),runtime=process.env.BETA_PLAYWRIGHT||'C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const {chromium}=require(runtime),root=resolve(fileURLToPath(new URL('..',import.meta.url))),out=resolve(root,'.local','beta-profile-ui-'+Date.now());
await mkdir(out,{recursive:true});
const report={startedAt:new Date().toISOString(),method:'Real Edge, isolated profile, mouse/keyboard/file controls, local fictional data only. No mocked storage or engine.',cases:[],errors:[],requests:[],out};
const context=await chromium.launchPersistentContext(resolve(out,'isolated-edge-profile'),{channel:'msedge',headless:true,viewport:{width:1360,height:950},acceptDownloads:true});
const password='beta-profile-fiction-only!',vaultKey='zhiyouyinli.profile.encrypted.v2',payload=Buffer.from('Fictional attachment\n\0\xff','latin1');
const url=process.env.BETA_PROFILE_URL||'http://127.0.0.1:47841/profile.html';
context.setDefaultTimeout(15000);context.on('request',request=>report.requests.push({url:request.url(),method:request.method()}));
context.on('page',page=>page.on('pageerror',error=>report.errors.push(error.message)));
await context.route('**/*',route=>{const target=new URL(route.request().url());if(target.hostname==='127.0.0.1'||['data:','about:','blob:'].includes(target.protocol))return route.continue();report.errors.push('Unexpected external request '+target.href);return route.abort();});
let fatal=null;
const record=async(id,work)=>{await work();report.cases.push({id,status:'PASS'});console.log('PASS '+id);};
const fill=async(page,path,value)=>page.locator('[data-path="'+path+'"]').fill(value);
const waitSaved=async page=>{const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.ciphertext||null,vaultKey);await page.locator('#save-profile').click();await page.waitForFunction(({key,before})=>!document.querySelector('#profile-controls').inert&&document.querySelector('#profile-status').textContent.startsWith('保存成功')&&JSON.parse(localStorage.getItem(key)||'null')?.ciphertext!==before,{key:vaultKey,before});};
try{
 const page=await context.newPage();await page.goto(url);await page.locator('#vault-password').fill(password);await page.locator('#create').click();await page.locator('#editor').waitFor({state:'visible'});
 await record('grouped-fields-academic-languages-about',async()=>{
  await fill(page,'contact.name','虚构验收者');await fill(page,'contact.email','beta-fiction@example.com');await fill(page,'contact.phone','19900000000');
  await page.getByRole('button',{name:'＋ 添加教育经历',exact:true}).click();
  for(const[key,value]of Object.entries({school:'虚构大学',degree:'本科',academicDegree:'工学学士',major:'软件工程',startDate:'2017-09',endDate:'2021-06'}))await fill(page,'education.0.'+key,value);
  await page.getByRole('button',{name:'＋ 添加语言能力',exact:true}).click();await fill(page,'languages.0.name','英语');await fill(page,'languages.0.level','熟练');await fill(page,'languages.0.certificate','CET-6');
  await fill(page,'about.introduction','只用于本机验收的自我介绍。');
  await page.getByRole('button',{name:'＋ 添加工作经历',exact:true}).click();
  for(const[key,value]of Object.entries({organization:'虚构公司',title:'工具开发者',startDate:'2021-07',endDate:'2025-06',description:'维护本机资料工具。'}))await fill(page,'work.0.'+key,value);
  assert.equal(await page.locator('[data-path="education.0.degree"]').inputValue(),'本科');assert.equal(await page.locator('[data-path="education.0.academicDegree"]').inputValue(),'工学学士');
 });
 await record('wording-version-local-edit',async()=>{
  await page.locator('#new-variant-name').fill('工具岗位');await page.locator('#add-variant').click();
  await page.locator('#profile-variants summary').filter({hasText:'工作经历 1'}).click();await page.locator('[data-variant-record]').fill('参与维护本机资料工具。');
  await page.locator('[data-variant-about="introduction"]').fill('有本机资料工具维护经历。');
  assert.equal(await page.locator('[data-path="work.0.description"]').inputValue(),'维护本机资料工具。');assert.equal(await page.locator('#variant-name').inputValue(),'工具岗位');
 });
 await record('attachment-real-local-add',async()=>{
  await page.locator('#attachment-file').setInputFiles({name:'fictional-material.txt',mimeType:'text/plain',buffer:payload});
  await page.locator('[data-attachment-download]').waitFor();assert.match(await page.locator('#profile-attachments').innerText(),/fictional-material\.txt/);
 });
 await record('explicit-save-lock-recovers-without-commit',async()=>{
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),vaultKey),null);
  await page.locator('#lock-profile').click();await page.locator('#vault-gate').waitFor({state:'visible'});
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),vaultKey),null);
  const recovered=await page.evaluate(key=>localStorage.getItem(key+'.draft'),vaultKey);assert.ok(recovered);assert.equal(recovered.includes('虚构验收者'),false);
  await page.locator('#vault-password').fill(password);await page.locator('#unlock').click();await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-path="languages.0.name"]').inputValue(),'英语');assert.equal(await page.locator('#variant-name').inputValue(),'工具岗位');await waitSaved(page);
 });
 await record('saved-reopen-all-beta-fields',async()=>{
  const ciphertext=await page.evaluate(key=>localStorage.getItem(key),vaultKey);assert.ok(ciphertext);assert.equal(ciphertext.includes('fictional-material'),false);assert.equal(ciphertext.includes('工具岗位'),false);
  await page.reload();await page.locator('#vault-password').fill(password);await page.locator('#unlock').click();await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-path="education.0.academicDegree"]').inputValue(),'工学学士');assert.equal(await page.locator('#variant-name').inputValue(),'工具岗位');
  assert.equal(await page.locator('[data-variant-about="introduction"]').inputValue(),'有本机资料工具维护经历。');
 });
 await record('attachment-sha-verified-download-exact-bytes',async()=>{
  const pending=page.waitForEvent('download');await page.locator('[data-attachment-download]').click();const download=await pending,path=resolve(out,'attachment-download.txt');await download.saveAs(path);assert.deepEqual(await readFile(path),payload);
 });
 let backupPath;
 await record('encrypted-export-restore-cycle',async()=>{
  const pending=page.waitForEvent('download');await page.locator('#export-profile').click();const download=await pending;backupPath=resolve(out,'encrypted-backup.private.json');await download.saveAs(backupPath);
  const exported=await readFile(backupPath,'utf8');assert.equal(exported.includes('虚构验收者'),false);assert.equal(exported.includes('fictional-material.txt'),false);
  await page.locator('#lock-profile').click();await page.locator('#vault-gate').waitFor({state:'visible'});await page.locator('#profile-file').setInputFiles(backupPath);await page.locator('#vault-password').fill(password);await page.locator('#unlock').click();await page.locator('#editor').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-path="languages.0.certificate"]').inputValue(),'CET-6');assert.equal(await page.locator('[data-attachment-download]').count(),1);await waitSaved(page);
 });
 await record('stale-window-CAS-rejects-overwrite',async()=>{
  const other=await context.newPage();await other.goto(url);await other.locator('#vault-password').fill(password);await other.locator('#unlock').click();await other.locator('#editor').waitFor({state:'visible'});
  await fill(page,'contact.city','虚构城市甲');await waitSaved(page);
  const expected=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).ciphertext,vaultKey);
  await fill(other,'contact.city','虚构城市乙');await other.locator('#save-profile').click();await other.waitForFunction(()=>document.querySelector('#profile-status').textContent.includes('另一窗口'));
  assert.equal(await other.evaluate(key=>JSON.parse(localStorage.getItem(key)).ciphertext,vaultKey),expected);
 });
 await record('small-window-save-controls-visible',async()=>{
  await page.setViewportSize({width:375,height:720});
  const bounds=await page.locator('#save-profile').boundingBox();assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=720);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(out,'profile-small.png')});
  await page.setViewportSize({width:1360,height:950});await page.screenshot({path:resolve(out,'profile-desktop.png'),fullPage:true});
 });
 assert.deepEqual(report.errors,[]);
 assert.ok(report.requests.every(request=>request.method==='GET'));
}catch(error){fatal=error.stack;report.failurePages=[];for(const[pageIndex,current]of context.pages().entries()){report.failurePages.push(await current.evaluate(()=>({url:location.href,status:document.querySelector('#profile-status')?.textContent,save:document.querySelector('#save-state')?.textContent,gate:document.querySelector('#vault-exists')?.textContent,editorHidden:document.querySelector('#editor')?.hidden,city:document.querySelector('[data-path="contact.city"]')?.value})).catch(()=>({unreadable:true})));await current.screenshot({path:resolve(out,'failure-'+pageIndex+'.png')}).catch(()=>{});}console.error(fatal);process.exitCode=1;}
finally{report.fatal=fatal;report.finishedAt=new Date().toISOString();await context.close();await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:!fatal,count:report.cases.length,out}));}
