// Import history travels only inside the same encrypted profile, never job data.
export function validateImportData(input,validPaths){
 const object=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new Error('导入来源结构不合法');};
 const str=(v,max)=>{if(typeof v!=='string'||v.length>max)throw new Error('导入来源文字过长或不合法');return v;};
 const list=(v,max)=>{if(!Array.isArray(v)||v.length>max)throw new Error('导入来源数量超过限制');return v;};
 const pos=n=>{if(!Number.isInteger(n)||n<1||n>60000)throw new Error('来源位置不合法');return n;};
 object(input,['version','sources','fields','unresolved']);if(input.version!==1)throw new Error('不支持的导入来源版本');
 if(new TextEncoder().encode(JSON.stringify(input)).length>600000)throw new Error('导入来源记录超过600KB。请导出加密备份后，在来源记录中清空历史再导入');
 const ids=new Set();const sources=list(input.sources,10).map(s=>{object(s,['id','name','type','text','warnings','importedAt']);if(!/^[a-f0-9]{64}$/.test(s.id)||ids.has(s.id))throw new Error('来源标识不合法或重复');ids.add(s.id);if(!['docx','pdf'].includes(s.type))throw new Error('来源类型不支持');if(!Number.isFinite(Date.parse(s.importedAt)))throw new Error('来源时间不合法');return {id:s.id,name:str(s.name,240),type:s.type,text:str(s.text,60000),warnings:list(s.warnings,100).map(v=>str(v,500)),importedAt:s.importedAt};});
 const ref=v=>{if(!ids.has(v.sourceId))throw new Error('来源文件不存在');return {sourceId:v.sourceId,line:pos(v.line),page:pos(v.page)};};
 const fields=list(input.fields,1000).map(f=>{object(f,['path','sourceId','line','page','quote','confidence','reason','reviewed','edited']);if(!/^(contact\.[a-zA-Z]+|(?:education|internships|work|projects|skills|certificates)\.[\w-]{1,80}\.[a-zA-Z]+)$/.test(f.path))throw new Error('来源字段路径不合法');if(!['high','medium','low'].includes(f.confidence)||typeof f.reviewed!=='boolean'||typeof f.edited!=='boolean')throw new Error('来源核对状态不合法');return {path:f.path,...ref(f),quote:str(f.quote,300),confidence:f.confidence,reason:str(f.reason,200),reviewed:f.reviewed,edited:f.edited};}).filter(f=>validPaths.has(f.path));
 const unresolved=list(input.unresolved,1000).map(u=>{object(u,['sourceId','line','page','text','reason']);return {...ref(u),text:str(u.text,3000),reason:str(u.reason,200)};});
 return {version:1,sources,fields,unresolved};
}
