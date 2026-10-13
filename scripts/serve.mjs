import http from 'node:http';
import { readFile,stat,realpath } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=await realpath(fileURLToPath(new URL('../public',import.meta.url)));
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const port=Number(process.env.JOB_WORKBENCH_PORT||47841);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('本机端口设置不正确');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.zip':'application/zip'};
const server=http.createServer(async(req,res)=>{
 const allowedHosts=new Set(['127.0.0.1:'+port,'localhost:'+port]);
 if(!allowedHosts.has(req.headers.host)||req.headers.origin&&req.headers.origin!=='http://127.0.0.1:'+port||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end('仅允许本机工作台访问');return;}
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 try {
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/__health'){res.setHeader('Content-Type','application/json; charset=utf-8');res.end(req.method==='HEAD'?'':JSON.stringify({app:'job-workbench-cn',version,pid:process.pid}));return;}
  if(url.pathname==='/__installation'){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(req.method==='HEAD'?'':JSON.stringify({extensionDir:resolve(root,'../extension'),version,extensionVersion:JSON.parse(await readFile(resolve(root,'../extension/manifest.json'),'utf8')).version,workbenchUrl:'http://127.0.0.1:'+port,installerName:'安装扩展.exe',guideUrl:'/help/onboarding.html',browserPages:{edge:'edge://extensions',chrome:'chrome://extensions'}}));return;}
  const requested=decodeURIComponent(url.pathname);
  if(requested==='/data/jobs.json'){try{const localJobs=await readFile(resolve(root,'../.local/jobs.json'));res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-cache');res.end(req.method==='HEAD'?undefined:localJobs);return;}catch(error){if(error.code!=='ENOENT')throw error;}}
  let path=resolve(root,`.${requested==='/'?'/index.html':requested}`);
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  path=await realpath(path);if(!path.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  if(!(await stat(path)).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');
  res.end(req.method==='HEAD'?undefined:await readFile(path));
 }catch(e){res.writeHead(e.code==='ENOENT'?404:400);res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用；请先检查已运行的本工作台。`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`职有引力已启动：http://127.0.0.1:${port} （仅本机）`));
