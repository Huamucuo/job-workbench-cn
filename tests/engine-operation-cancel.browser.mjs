import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.BETA_PLAYWRIGHT || 'C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = resolve('.local/crosspage-20261013'); await mkdir(out, { recursive: true });
const sources = await Promise.all(['rules.js', 'page-watch.js', 'engine.js'].map(name => readFile('public/autofill/' + name, 'utf8')));
const html = '<!doctype html><title>Operation cancel fixture</title><body data-application-id="guard-app-42"><form><label>姓名<input id="name"></label><label>邮箱<input id="email"></label><button type="submit">Submit</button></form>';
const server = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(47960, '127.0.0.1', resolve); });
let browser; const checks = [], pageErrors = [];
const check = async (name, fn) => { try { await fn(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); } if (process.env.ENGINE_CANCEL_PROGRESS) console.log(JSON.stringify(checks.at(-1))); };
const fixture = async (withWatcher = true, delayWatcher = false) => {
  const page = await browser.newPage(); page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:47960/application/contact', { waitUntil: 'domcontentloaded' });
  const cdp = await page.context().newCDPSession(page), tree = await cdp.send('Page.getFrameTree');
  const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'engine-cancel-test' });
  const run = async expression => {
    const result = await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  for (let i = 0; i < sources.length; i++) if (i !== 1 || withWatcher) {
    let source = sources[i];
    // Delay the actual read result only; never synthesize context/fingerprint.
    if (i === 1 && delayWatcher) source = source.replace('Object.freeze({ read', `Object.freeze({ read: async () => {
      const stack = new Error().stack || '', result = await read();
      if (globalThis.__delayMode && !globalThis.__delayDone) {
        const count = globalThis.__watchReadCount = (globalThis.__watchReadCount || 0) + 1;
        const selected = globalThis.__delayMode === 'custom' ? stack.includes('selectCustom') && !stack.includes('observeStable') : count === globalThis.__delayMode;
        if (selected) { globalThis.__delayDone = true; document.body.dataset.watchWaiting = '1'; await new Promise(resolve => setTimeout(resolve, 250)); }
      }
      return result;
    }`);
    await run(source);
  }
  return { page, run };
};
const nativeSetup = `const scan=JobAutofillEngine.scan(),items=scan.fields.map((f,i)=>({fieldId:f.id,value:i?'person@example.com':'Fixture Person',overwrite:false})); const operationId=crypto.randomUUID(), contextKey=(await JobAutofillPageWatcher.read()).contextKey;`;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  await check('unguarded original apply and prepare APIs remain compatible', async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{${nativeSetup} const report=await JobAutofillEngine.apply(scan.scanId,items);const prepared=await JobAutofillEngine.prepareGroups({education:0});return {report,prepared,name:document.querySelector('#name').value,email:document.querySelector('#email').value};})()`);
      assert.equal(result.report.filled, 2); assert.equal(result.name, 'Fixture Person'); assert.equal(result.email, 'person@example.com'); assert.equal(result.prepared.clicks, 0);
    } finally { await page.close(); }
  });
  await check('pre-arrival cancellation prevents all guarded writes', async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{${nativeSetup} JobAutofillEngine.cancelOperation?.(operationId);const report=await JobAutofillEngine.apply(scan.scanId,items,{operationId,contextKey,expiresAt:Date.now()+10000});return {report,values:[...document.querySelectorAll('input')].map(e=>e.value)};})()`);
      assert.deepEqual(result.values, ['', '']); assert.equal(result.report.filled, 0); assert.equal(result.report.skipped, 2); assert.match(result.report.results[0].reason, /取消/);
    } finally { await page.close(); }
  });
  for (const mode of ['cancel', 'expiry', 'context']) await check('guarded apply stops later writes during ' + mode, async () => {
    const { page, run } = await fixture(); try {
      const action = mode === 'cancel' ? `setTimeout(()=>JobAutofillEngine.cancelOperation?.(operationId),15);` : mode === 'context' ? `document.querySelector('#name').addEventListener('input',()=>document.body.dataset.applicationId='changed-app');` : '';
      const result = await run(`(async()=>{${nativeSetup}${action} const report=await JobAutofillEngine.apply(scan.scanId,items,{operationId,contextKey,expiresAt:Date.now()+${mode === 'expiry' ? 20 : 10000}});return {report,name:document.querySelector('#name').value,email:document.querySelector('#email').value};})()`);
      assert.equal(result.name, 'Fixture Person'); assert.equal(result.email, '', 'later field must stay untouched');
      assert.equal(result.report.filled, 0, 'interrupted verification cannot be presented as success'); assert.equal(result.report.pending, 1); assert.equal(result.report.skipped, 1);
      assert.match(result.report.results[0].reason, /取消|过期|申请/); assert.match(result.report.results[1].reason, /取消|过期|申请/);
    } finally { await page.close(); }
  });
  await check('a context that changes and returns cannot resume the interrupted operation', async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{${nativeSetup}document.querySelector('#name').addEventListener('input',()=>{document.body.dataset.applicationId='temporary-other-app';queueMicrotask(()=>document.body.dataset.applicationId='guard-app-42');});const report=await JobAutofillEngine.apply(scan.scanId,items,{operationId,contextKey,expiresAt:Date.now()+10000});return {report,email:document.querySelector('#email').value};})()`);
      assert.equal(result.email, ''); assert.equal(result.report.filled, 0); assert.equal(result.report.pending, 1); assert.equal(result.report.skipped, 1);
    } finally { await page.close(); }
  });
  await check('cancellation in final validation reports existing writes pending rather than success', async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{${nativeSetup}setTimeout(()=>JobAutofillEngine.cancelOperation?.(operationId),150);const report=await JobAutofillEngine.apply(scan.scanId,items,{operationId,contextKey,expiresAt:Date.now()+10000});return {report,values:[...document.querySelectorAll('input')].map(e=>e.value)};})()`);
      assert.deepEqual(result.values, ['Fixture Person', 'person@example.com']); assert.equal(result.report.filled, 0); assert.equal(result.report.pending, 2);
      assert.ok(result.report.results.every(field => /取消/.test(field.reason)));
    } finally { await page.close(); }
  });
  for (const mode of ['cancel', 'expiry', 'context']) await check('guarded prepare stops further add clicks during ' + mode, async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{document.querySelector('form').innerHTML='<div id="records"><fieldset><legend>教育经历 1</legend><label>学校名称<input></label></fieldset></div><button type="button" id="add">新增教育经历</button>';let clicks=0;document.querySelector('#add').addEventListener('click',()=>{clicks++;setTimeout(()=>{const index=document.querySelectorAll('fieldset').length+1;document.querySelector('#records').insertAdjacentHTML('beforeend','<fieldset><legend>教育经历 '+index+'</legend><label>学校名称<input></label></fieldset>');},120);});const operationId=crypto.randomUUID(),contextKey=(await JobAutofillPageWatcher.read()).contextKey;${mode === 'cancel' ? 'setTimeout(()=>JobAutofillEngine.cancelOperation?.(operationId),40);' : mode === 'context' ? "setTimeout(()=>document.body.dataset.applicationId='other-app',40);" : ''}const report=await JobAutofillEngine.prepareGroups({education:3},{operationId,contextKey,expiresAt:Date.now()+${mode === 'expiry' ? 50 : 10000}});await new Promise(r=>setTimeout(r,150));return {report,clicks,records:document.querySelectorAll('fieldset').length};})()`);
      assert.equal(result.clicks, 1); assert.equal(result.report.clicks, 1); assert.equal(result.records, 2);
      assert.ok(result.report.groups.some(group => /取消|过期|申请/.test(group.reason || '')), JSON.stringify(result.report));
    } finally { await page.close(); }
  });
  for (const mode of ['cancel', 'url']) await check('custom-option async waiting stops before option activation on ' + mode, async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{document.querySelector('form').innerHTML='<div class="form-item"><span class="form-item__text">现居城市</span><div id="city" class="phoenix-select" data-value=""><button type="button" aria-controls="city-options">请选择</button><div id="city-options" role="listbox" hidden></div></div><label>邮箱<input id="email"></label>';let clicks=0;const root=document.querySelector('#city'),list=document.querySelector('#city-options');root.querySelector('button').addEventListener('click',()=>{list.hidden=false;setTimeout(()=>{list.innerHTML='<div role="option" data-value="hz">杭州</div>';list.firstElementChild.addEventListener('click',()=>{clicks++;root.dataset.value='hz';});},300);});const scan=JobAutofillEngine.scan(),operationId=crypto.randomUUID(),contextKey=(await JobAutofillPageWatcher.read()).contextKey;setTimeout(()=>${mode === 'cancel' ? 'JobAutofillEngine.cancelOperation?.(operationId)' : "history.pushState({},'', '/application/work')"},70);const report=await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:'杭州',choice:{path:'contact.city'}},{fieldId:scan.fields[1].id,value:'person@example.com'}],{operationId,contextKey,expiresAt:Date.now()+10000});return {report,clicks,email:document.querySelector('#email').value};})()`);
      assert.equal(result.clicks, 0); assert.equal(result.email, ''); assert.equal(result.report.filled, 0); assert.equal(result.report.skipped, 2);
    } finally { await page.close(); }
  });
  await check('same checkbox group stops between event-driven context changes', async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{document.querySelector('form').innerHTML='<fieldset><legend>技能</legend><label><input type="checkbox" id="first" name="skills" value="JavaScript">JavaScript</label><label><input type="checkbox" id="second" name="skills" value="SQL">SQL</label></fieldset>';document.querySelector('#first').addEventListener('click',()=>document.body.dataset.applicationId='different');const scan=JobAutofillEngine.scan(),operationId=crypto.randomUUID(),contextKey=(await JobAutofillPageWatcher.read()).contextKey;const report=await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:['JavaScript','SQL']}],{operationId,contextKey,expiresAt:Date.now()+10000});return {report,first:document.querySelector('#first').checked,second:document.querySelector('#second').checked};})()`);
      assert.equal(result.first, true); assert.equal(result.second, false); assert.equal(result.report.pending, 1); assert.equal(result.report.filled, 0);
    } finally { await page.close(); }
  });
  await check('guarded checkbox group stops on same-context same-document URL changes', async () => {
    const { page, run } = await fixture(); try {
      const result = await run(`(async()=>{document.querySelector('form').innerHTML='<fieldset><legend>技能</legend><label><input type="checkbox" id="first" name="skills" value="JavaScript">JavaScript</label><label><input type="checkbox" id="second" name="skills" value="SQL">SQL</label></fieldset>';document.querySelector('#first').addEventListener('click',()=>history.pushState({},'', '/application/work'));const scan=JobAutofillEngine.scan(),operationId=crypto.randomUUID(),contextKey=(await JobAutofillPageWatcher.read()).contextKey;const report=await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:['JavaScript','SQL']}],{operationId,contextKey,expiresAt:Date.now()+10000});return {report,first:document.querySelector('#first').checked,second:document.querySelector('#second').checked,currentKey:(await JobAutofillPageWatcher.read()).contextKey,contextKey};})()`);
      assert.equal(result.currentKey, result.contextKey); assert.equal(result.first, true); assert.equal(result.second, false); assert.equal(result.report.pending, 1); assert.equal(result.report.filled, 0); assert.match(result.report.results[0].reason, /导航|页面/);
    } finally { await page.close(); }
  });
  await check('malformed guards or absent watcher fail before any write', async () => {
    for (const bad of ['null', '{}', `{operationId:'not-uuid',contextKey:'',expiresAt:Date.now()+1000}`, `{operationId:crypto.randomUUID(),contextKey:'raw-id',expiresAt:Date.now()+1000}`, `{operationId:crypto.randomUUID(),contextKey:'',expiresAt:Date.now()+121000}`, `{operationId:crypto.randomUUID(),contextKey:'',expiresAt:NaN}`, `{operationId:crypto.randomUUID(),contextKey:'',expiresAt:Date.now()+1000,extra:true}`]) {
      const { page, run } = await fixture(); try {
        const result = await run(`(async()=>{const scan=JobAutofillEngine.scan();let rejected=false;try{await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:'Fixture Person'}],${bad});}catch{rejected=true;}return {rejected,name:document.querySelector('#name').value};})()`);
        assert.equal(result.rejected, true, bad); assert.equal(result.name, '');
      } finally { await page.close(); }
    }
    const { page, run } = await fixture(false); try {
      const result = await run(`(async()=>{const scan=JobAutofillEngine.scan();let rejected=false;try{await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:'Fixture Person'}],{operationId:crypto.randomUUID(),contextKey:'',expiresAt:Date.now()+1000});}catch{rejected=true;}return {rejected,name:document.querySelector('#name').value};})()`);
      assert.equal(result.rejected, true); assert.equal(result.name, '');
    } finally { await page.close(); }
  });
  for (const mode of ['manual', 'label', 'replacement', 'context', 'unknown-to-known']) await check('delayed real watcher preserves native target on ' + mode, async () => {
    const { page, run } = await fixture(true, true); try {
      if (mode === 'unknown-to-known') await page.evaluate(() => { delete document.body.dataset.applicationId; });
      const pending = run(`(async()=>{${nativeSetup}globalThis.__delayMode=2;const report=await JobAutofillEngine.apply(scan.scanId,[items[0]],{operationId,contextKey,expiresAt:Date.now()+10000});return report;})()`);
      await page.waitForFunction(() => document.body.dataset.watchWaiting === '1', null, { timeout: 10000 }).catch(async () => { throw new Error('Actual read delay gate not reached: ' + JSON.stringify(await pending)); });
      if (mode === 'manual') await page.locator('#name').fill('Manual correction');
      else if (mode === 'label') await page.evaluate(() => { document.querySelector('#name').closest('label').firstChild.textContent = '紧急联系人姓名'; });
      else if (mode === 'replacement') await page.evaluate(() => { window.oldTarget = document.querySelector('#name'); window.oldTarget.replaceWith(window.oldTarget.cloneNode(true)); });
      else await page.evaluate(() => { document.body.dataset.applicationId = 'changed-during-hash'; });
      const report = await pending;
      assert.equal(await page.locator('#name').inputValue(), mode === 'manual' ? 'Manual correction' : '');
      if (mode === 'replacement') assert.equal(await page.evaluate(() => window.oldTarget.value), '', 'disconnected old node must not receive a stale write');
      assert.equal(report.filled, 0); assert.equal(report.skipped, 1);
    } finally { await page.close(); }
  });
  for (const mode of ['checkbox-value', 'select-options', 'custom-trigger', 'custom-option', 'add-button']) await check('delayed real watcher rechecks exact activation target on ' + mode, async () => {
    const { page, run } = await fixture(true, true); try {
      const markup = {
        'checkbox-value': '<fieldset><legend>技能</legend><label><input type="checkbox" id="first" name="skills" value="JavaScript">JavaScript</label><label><input type="checkbox" id="second" name="skills" value="SQL">SQL</label></fieldset>',
        'select-options': '<label>技能<select id="multiple" multiple><option value="JavaScript">JavaScript</option><option value="SQL">SQL</option></select></label>',
        'custom-trigger': '<div class="form-item"><span class="form-item__text">现居城市</span><div id="city" class="phoenix-select" data-value=""><button type="button" id="trigger" aria-controls="city-options">请选择</button><div id="city-options" role="listbox" hidden><div role="option" id="option" data-value="hz">杭州</div></div></div></div>',
        'custom-option': '<div class="form-item"><span class="form-item__text">现居城市</span><div id="city" class="phoenix-select" data-value=""><button type="button" id="trigger" aria-controls="city-options">请选择</button><div id="city-options" role="listbox"><div role="option" id="option" data-value="hz">杭州</div></div></div></div>',
        'add-button': '<div id="records"><fieldset><legend>教育经历 1</legend><label>学校名称<input></label></fieldset></div><button type="button" id="add">新增教育经历</button>',
      }[mode];
      await page.evaluate(markup => { document.querySelector('form').innerHTML = markup; window.activations = 0; window.submissions = 0; document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); window.submissions++; }); for (const node of document.querySelectorAll('button,[role="option"]')) node.addEventListener('click', () => { window.activations++; if (node.id === 'option') document.querySelector('#city').dataset.value = 'hz'; }); }, markup);
      const delayAt = mode === 'custom-option' ? "'custom'" : mode === 'add-button' ? 3 : 2;
      const pending = run(`(async()=>{const scan=JobAutofillEngine.scan(),operationId=crypto.randomUUID(),contextKey=(await JobAutofillPageWatcher.read()).contextKey;globalThis.__delayMode=${delayAt};return ${mode === 'add-button' ? 'await JobAutofillEngine.prepareGroups({education:2},{operationId,contextKey,expiresAt:Date.now()+10000})' : "await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:" + (mode.startsWith('custom') ? "'杭州',choice:{path:'contact.city'}" : "['JavaScript','SQL']") + '}],{operationId,contextKey,expiresAt:Date.now()+10000})'};})()`);
      await page.waitForFunction(() => document.body.dataset.watchWaiting === '1', null, { timeout: 10000 }).catch(async () => { throw new Error('Actual activation delay gate not reached: ' + JSON.stringify(await pending)); });
      await page.evaluate(mode => {
        if (mode === 'checkbox-value') document.querySelector('#first').value = 'Wrong changed skill';
        if (mode === 'select-options') document.querySelector('#multiple').options[0].textContent = 'Wrong changed skill';
        if (mode === 'custom-trigger') { document.querySelector('#trigger').type = 'submit'; document.querySelector('#trigger').textContent = '最终提交'; }
        if (mode === 'custom-option') document.querySelector('#option').textContent = 'Other changed city';
        if (mode === 'add-button') { document.querySelector('#add').type = 'submit'; document.querySelector('#add').textContent = '最终提交'; }
      }, mode);
      const report = await pending;
      const state = await page.evaluate(() => ({ activations: window.activations, submissions: window.submissions, checked: [...document.querySelectorAll('input[type=checkbox]')].map(node => node.checked), selected: [...(document.querySelector('#multiple')?.selectedOptions || [])].map(node => node.value) }));
      assert.equal(state.activations, 0); assert.equal(state.submissions, 0); assert.ok(state.checked.every(value => !value)); assert.deepEqual(state.selected, []);
      assert.equal(mode === 'add-button' ? report.clicks : report.filled, 0);
    } finally { await page.close(); }
  });
  for (const mode of ['checkbox', 'multiple', 'radio', 'disabled-placeholder']) await check('guarded partial-value validation allows unchanged ' + mode + ' controls', async () => {
    const { page, run } = await fixture(); try {
      const markup = mode === 'checkbox' ? '<fieldset><legend>技能</legend><label><input type="checkbox" name="skills" value="JavaScript">JavaScript</label><label><input type="checkbox" name="skills" value="SQL">SQL</label></fieldset>' : mode === 'multiple' || mode === 'disabled-placeholder' ? '<label>技能<select multiple>' + (mode === 'disabled-placeholder' ? '<option value="" disabled>请选择</option>' : '') + '<option value="JavaScript">JavaScript</option><option value="SQL">SQL</option></select></label>' : '<fieldset><legend>性别</legend><label><input type="radio" name="gender" value="f" checked>女</label><label><input type="radio" name="gender" value="m">男</label></fieldset>';
      await page.evaluate(markup => { document.querySelector('form').innerHTML = markup; }, markup);
      const result = await run(`(async()=>{const scan=JobAutofillEngine.scan(),operationId=crypto.randomUUID(),contextKey=(await JobAutofillPageWatcher.read()).contextKey;return await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:${mode === 'radio' ? "'m'" : "['JavaScript','SQL']"},overwrite:true}],{operationId,contextKey,expiresAt:Date.now()+10000});})()`);
      assert.equal(result.filled, 1, JSON.stringify(result));
    } finally { await page.close(); }
  });
  await check('guarded multiple select never selects a disabled requested option', async () => {
    const { page, run } = await fixture(); try {
      await page.evaluate(() => { document.querySelector('form').innerHTML = '<label>技能<select multiple><option value="JavaScript">JavaScript</option><option value="SQL" disabled>SQL</option></select></label>'; });
      const result = await run(`(async()=>{const scan=JobAutofillEngine.scan(),operationId=crypto.randomUUID(),contextKey=(await JobAutofillPageWatcher.read()).contextKey;const report=await JobAutofillEngine.apply(scan.scanId,[{fieldId:scan.fields[0].id,value:['JavaScript','SQL']}],{operationId,contextKey,expiresAt:Date.now()+10000});return {report,selected:[...document.querySelector('select').selectedOptions].map(node=>node.value)};})()`);
      assert.equal(result.report.filled, 0); assert.deepEqual(result.selected, []);
    } finally { await page.close(); }
  });
  console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, checks }));
  if (checks.some(c => !c.passed) || pageErrors.length) process.exitCode = 1;
} catch (error) { checks.push({ name: 'runner', passed: false, error: error.message }); process.exitCode = 1; }
finally {
  await writeFile(resolve(out, process.env.ENGINE_CANCEL_EVIDENCE || 'engine-cancel-green.json'), JSON.stringify({ checks, pageErrors }, null, 2));
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
