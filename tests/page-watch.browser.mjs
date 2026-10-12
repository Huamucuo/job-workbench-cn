import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.BETA_PLAYWRIGHT || 'C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = resolve('.local/crosspage-20261013');
await mkdir(out, { recursive: true });
const checks = [], requests = [];
const html = `<!doctype html><title>Example application</title><body data-application-id="application-137" data-application-label="Example role"><form><fieldset><legend>Contact</legend><label for="name">Full name</label><input id="name" name="name"><label>City<select id="city"><option value="">Choose</option><option value="one">City one</option></select></label><label><input id="agree" type="checkbox">Contact consent</label><div hidden><input id="hidden"></div><input type="hidden" value="secret-hidden"><div id="conditional" hidden><label>Extra<input id="extra"></label></div></fieldset><div id="animation">Loading 1</div><button type="submit">Submit</button></form>`;
const server = createServer((req, res) => { requests.push(req.url); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(47960, '127.0.0.1', resolve); });
let browser;
const check = async (name, fn) => { try { await fn(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); throw error; } };
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const outbound = []; page.on('request', req => outbound.push(req.url()));
  await page.goto('http://127.0.0.1:47960/application/contact');
  let source = ''; try { source = await readFile('public/autofill/page-watch.js', 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const cdp = await page.context().newCDPSession(page);
  const tree = await cdp.send('Page.getFrameTree');
  const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'watcher-test' });
  await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression: source || 'void 0' });
  const evaluate = async expression => {
    const result = await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  await check('watcher exposes a read-only isolated-world API', async () => assert.equal(await evaluate('typeof globalThis.JobAutofillPageWatcher?.read'), 'function', 'page watcher read API is missing'));
  const read = () => evaluate('globalThis.JobAutofillPageWatcher.read()');
  const first = await read();
  await check('read exports metadata and hashes only', async () => {
    assert.deepEqual(Object.keys(first).sort(), ['applicationLabel', 'contextKey', 'fieldCount', 'fingerprint', 'url']);
    assert.equal(first.fieldCount, 3); assert.match(first.fingerprint, /^sha256:[a-f0-9]{64}$/);
    assert.match(first.contextKey, /^sha256:[a-f0-9]{64}$/);
    assert.equal(first.applicationLabel, 'Example role'); assert.equal(JSON.stringify(first).includes('application-137'), false);
    assert.equal(await page.evaluate('typeof JobAutofillPageWatcher'), 'undefined', 'watcher stays isolated from main-world scripts');
  });
  await check('irrelevant animation and hidden fields do not change fingerprint', async () => {
    await page.evaluate(() => { document.querySelector('#animation').textContent = 'Loading 2'; document.querySelector('#hidden').value = 'hidden-change'; document.body.style.background = 'red'; });
    assert.equal((await read()).fingerprint, first.fingerprint);
  });
  await check('same URL manual value corrections change hash without exporting values', async () => {
    await page.locator('#name').fill('Private candidate A'); const a = await read();
    await page.locator('#name').fill('Private candidate B'); const b = await read();
    assert.notEqual(a.fingerprint, first.fingerprint); assert.notEqual(a.fingerprint, b.fingerprint);
    assert.equal(a.url, b.url); assert.equal(JSON.stringify([a, b]).includes('Private candidate'), false);
  });
  await check('same document conditional controls and asynchronous option changes are visible', async () => {
    let previous = await read(); await page.evaluate(() => { document.querySelector('#conditional').hidden = false; });
    const current = await read(); assert.equal(current.fieldCount, 4); assert.notEqual(current.fingerprint, previous.fingerprint);
    previous = current; await page.evaluate(() => new Promise(resolve => setTimeout(() => { document.querySelector('#city').add(new Option('City two', 'two')); resolve(); }, 20)));
    assert.notEqual((await read()).fingerprint, previous.fingerprint);
  });
  await check('labels groups ordering and checked state invalidate pending metadata', async () => {
    for (const mutation of [
      () => { document.querySelector('label[for=name]').textContent = 'Legal name'; },
      () => { document.querySelector('legend').textContent = 'Work'; },
      () => { document.querySelector('fieldset').prepend(document.querySelector('#agree').closest('label')); },
      () => { document.querySelector('#agree').checked = true; },
      () => { document.querySelector('#name').disabled = true; },
    ]) { const previous = await read(); await page.evaluate(mutation); assert.notEqual((await read()).fingerprint, previous.fingerprint); }
  });
  await check('replacing an identical control invalidates metadata while reinjection is stable', async () => {
    const previous = await read();
    await page.evaluate(() => { const old = document.querySelector('#name'); old.replaceWith(old.cloneNode(true)); });
    const replaced = await read(); assert.notEqual(replaced.fingerprint, previous.fingerprint);
    await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression: source });
    assert.equal((await read()).fingerprint, replaced.fingerprint);
  });
  await check('visible custom choices and editable content change hashes without exposing content', async () => {
    await page.evaluate(() => {
      document.querySelector('form').insertAdjacentHTML('beforeend', '<label>Custom choice<input id="custom" role="combobox" aria-controls="choices"></label><div id="choices" role="listbox"><div role="option" data-value="a">Alpha</div></div><div id="editable" contenteditable="true" aria-label="Description"></div>');
    });
    let previous = await read(); assert.equal(previous.fieldCount, 6);
    await page.evaluate(() => { document.querySelector('#choices').insertAdjacentHTML('beforeend', '<div role="option" data-value="b">Beta</div>'); });
    let changed = await read(); assert.notEqual(changed.fingerprint, previous.fingerprint);
    previous = changed;
    await page.locator('#editable').fill('Private free-form correction'); changed = await read();
    assert.notEqual(changed.fingerprint, previous.fingerprint); assert.equal(JSON.stringify(changed).includes('Private free-form'), false);
    await page.evaluate(() => { document.querySelector('#editable').style.opacity = '0'; });
    assert.equal((await read()).fieldCount, 5);
  });
  await check('explicit and known URL identifiers hash but unknown routes stay unconfirmed', async () => {
    await page.evaluate(() => { document.body.dataset.applicationId = 'application-138'; }); assert.notEqual((await read()).contextKey, first.contextKey);
    await page.evaluate(() => { delete document.body.dataset.applicationId; history.pushState({}, '', '/application/contact?applicationId=url-42'); });
    const known = await read(); assert.match(known.contextKey, /^sha256:/); assert.equal(known.contextKey.includes('url-42'), false);
    await page.evaluate(() => history.pushState({}, '', '/contact?step=2&id=generic')); assert.equal((await read()).contextKey, '');
    await page.evaluate(() => history.pushState({}, '', '/application/personal-information')); assert.equal((await read()).contextKey, '', 'a named application stage must never be guessed as an identifier');
    await page.evaluate(() => history.pushState({}, '', '/jobs/req-42/apply')); assert.match((await read()).contextKey, /^sha256:/);
    for (const key of ['gh_jid', 'inviteKey', 'elinkId']) {
      await page.evaluate(key => history.pushState({}, '', '/apply?' + key + '=private-identifier-42'), key);
      const known = await read(); assert.match(known.contextKey, /^sha256:[a-f0-9]{64}$/, key); assert.equal(known.contextKey.includes('private-identifier-42'), false);
      await page.evaluate(key => history.pushState({}, '', '/apply?' + key + '=private-identifier-43'), key);
      assert.notEqual((await read()).contextKey, known.contextKey, key + ' change must be detected');
    }
  });
  await check('watcher never scans applies clicks writes storage or sends network', async () => {
    const before = await page.evaluate(() => ({ values: Array.from(document.querySelectorAll('input,select')).map(e => e.value), html: document.body.innerHTML, local: localStorage.length, session: sessionStorage.length }));
    await evaluate(`globalThis.JobAutofillEngine = { scan() { throw new Error('scan forbidden'); }, apply() { throw new Error('apply forbidden'); }, prepareGroups() { throw new Error('prepare forbidden'); } }; globalThis.fetch = () => { throw new Error('network forbidden'); }; XMLHttpRequest.prototype.open = () => { throw new Error('network forbidden'); }; Element.prototype.click = () => { throw new Error('click forbidden'); }; Storage.prototype.setItem = () => { throw new Error('storage forbidden'); };`);
    const networkCount = outbound.length;
    await read(); await read();
    const after = await page.evaluate(() => ({ values: Array.from(document.querySelectorAll('input,select')).map(e => e.value), html: document.body.innerHTML, local: localStorage.length, session: sessionStorage.length }));
    assert.deepEqual(after, before); assert.equal(outbound.length, networkCount);
  });
  console.log(JSON.stringify({ passed: checks.length, failed: 0, isolatedWorld: true }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  await writeFile(resolve(out, process.env.WATCH_EVIDENCE_NAME || 'watch-browser-green.json'), JSON.stringify({ checks, requests, passed: checks.filter(x => x.passed).length, failed: checks.filter(x => !x.passed).length }, null, 2));
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
