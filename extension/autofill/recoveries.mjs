import {validateEnvelope} from './vault.mjs';
export function readRecoveries(value){
 const list=Array.isArray(value)?value:value?.kind==='job-workbench-encrypted-draft'?[{id:'legacy',createdAt:'',envelope:value}]:[];
 if(list.length>20)throw new Error('恢复草稿超过20份，请先导出整理');
 const ids=new Set();
 return list.map(r=>{if(!r||typeof r.id!=='string'||r.id.length>80||ids.has(r.id)||typeof r.createdAt!=='string'||r.envelope?.kind!=='job-workbench-encrypted-draft')throw new Error('恢复草稿索引无效');ids.add(r.id);validateEnvelope(r.envelope,{allowDraft:true});return {id:r.id,createdAt:r.createdAt,envelope:r.envelope};});
}
export function addRecovery(value,record){
 const list=readRecoveries(value);if(list.some(r=>r.id===record.id))throw new Error('恢复草稿标识已存在');
 if(list.length>=20)throw new Error('已有20份恢复草稿，请先解锁并导出；未覆盖任何旧草稿');
 return readRecoveries([record,...list]);
}
export function removeRecovered(value,record){
 const list=readRecoveries(value);if(!record)return list;
 return list.filter(r=>!(r.id===record.id&&r.envelope.ciphertext===record.envelope.ciphertext));
}
