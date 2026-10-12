import http from 'node:http';
import {readFile,appendFile,mkdir,realpath,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ORIGINAL_QA_ROOT=resolve(process.env.BETA_ORIGINAL_QA_ROOT||fileURLToPath(new URL('../tests/fixtures/v021',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const variantFixture='<!doctype html><meta charset="utf-8"><title>虚构Beta描述版本独立检查</title><h1>虚构Beta版本填写试验 · 绝非真实招聘</h1><form><section><h2>申请人资料</h2><label>姓名<input id="variant-person" data-model-key="name"></label></section><section><h2>自我介绍</h2><label>自我介绍<textarea id="variant-introduction" data-model-key="introduction"></textarea></label></section><fieldset><legend>工作经历 1</legend><label>工作描述<textarea id="variant-description" data-model-key="description"></textarea></label></fieldset><label>身份证号码<input id="variant-identity" data-model-key="identity"></label><label><input id="variant-consent" data-model-key="consent" type="checkbox">同意所有条款</label><button type="submit">模拟提交（不要点击）</button></form><script src="/beta-variant.js"></script>';
const variantScript="window.betaVariant={model:{},saved:{},submits:0};for(const e of document.querySelectorAll('[data-model-key]')){const k=e.dataset.modelKey;betaVariant.model[k]=e.type==='checkbox'?false:'';betaVariant.saved[k]=betaVariant.model[k];e.addEventListener('input',()=>{betaVariant.model[k]=e.type==='checkbox'?e.checked:e.value;setTimeout(()=>betaVariant.saved[k]=betaVariant.model[k],150);});}document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();betaVariant.submits++;});";
const listen=(server,port)=>new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);accept();});});
const close=server=>new Promise(accept=>{server.closeAllConnections();server.close(accept);});

export async function startQAServers({out,fixturePort=47842,receiverPort=47943,fixtures=resolve(ORIGINAL_QA_ROOT,'fixtures')}={}){
 const root=await realpath(fixtures),origin=`http://127.0.0.1:${fixturePort}`,receiverLog=resolve(out,'site-autosave-receiver-all.ndjson');
 await mkdir(dirname(receiverLog),{recursive:true});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  if(req.headers.host!==`127.0.0.1:${fixturePort}`){res.writeHead(403);return res.end('QA loopback host required');}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  try{
   const u=new URL(req.url,origin);
   if(u.pathname==='/__qa-health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({app:'independent-beta-qa',pid:process.pid,root,fixturePort,receiverPort}));}
   if(u.pathname==='/beta-variant.html'||u.pathname==='/beta-variant.js'){res.setHeader('Content-Type',u.pathname.endsWith('.js')?types['.js']:types['.html']);return res.end(req.method==='HEAD'?undefined:u.pathname.endsWith('.js')?variantScript:variantFixture);}
   let file=resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
   if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
   file=await realpath(file);if(!file.startsWith(root+sep)||(await stat(file)).isDirectory()){res.writeHead(403);return res.end();}
   res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch(e){res.writeHead(e.code==='ENOENT'?404:400);res.end('QA fixture not found');}
 });
 // Original network-risk fixture has a deliberate, hardcoded receiver on 47943.
 // Its bytes remain unchanged; this receiver only accepts the isolated fixture origin.
 const receiver=http.createServer((req,res)=>{
  if(req.headers.host!==`127.0.0.1:${receiverPort}`||req.headers.origin!==origin){res.writeHead(403);return res.end();}
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.end();return;}
  if(req.method!=='POST'||req.url!=='/collect'){res.writeHead(405);return res.end();}
  let body='';req.on('data',data=>{body+=data;if(Buffer.byteLength(body)>10000)req.destroy();});
  req.on('end',async()=>{await appendFile(receiverLog,JSON.stringify({at:new Date().toISOString(),url:req.url,method:req.method,body})+'\n');res.end('ok');});
 });
 await listen(server,fixturePort);
 try{await listen(receiver,receiverPort);}catch(e){await close(server);throw e;}
 return {origin,receiverLog,close:async()=>{await close(server);await close(receiver);}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=resolve(process.env.BETA_QA_OUT||'.local/beta-qa/manual-session');
 const running=await startQAServers({out});
 console.log(JSON.stringify({app:'independent-beta-qa',pid:process.pid,origin:running.origin,receiverLog:running.receiverLog,humanTiming:'PENDING: use unchanged ordinary.html timer; manual and extension trials must use the same fixture and profile.'}));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await running.close();process.exit(0);});
}

