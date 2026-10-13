import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {BrowserHarness,until} from './beta-browser-harness.mjs';
const password=process.argv.includes('--protected')?'Capacity-Fiction-only-2026!':null;
const source=resolve(process.argv[2]||'.'),h=new BrowserHarness({source,out:resolve(source,'.local','capacity-'+Date.now())});let fatal=null;
try{
 await h.open();const page=await h.context.newPage();if(process.argv.includes('--auto'))await page.clock.install();await page.goto(`chrome-extension://${h.extensionId}/profile.html`);
 if(password)await page.locator('#vault-password').fill(password);await page.locator('#create').click();await page.locator('[data-path="contact.name"]').fill('恢复容量测试（虚构）');await page.locator('#save-profile').click();await page.waitForFunction(()=>document.querySelector('#profile-status').textContent.startsWith('保存成功'));
 const baseline=await page.evaluate(async password=>{const {VAULT_KEY,storage,encryptDraft}=await import('./autofill/vault.mjs'),{createFictionalProfile}=await import('./autofill/profile.mjs');const current=await storage.get(VAULT_KEY);for(let i=0;i<5;i++)await storage.addRecovery({record:{id:'fixture-draft-'+i,createdAt:'2026-10-13T12:00:00Z',envelope:await encryptDraft(createFictionalProfile(),password)},recovered:null});return current.ciphertext},password);
 await page.locator('[data-path="contact.city"]').fill('第六份尚未保存的虚构输入');if(process.argv.includes('--auto'))await page.clock.fastForward(300010);else await page.locator('#lock-profile').click();
 await until(()=>page.locator('#profile-status.bad').isVisible());
 if(process.argv.includes('--auto')){assert.equal(await page.locator('#editor').isVisible(),false,'protected idle expiry must clear the plaintext editor even if recovery persistence fails');assert.match(await page.locator('#profile-status').innerText(),/仅.*标签页|内存/);await page.locator('#vault-password').fill(password);await page.locator('#unlock').click();await page.locator('[data-path="contact.name"]').waitFor();}else assert.equal(await page.locator('#editor').isVisible(),true,'unsaved editor must remain visible when recovery persistence fails');
 assert.equal(await page.locator('[data-path="contact.city"]').inputValue(),'第六份尚未保存的虚构输入');
 if(!process.argv.includes('--auto'))assert.match(await page.locator('#profile-status').innerText(),/仍保留|未.*关闭/);
 const state=await page.evaluate(async()=>{const {VAULT_KEY,DRAFT_KEY,storage}=await import('./autofill/vault.mjs');return {ciphertext:(await storage.get(VAULT_KEY)).ciphertext,count:(await storage.get(DRAFT_KEY)).length}});
 assert.equal(state.ciphertext,baseline);assert.equal(state.count,5);await h.check(process.argv.includes('--auto')?'protected-idle-lock-retains-only-encrypted-memory-and-reopens-with-original-password':'failed-sixth-recovery-keeps-editable-inputs-and-old-archive',true);
 await page.locator('#save-profile').click();await page.waitForFunction(()=>document.querySelector('#profile-status').textContent.startsWith('保存成功'));await page.reload();if(password){await page.locator('#vault-password').fill(password);await page.locator('#unlock').click();}await page.locator('[data-path="contact.name"]').waitFor();
 // A recovery may be offered, but the valid archive must contain the explicit
 // sixth edit, independently of whatever old recovery the editor selects.
 const saved=await page.evaluate(async password=>{const {VAULT_KEY,storage,decryptProfile}=await import('./autofill/vault.mjs');return decryptProfile(await storage.get(VAULT_KEY),password)},password);assert.equal(saved.contact.city,'第六份尚未保存的虚构输入');await h.check('explicit-save-after-recovery-capacity-error-commits-the-current-edit',true);
}catch(e){fatal=e.stack;console.error(e.stack);process.exitCode=1}finally{await h.close({fatal})}
