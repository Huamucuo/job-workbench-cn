export const WORKBENCH_ORIGIN='http://127.0.0.1:47841';
export const VAULT_KEY='zhiyouyinli.profile.encrypted.v2',DRAFT_KEY=VAULT_KEY+'.draft',MEMORY_KEY='zhiyouyinli.autofill.mapping.v1';
const keys=new Set([VAULT_KEY,VAULT_KEY+'.previous',DRAFT_KEY,MEMORY_KEY]);
const nonceValid=n=>typeof n==='string'&&/^[a-f0-9]{64}$/.test(n);
export function isTrustedWorkbenchSender(sender){
 try{const u=new URL(sender.url);return u.origin===WORKBENCH_ORIGIN&&!u.username&&!u.password&&sender.frameId===0&&Number.isSafeInteger(sender.tab?.id)&&sender.tab.id>=0&&(/^\/(?:index\.html|profile\.html|autofill-start\.html)?$/.test(u.pathname)||/^\/autofill\/lab\/[a-z0-9-]+\.html$/.test(u.pathname)||u.pathname==='/help/beta.html');}catch{return false;}
}
export function assertKey(key){if(!keys.has(key))throw new Error('此连接不能访问这个存储项目');}
function exact(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new Error('连接数据格式不受支持');}
function encoded(value,min,max){if(typeof value!=='string'||value.length>Math.ceil(max/3)*4||value.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('加密资料格式不正确');const n=value.length*3/4-(value.endsWith('==')?2:value.endsWith('=')?1:0);if(n<min||n>max)throw new Error('加密资料大小不正确');}
function envelope(value,draft=false){exact(value,['kind','version','algorithm','kdf','iterations','salt','iv','ciphertext','unlockMode']);if(('unlockMode' in value&&value.unlockMode!=='device')||!['job-workbench-encrypted-profile',...(draft?['job-workbench-encrypted-draft']:[])].includes(value.kind)||value.version!==1||value.algorithm!=='AES-GCM-256'||value.kdf!=='PBKDF2-SHA256'||value.iterations!==600000)throw new Error('只能传输受支持的加密档案，不接收明文简历');encoded(value.salt,16,16);encoded(value.iv,12,12);encoded(value.ciphertext,16,5500000);}
function recoveryRecord(r){exact(r,['id','createdAt','envelope']);if(typeof r.id!=='string'||r.id.length>80||!r.id||typeof r.createdAt!=='string'||r.createdAt.length>100||r.envelope?.kind!=='job-workbench-encrypted-draft')throw new Error('恢复草稿格式错误');envelope(r.envelope,true);}
function recoveryList(value){if(value===null||value===undefined)return [];if(!Array.isArray(value)){if(value.kind!=='job-workbench-encrypted-draft')throw new Error('恢复草稿格式错误');value=[{id:'legacy',createdAt:'',envelope:value}];}const ids=new Set();for(const r of value){recoveryRecord(r);if(ids.has(r.id))throw new Error('恢复草稿标识重复');ids.add(r.id);}return value;}
export function assertStoredValue(key,value){
 assertKey(key);if(value===null)return;if(JSON.stringify(value).length>5600000)throw new Error('加密资料过大，请减少附件或导入来源');
 if(key===VAULT_KEY||key===VAULT_KEY+'.previous'){envelope(value);return;}
 if(key===DRAFT_KEY){const list=recoveryList(value);if(list.length>5)throw new Error('恢复草稿太多，请先解锁并导出备份，未覆盖旧草稿');return;}
 if(!Array.isArray(value)||value.length>1000)throw new Error('字段对应记录过多');for(const m of value){exact(m,['scope','signature','path']);if(typeof m.scope!=='string'||m.scope.length>2000||typeof m.signature!=='string'||m.signature.length>5000||typeof m.path!=='string'||!/^(?:contact\.[A-Za-z]+|(?:education|internships|work|projects|skills|certificates|languages)\.(?:[0-9]|[12][0-9])\.[A-Za-z]+|skills\.all|about\.(?:introduction|other))$/.test(m.path)||/__proto__|prototype|constructor/.test(m.path))throw new Error('字段对应记录不受支持');}
}
export class GrantRegistry{
 constructor(clock=()=>Date.now()){this.clock=clock;this.records=new Map();}
 restore(rows){for(const r of Array.isArray(rows)?rows:[]){if(Number.isSafeInteger(r.tabId)&&nonceValid(r.nonce)&&Number.isFinite(r.expiresAt)&&r.expiresAt>this.clock()&&r.expiresAt<=this.clock()+30*60*1000)this.records.set(r.tabId,{...r});}}
 register(sender,nonce){if(!isTrustedWorkbenchSender(sender)||!nonceValid(nonce))throw new Error('工作台地址或会话不正确');const prior=this.records.get(sender.tab.id);this.records.set(sender.tab.id,{tabId:sender.tab.id,nonce,requestedAt:this.clock(),expiresAt:prior?.nonce===nonce&&prior.expiresAt>this.clock()?prior.expiresAt:0});return this.status(sender,nonce);}
 status(sender,nonce){const r=this.records.get(sender.tab.id);return {installed:true,connected:!!r&&r.nonce===nonce&&r.expiresAt>this.clock(),expiresAt:r?.expiresAt||0};}
 approve(tabId,nonce){const r=this.records.get(tabId);if(!r||r.nonce!==nonce||this.clock()-r.requestedAt>120000)throw new Error('连接请求已变化，请在工作台重新点击连接');r.expiresAt=this.clock()+30*60*1000;return {...r};}
 authorize(sender,nonce){if(!isTrustedWorkbenchSender(sender)||!nonceValid(nonce)||!this.status(sender,nonce).connected)throw new Error('工作台尚未获准连接或授权已过期，请点击扩展批准连接');}
 revoke(tabId){this.records.delete(tabId);}
 snapshot(){return [...this.records.values()];}
}
export class CanonicalStore{
 constructor(adapter){this.adapter=adapter;this.tail=Promise.resolve();}
 enqueue(job){const next=this.tail.then(job);this.tail=next.catch(()=>{});return next;}
 devicePassword(create=false){
  if(typeof create!=='boolean')return Promise.reject(new Error('本机访问请求格式不正确'));
  return this.enqueue(async()=>{
   const key='zhiyouyinli.profile.device-access.v1',value=await this.adapter.get(key);
   if(value!==null){encoded(value,32,32);return value;}
   const existing=await Promise.all([VAULT_KEY,VAULT_KEY+'.previous',DRAFT_KEY].map(k=>this.adapter.get(k)));
   const local=e=>e?.unlockMode==='device';
   if(!create||existing.some(e=>local(e)||Array.isArray(e)&&e.some(r=>local(r.envelope))||local(e?.envelope)))throw new Error('本机访问资料缺失，请恢复一份备份；未重新生成或覆盖现有档案');
   const bytes=crypto.getRandomValues(new Uint8Array(32));let text='';for(const b of bytes)text+=String.fromCharCode(b);
   const next=btoa(text);await this.adapter.setMany({[key]:next});return next;
  });
 }
 get(key){assertKey(key);return this.enqueue(()=>this.adapter.get(key));}
 set(key,value){assertStoredValue(key,value);if(key===VAULT_KEY)throw new Error('有效档案必须通过核对版本的保存操作');if(key===DRAFT_KEY)throw new Error('恢复草稿必须通过保留其他窗口的追加操作');return this.enqueue(()=>this.adapter.setMany({[key]:value}));}
 addRecovery(value){
  exact(value,['record','recovered']);recoveryRecord(value.record);if(value.recovered)recoveryRecord(value.recovered);
  return this.enqueue(async()=>{let list=recoveryList(await this.adapter.get(DRAFT_KEY));if(value.recovered)list=list.filter(r=>!(r.id===value.recovered.id&&r.envelope.ciphertext===value.recovered.envelope.ciphertext));if(list.some(r=>r.id===value.record.id))throw new Error('恢复草稿标识已存在，未覆盖');const next=[value.record,...list];assertStoredValue(DRAFT_KEY,next);await this.adapter.setMany({[DRAFT_KEY]:next});return {ok:true};});
 }
 commit({expectedCiphertext,next,recovered=null}){
  assertStoredValue(VAULT_KEY,next);if(next===null)throw new Error('不能清空有效档案');if(expectedCiphertext!==null&&(typeof expectedCiphertext!=='string'||expectedCiphertext.length>5500000))throw new Error('保存版本不正确');
  return this.enqueue(async()=>{const old=await this.adapter.get(VAULT_KEY);if((old?.ciphertext||null)!==expectedCiphertext)throw new Error('另一窗口已经保存了新档案，未覆盖。请先导出当前草稿，再重新打开最新档案');const patch={[VAULT_KEY]:next};if(old)patch[VAULT_KEY+'.previous']=old;
   if(recovered){recoveryRecord(recovered);const drafts=recoveryList(await this.adapter.get(DRAFT_KEY));patch[DRAFT_KEY]=drafts.filter(r=>!(r.id===recovered.id&&r.envelope.ciphertext===recovered.envelope.ciphertext));}
   await this.adapter.setMany(patch);return {ok:true};});
 }
}
