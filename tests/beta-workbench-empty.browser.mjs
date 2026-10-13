import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.BETA_PLAYWRIGHT||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),port=47951,out=resolve(root,'.local','beta-empty-jobs-'+Date.now()),base='http://127.0.0.1:'+port;
await mkdir(out,{recursive:true});
const empty=JSON.parse(await readFile(resolve(root,'public/data/jobs.json'),'utf8'));assert.equal(empty.jobs.length,0,'Only the genuine public empty dataset is tested');
const report={startedAt:new Date().toISOString(),cases:[],requests:[],pageErrors:[]};let server,browser,fatal=null;
async function check(id,fn){try{const details=await fn();report.cases.push({id,status:'PASS',...details});}catch(error){report.cases.push({id,status:'FAIL',error:error.stack});throw error;}}
try{
 server=spawn(process.execPath,[resolve(root,'scripts/serve.mjs')],{cwd:root,env:{...process.env,JOB_WORKBENCH_PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
 for(let i=0;i<50;i++){try{const h=await(await fetch(base+'/__health')).json();if(h.pid!==server.pid)throw Error('Port belongs to another service');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.equal((await(await fetch(base+'/__health')).json()).pid,server.pid);
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));context.on('request',r=>report.requests.push({url:r.url(),method:r.method()}));
 let mode='valid';await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base)return route.abort();if(u.pathname==='/data/jobs.json')return route.fulfill(mode==='missing'?{status:404,body:'not found'}:{status:200,contentType:'application/json',body:JSON.stringify(mode==='corrupt'?{...empty,schemaVersion:999}:empty)});return route.continue();});
 await check('EMPTY01-valid-empty-is-normal-and-preserves-search-controls',async()=>{
  await page.goto(base);await page.waitForFunction(()=>!document.querySelector('#result-count').textContent.includes('载入'));
  assert.equal(await page.locator('#load-error').isVisible(),false);assert.match(await page.locator('#job-list').innerText(),/暂未导入岗位数据/);assert.match(await page.locator('#coverage-note').innerText(),/不包含未经许可/);
  await page.locator('#search').fill('不会凭空生成的岗位');await page.locator('#search-form button').click();assert.equal(await page.locator('.job-card').count(),0);assert.match(await page.locator('#result-count').innerText(),/0/);
  await page.locator('#save-search').click();await page.locator('#action-input').fill('空快照验收条件');await page.locator('#action-confirm').click();assert.equal(await page.getByRole('button',{name:'↳ 空快照验收条件',exact:true}).count(),1);
  await page.screenshot({path:resolve(out,'valid-empty.png'),fullPage:true});return {jobs:0,alertHidden:true,savedSearchWorks:true};
 });
 for(const[fixture,id]of[['corrupt','EMPTY02-unsupported-schema-is-a-visible-error'],['missing','EMPTY03-real-http-failure-is-a-visible-error']])await check(id,async()=>{
  mode=fixture;await page.reload();await page.locator('#load-error').waitFor({state:'visible'});assert.equal(await page.locator('#result-count').innerText(),'岗位数据暂不可用');assert.match(await page.locator('#load-error').innerText(),fixture==='corrupt'?/格式或版本不支持/:/404/);assert.equal(await page.locator('.job-card').count(),0);await page.screenshot({path:resolve(out,fixture+'.png'),fullPage:true});return {alert:await page.locator('#load-error').innerText(),noInventedJobs:true};
 });
 assert.deepEqual(report.pageErrors,[]);assert.ok(report.requests.every(r=>r.method==='GET'&&r.url.startsWith(base)));
}catch(error){fatal=error.stack;process.exitCode=1;}finally{
 if(browser)await browser.close();if(server)server.kill();report.fatal=fatal;report.finishedAt=new Date().toISOString();report.counts={pass:report.cases.filter(r=>r.status==='PASS').length,fail:report.cases.filter(r=>r.status==='FAIL').length};await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,counts:report.counts,fatal}));
}
