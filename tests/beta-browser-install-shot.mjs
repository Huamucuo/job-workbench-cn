import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {BrowserHarness} from './beta-browser-harness.mjs';
const source=resolve(process.argv[3]||fileURLToPath(new URL('..',import.meta.url))),label=process.argv[2]||'beta-install-shot';
const h=new BrowserHarness({source,out:resolve(source,'.local/beta-qa',label+'-'+Date.now())});let fatal=null;
try{
 await h.open();h.current='SC07-isolated-install-controls';const page=await h.context.newPage();await page.goto('edge://extensions/');await page.getByText('职有引力 · 本机求职填表',{exact:true}).waitFor();
 const observed={accessibility:await page.locator('body').ariaSnapshot(),developerControls:await page.locator('#dev-switch').evaluateAll(es=>es.map((e,index)=>{const r=e.getBoundingClientRect();return {index,tag:e.tagName,outer:e.outerHTML,parent:e.parentElement.outerHTML.slice(0,2500),rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.tagName};})),controls:await page.locator('button,input,[role="switch"],[role="checkbox"]').evaluateAll(es=>es.map(e=>({tag:e.tagName,id:e.id,role:e.getAttribute('role'),ariaLabel:e.getAttribute('aria-label'),type:e.getAttribute('type'),text:e.textContent?.trim().slice(0,100),checked:e.checked,ariaChecked:e.getAttribute('aria-checked')})))};
 await h.write('observed-install-controls.json',observed);console.log(JSON.stringify({out:h.out,...observed}));
 const terminal=createInterface({input:process.stdin,output:process.stdout});const chosen=await new Promise(accept=>terminal.question('Observed selector to click: ',accept));terminal.close();
 const [role,name,index]=chosen.split('|');const located=role==='css'?page.locator(name):role==='text'?page.getByText(name,{exact:true}):page.getByRole(role,{name,exact:true});const control=index!==undefined?located.nth(Number(index)):located;const count=await control.count();if(count!==1)throw Error('Observed install control not unique');await control.click();h.actions.push({case:h.current,action:'actual UI click',role,name,isolatedProfileOnly:true});
 await page.getByText(/加载.*解压/).filter({visible:true}).waitFor();await page.screenshot({path:resolve(h.out,'01b-install-buttons-visible.png'),fullPage:false});await h.check(h.current,await page.getByText(/加载.*解压/).filter({visible:true}).isVisible(),{selectedRole:role,selectedName:name,loadedExtensionCardVisible:await page.getByText('职有引力 · 本机求职填表',{exact:true}).isVisible(),scope:'Only a new isolated Edge instance; actual visible UI toggled; no browser-settings API or daily profile.'});
}catch(e){fatal=e.stack;console.error(fatal);await h.write('infrastructure-error.txt',fatal);}
finally{await h.close({fatal});if(fatal||h.cases.some(c=>c.status==='FAIL'))process.exitCode=1;}


