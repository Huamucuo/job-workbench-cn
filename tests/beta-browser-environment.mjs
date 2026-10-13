import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const runtime=process.env.BETA_PLAYWRIGHT||'playwright';
const {chromium}=require(runtime);
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const run='environment-'+new Date().toISOString().replaceAll(/[:.]/g,'-');
const out=resolve(project,'.local/beta-qa',run);
await mkdir(out,{recursive:true});
let context,fatal=null;
const report={run,startedAt:new Date().toISOString(),node:process.version,playwright:require(runtime+'/package.json').version,profile:resolve(out,'isolated-edge-profile'),headless:true,source:resolve(project,'extension'),requests:[],outbound:[]};
try{
 context=await chromium.launchPersistentContext(report.profile,{channel:'msedge',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${report.source}`,`--load-extension=${report.source}`,'--enable-unsafe-extension-debugging'],viewport:{width:1440,height:1000}});
 context.on('request',r=>report.requests.push({url:r.url(),method:r.method()}));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['chrome-extension:','edge:','data:','about:','blob:'].includes(u.protocol))return route.continue();report.outbound.push(u.href);return route.abort();});
 const cdp=await context.browser().newBrowserCDPSession();
 const list=await cdp.send('Extensions.getExtensions');report.extensions=list.extensions;report.browser=context.browser().version();
 const extension=list.extensions.find(e=>e.name.includes('本机求职'));if(!extension)throw Error('Actual MV3 extension was not loaded');
 const page=context.pages()[0]||await context.newPage();await page.goto('about:blank');await page.bringToFront();
 const tabs=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});const tab=tabs.targetInfos.find(t=>t.url===page.url()&&t.embedderData?.tabActive)||tabs.targetInfos.find(t=>t.url===page.url());if(!tab)throw Error('Actual browser tab unavailable');
 await cdp.send('Extensions.triggerAction',{id:extension.id,targetId:tab.targetId});
 let popup;for(let i=0;i<50;i++){popup=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.url===`chrome-extension://${extension.id}/popup.html`);if(popup)break;await new Promise(r=>setTimeout(r,100));}if(!popup)throw Error('Actual toolbar popup unavailable');
 report.actualPopup={targetId:popup.targetId,url:popup.url};
 const attach=await cdp.send('Target.attachToTarget',{targetId:popup.targetId,flatten:false});
 let next=0;const send=async(method,params={})=>new Promise((accept,reject)=>{const id=++next;const timer=setTimeout(()=>{cdp.off('Target.receivedMessageFromTarget',listener);reject(Error('CDP timeout '+method));},10000);const listener=e=>{if(e.sessionId!==attach.sessionId)return;const msg=JSON.parse(e.message);if(msg.id!==id)return;clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',listener);msg.error?reject(Error(msg.error.message)):accept(msg.result);};cdp.on('Target.receivedMessageFromTarget',listener);cdp.send('Target.sendMessageToTarget',{sessionId:attach.sessionId,message:JSON.stringify({id,method,params})}).catch(reject);});
 await send('Runtime.enable');await new Promise(r=>setTimeout(r,200));
 const body=await send('Runtime.evaluate',{expression:'document.body.innerText',returnByValue:true});report.popupText=body.result.value;
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(out,'actual-toolbar-popup.png'),Buffer.from(shot.data,'base64'));
 report.manifest=JSON.parse(await readFile(resolve(project,'extension/manifest.json'),'utf8'));
 report.status='PASS';
}catch(e){fatal=e.stack;report.status='FAIL';report.fatal=fatal;}
finally{if(context)await context.close().catch(()=>{});report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'environment.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,browser:report.browser,extensions:report.extensions,out,fatal}));if(fatal)process.exitCode=1;}

