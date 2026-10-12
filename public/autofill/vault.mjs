import {validateProfile} from './profile.mjs';
import {bridgeRequest,sharedMode,bridgeStatus,probeBridge} from './bridge-client.mjs';
import {removeRecovered,addRecovery} from './recoveries.mjs';
export const VAULT_KEY='zhiyouyinli.profile.encrypted.v2',DRAFT_KEY=VAULT_KEY+'.draft',MEMORY_KEY='zhiyouyinli.autofill.mapping.v1';
const rounds=600000,enc=new TextEncoder(),dec=new TextDecoder(),profileKind='job-workbench-encrypted-profile',draftKind='job-workbench-encrypted-draft';
function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function bytes(s){if(typeof s!=='string'||s.length>6000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw new Error('加密封包格式错误');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function checkPassword(pass){if(typeof pass!=='string'||pass.length<12||pass.length>512)throw new Error('口令请使用12至512个字符；不要使用测试口令保护真实资料');}
async function keyFor(pass,salt){checkPassword(pass);const seed=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:rounds,hash:'SHA-256'},seed,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export function validateEnvelope(e,{allowDraft=false}={}){
 if(!e||Object.keys(e).some(k=>!['kind','version','algorithm','kdf','iterations','salt','iv','ciphertext'].includes(k))||!(e.kind===profileKind||allowDraft&&e.kind===draftKind)||e.version!==1||e.algorithm!=='AES-GCM-256'||e.kdf!=='PBKDF2-SHA256'||e.iterations!==rounds)throw new Error('不是受支持的有效加密档案；草稿需先在档案管理中修正');
 const salt=bytes(e.salt),iv=bytes(e.iv),cipher=bytes(e.ciphertext);if(salt.length!==16||iv.length!==12||cipher.length<16)throw new Error('加密封包不完整');return {salt,iv,cipher};
}
const aad=kind=>enc.encode(kind===profileKind?'job-workbench-profile-v2':'job-workbench-draft-v2');
async function seal(profile,pass,isDraft){
 const p=validateProfile(profile,{allowInvalidFields:isDraft}),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(pass,salt),kind=isDraft?draftKind:profileKind;
 const plain=enc.encode(JSON.stringify(p));if(plain.byteLength>3000000)throw new Error('档案超过3MB，请减少附件或导入来源后再保存');
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(kind)},key,plain);
 return {kind,version:1,algorithm:'AES-GCM-256',kdf:'PBKDF2-SHA256',iterations:rounds,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(cipher))};
}
async function open(e,pass,isDraft){
 const {salt,iv,cipher}=validateEnvelope(e,{allowDraft:isDraft}),key=await keyFor(pass,salt);
 if(isDraft&&e.kind!==draftKind)throw new Error('这不是加密草稿');
 try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(e.kind)},key,cipher);return validateProfile(JSON.parse(dec.decode(plain)),{allowInvalidFields:isDraft});}
 catch{throw new Error('口令不正确、文件损坏或档案内容无效；原档案没有被覆盖');}
}
export const encryptProfile=(profile,pass)=>seal(profile,pass,false);
export const decryptProfile=(envelope,pass)=>open(envelope,pass,false);
export const encryptDraft=(profile,pass)=>seal(profile,pass,true);
export const decryptDraft=(envelope,pass)=>open(envelope,pass,true);
export function isExtension(){return Boolean(globalThis.chrome?.runtime?.id&&globalThis.chrome?.storage?.local);}
export const storage={
 async get(key){if(isExtension()){const r=await runtime('storage:get',{key});return r.value;}if(sharedMode()){await ensureConnected();return (await bridgeRequest('storage:get',{key})).value;}const raw=localStorage.getItem(key);return raw===null?null:JSON.parse(raw);},
 async set(key,value){if(isExtension()){await runtime('storage:set',{key,value});return;}if(sharedMode()){await ensureConnected();await bridgeRequest('storage:set',{key,value});return;}localStorage.setItem(key,JSON.stringify(value));},
 async addRecovery(value){if(isExtension())return runtime('storage:recovery',{value});if(sharedMode()){await ensureConnected();return bridgeRequest('storage:recovery',{value},15000);}if(!navigator.locks)throw new Error('请使用新版Chrome或Edge，以保护多个窗口的草稿');return navigator.locks.request(VAULT_KEY,async()=>{const list=removeRecovered(await this.get(DRAFT_KEY),value.recovered);await this.set(DRAFT_KEY,addRecovery(list,value.record));return {ok:true};});},
 async commitVault(value){validateEnvelope(value.next);if(isExtension())return runtime('storage:commit',{value});if(sharedMode()){await ensureConnected();return bridgeRequest('storage:commit',{value},15000);}if(!navigator.locks)throw new Error('请使用新版Chrome或Edge，以保护多个窗口的保存');return navigator.locks.request(VAULT_KEY,async()=>{const old=await this.get(VAULT_KEY);if((old?.ciphertext||null)!==value.expectedCiphertext)throw new Error('另一窗口已保存，未覆盖。请导出草稿备份，再重新打开最新档案');if(old)await this.set(VAULT_KEY+'.previous',old);await this.set(VAULT_KEY,value.next);if(value.recovered)await this.set(DRAFT_KEY,removeRecovered(await this.get(DRAFT_KEY),value.recovered));return {ok:true};});}
};
async function runtime(type,params){const reply=await chrome.runtime.sendMessage({protocol:'job-beta-v1',type,...params});if(!reply?.ok)throw new Error(reply?.error||'扩展连接失败，请重新加载扩展');return reply.value;}
async function ensureConnected(){const s=await probeBridge();if(!s.connected)throw new Error('共享档案连接已中断或过期。请回首页重新连接；未保存到另一份档案。');}
export function downloadJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
