import {validateImportData} from './import-meta.mjs';

export const CONTACT_FIELDS=[['name','姓名'],['givenName','英文名（不从中文猜测）'],['familyName','英文姓（不从中文猜测）'],['email','电子邮箱'],['phone','手机号码'],['birthDate','出生日期（只按明确资料）'],['gender','性别（选填）'],['politicalStatus','政治面貌（选填）'],['province','现居省份'],['city','居住城市'],['district','所在区县'],['website','作品集网址']];
export const ABOUT_FIELDS=[['introduction','自我介绍'],['other','其他补充']];
export const SECTIONS={
 education:{label:'教育经历',fields:[['school','院校名称'],['degree','学历'],['academicDegree','学位（仅按明确资料）'],['major','专业'],['startDate','入学时间'],['endDate','毕业时间']]},
 internships:{label:'实习经历',fields:[['organization','实习单位'],['title','实习职位'],['startDate','开始时间'],['endDate','结束时间'],['description','经历描述']]},
 work:{label:'工作经历',fields:[['organization','公司名称'],['title','职位名称'],['startDate','开始时间'],['endDate','结束时间'],['description','工作描述']]},
 projects:{label:'项目经历',fields:[['name','项目名称'],['role','担任角色'],['startDate','开始时间'],['endDate','结束时间'],['description','项目描述']]},
 skills:{label:'技能',fields:[['name','技能名称'],['level','熟练程度']]},
 certificates:{label:'证书',fields:[['name','证书名称'],['issuer','颁发机构'],['date','获得时间']]},
 languages:{label:'语言能力',fields:[['name','语种'],['level','熟练程度'],['certificate','语言证书 / 成绩（选填）']]}
};
export const DESCRIPTION_SECTIONS=['internships','work','projects'];
export const ATTACHMENT_LIMITS=Object.freeze({maxFiles:2,maxFileBytes:512*1024,maxTotalBytes:1024*1024});
const idPattern=/^[\w-]{1,80}$/;

export function newRecord(section){
 if(!SECTIONS[section])throw new Error('未知档案类别');
 return Object.fromEntries([['id',crypto.randomUUID()],...SECTIONS[section].fields.map(([key])=>[key,''])]);
}
export function createProfile(){
 return {schemaVersion:2,profileId:crypto.randomUUID(),updatedAt:new Date().toISOString(),isFictional:false,contact:Object.fromEntries(CONTACT_FIELDS.map(([key])=>[key,''])),...Object.fromEntries(Object.keys(SECTIONS).map(k=>[k,[]])),about:{introduction:'',other:''},attachments:[],variants:[],activeVariantId:''};
}
function clean(value,max=120){if(typeof value!=='string'||value.length>max)throw new Error('档案字段类型或长度不合法');return value.trim();}
function safeObject(value,allowed){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error('档案对象不合法');
 for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error('档案包含不支持的字段：'+key);
}
function checkId(value,seen,message='经历标识缺失或重复'){
 if(typeof value!=='string'||!idPattern.test(value)||seen?.has(value))throw new Error(message);
 seen?.add(value);return value;
}
export function validDate(value){
 if(!value)return true;if(!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value))return false;
 const[y,m='01',d='01']=value.split('-'),date=new Date(Date.UTC(+y,+m-1,+d));
 return +y>=1900&&+y<=2100&&date.getUTCFullYear()===+y&&date.getUTCMonth()===+m-1&&date.getUTCDate()===+d;
}
function validateAbout(value,{partial=false}={}){
 safeObject(value,ABOUT_FIELDS.map(([key])=>key));
 return Object.fromEntries(ABOUT_FIELDS.filter(([key])=>!partial||Object.hasOwn(value,key)).map(([key])=>[key,clean(value[key]??'',6000)]));
}
function base64Bytes(value){
 if(typeof value!=='string'||value.length>4*Math.ceil(ATTACHMENT_LIMITS.maxFileBytes/3)||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('附件内容格式不合法');
 let binary;try{binary=atob(value);}catch{throw new Error('附件内容格式不合法');}
 if(btoa(binary)!==value)throw new Error('附件内容格式不合法');
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
function bytesBase64(bytes){let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(binary);}
function validateAttachments(value){
 if(!Array.isArray(value)||value.length>ATTACHMENT_LIMITS.maxFiles)throw new Error('加密附件最多2份');
 const ids=new Set();let total=0;
 const result=value.map(item=>{
  safeObject(item,['id','name','type','size','sha256','dataBase64']);
  const id=checkId(item.id,ids,'附件标识缺失或重复'),name=clean(item.name,240),type=clean(item.type,120);
  if(!name||/[\\/:*?"<>|\u0000-\u001f\u007f]/.test(name))throw new Error('附件文件名不合法');
  if(!/^[\w.+-]+\/[\w.+-]+$/.test(type))throw new Error('附件类型不合法');
  if(!Number.isInteger(item.size)||item.size<1||item.size>ATTACHMENT_LIMITS.maxFileBytes)throw new Error('每份附件须有内容且不超过512 KiB');
  if(typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256))throw new Error('附件SHA256校验信息不合法');
  const payload=base64Bytes(item.dataBase64);if(payload.length!==item.size)throw new Error('附件大小与内容不一致');
  total+=payload.length;return {id,name,type,size:item.size,sha256:item.sha256,dataBase64:item.dataBase64};
 });
 if(total>ATTACHMENT_LIMITS.maxTotalBytes)throw new Error('附件总内容不超过1 MiB');return result;
}
function validateVariants(value,profile){
 if(!Array.isArray(value)||value.length>10)throw new Error('描述版本最多10份');
 const ids=new Set();return value.map(variant=>{
  safeObject(variant,['id','name','descriptions','about']);
  const id=checkId(variant.id,ids,'版本标识缺失或重复'),name=clean(variant.name,80);if(!name)throw new Error('请为描述版本命名');
  if(!Array.isArray(variant.descriptions)||variant.descriptions.length>90)throw new Error('版本描述数量不合法');
  const paths=new Set(),descriptions=variant.descriptions.map(entry=>{
   safeObject(entry,['section','recordId','description']);
   if(!DESCRIPTION_SECTIONS.includes(entry.section)||!profile[entry.section].some(row=>row.id===entry.recordId))throw new Error('版本引用的经历不存在；请重新选择现有经历');
   const path=entry.section+'.'+entry.recordId;if(paths.has(path))throw new Error('版本重复引用同一经历');paths.add(path);
   return {section:entry.section,recordId:entry.recordId,description:clean(entry.description,6000)};
  });
  const result={id,name,descriptions};if(Object.hasOwn(variant,'about'))result.about=validateAbout(variant.about,{partial:true});return result;
 });
}
export function validateProfile(value,{allowInvalidFields=false}={}){
 safeObject(value,['schemaVersion','profileId','updatedAt','isFictional','contact','importData','about','attachments','variants','activeVariantId',...Object.keys(SECTIONS)]);
 if(value.schemaVersion!==2)throw new Error('不支持的档案版本；请使用 v2 档案');
 checkId(value.profileId,null,'档案标识不合法');
 if(typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))throw new Error('档案修改时间不合法');
 if(typeof value.isFictional!=='boolean')throw new Error('需要明确是否为虚构测试档案');
 safeObject(value.contact,CONTACT_FIELDS.map(([key])=>key));
 const contact=Object.fromEntries(CONTACT_FIELDS.map(([key])=>[key,clean(value.contact[key]??'',key==='website'?500:120)]));
 if(!allowInvalidFields&&contact.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))throw new Error('电子邮箱格式不正确');
 if(!allowInvalidFields&&contact.phone&&!/^\+?[\d ()-]{6,40}$/.test(contact.phone))throw new Error('手机号码格式不正确');
 if(!allowInvalidFields&&contact.website){let u;try{u=new URL(contact.website);}catch{throw new Error('作品集网址不合法');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('作品集网址仅接受普通 HTTP/HTTPS 链接');}
 if(!allowInvalidFields&&!validDate(contact.birthDate))throw new Error('出生日期不合法，请保留原资料的年份、年月或完整日期精度');
 const result={schemaVersion:2,profileId:value.profileId,updatedAt:value.updatedAt,isFictional:value.isFictional,contact};
 for(const[key,section]of Object.entries(SECTIONS)){
  // New v2 fields are optional: validating an old backup does not manufacture facts.
  if(key==='languages'&&!Object.hasOwn(value,key))continue;
  if(!Array.isArray(value[key])||value[key].length>30)throw new Error(section.label+'最多30条');
  const ids=new Set();result[key]=value[key].map(record=>{
   safeObject(record,['id',...section.fields.map(([name])=>name)]);const row={id:checkId(record.id,ids)};
   for(const[name]of section.fields){
    if(name==='academicDegree'&&!Object.hasOwn(record,name))continue;
    row[name]=clean(record[name]??'',name==='description'?6000:200);
    if(!allowInvalidFields&&(/Date$/.test(name)||name==='date')&&!validDate(row[name]))throw new Error(section.label+'日期格式不合法，请用 YYYY、YYYY-MM 或 YYYY-MM-DD');
   }
   if(!allowInvalidFields&&row.startDate&&row.endDate&&row.startDate>(row.endDate.length===4?row.endDate+'-12-31':row.endDate.length===7?row.endDate+'-31':row.endDate))throw new Error(section.label+'开始时间不能晚于结束时间');return row;
  });
 }
 if(Object.hasOwn(value,'about'))result.about=validateAbout(value.about);
 if(Object.hasOwn(value,'attachments'))result.attachments=validateAttachments(value.attachments);
 if(Object.hasOwn(value,'variants'))result.variants=validateVariants(value.variants,result);
 if(Object.hasOwn(value,'activeVariantId')){
  if(typeof value.activeVariantId!=='string'||value.activeVariantId&&!result.variants?.some(variant=>variant.id===value.activeVariantId))throw new Error('当前描述版本不存在');result.activeVariantId=value.activeVariantId;
 }
 if(value.importData){
  const paths=new Set([...CONTACT_FIELDS.map(([key])=>'contact.'+key),...ABOUT_FIELDS.map(([key])=>'about.'+key)]);
  for(const[key,section]of Object.entries(SECTIONS))for(const row of result[key]||[])for(const[field]of section.fields)paths.add(key+'.'+row.id+'.'+field);
  result.importData=validateImportData(value.importData,paths);
 }
 return result;
}

// A wording overlay can only address existing descriptive fields, never facts.
export function materializeProfile(profile,variantId=profile?.activeVariantId||''){
 const result=validateProfile(profile);if(!variantId)return result;
 const variant=result.variants?.find(item=>item.id===variantId);if(!variant)throw new Error('当前描述版本不存在');
 for(const entry of variant.descriptions)result[entry.section].find(row=>row.id===entry.recordId).description=entry.description;
 if(variant.about)result.about={introduction:'',other:'',...result.about,...variant.about};return result;
}
export async function createAttachment(file,existing=[]){
 const checked=validateAttachments(existing);
 if(checked.length>=ATTACHMENT_LIMITS.maxFiles)throw new Error('加密附件最多2份；请先移除一份');
 if(!file||typeof file.arrayBuffer!=='function'||!Number.isInteger(file.size)||file.size<1||file.size>ATTACHMENT_LIMITS.maxFileBytes)throw new Error('每份附件须有内容且不超过512 KiB');
 const payload=new Uint8Array(await file.arrayBuffer());
 if(payload.byteLength!==file.size)throw new Error('附件读取大小不一致，请重新选择文件');
 const digest=await crypto.subtle.digest('SHA-256',payload),sha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 const attachment={id:crypto.randomUUID(),name:file.name,type:file.type||'application/octet-stream',size:payload.length,sha256,dataBase64:bytesBase64(payload)};
 return validateAttachments([...checked,attachment]).at(-1);
}
export async function attachmentBytes(attachment){
 const checked=validateAttachments([attachment])[0],payload=base64Bytes(checked.dataBase64);
 const digest=await crypto.subtle.digest('SHA-256',payload),actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(actual!==checked.sha256)throw new Error('附件SHA256校验失败，未下载；请恢复有效备份');return payload;
}
export function profileFields(profile){
 const list=CONTACT_FIELDS.map(([key,label])=>({path:'contact.'+key,label:'个人资料 · '+label,value:profile.contact[key]}));
 for(const[key,section]of Object.entries(SECTIONS))(profile[key]||[]).forEach((row,index)=>section.fields.forEach(([name,label])=>list.push({path:key+'.'+index+'.'+name,label:section.label+' '+(index+1)+' · '+label,value:row[name]})));
 if(profile.about)for(const[key,label]of ABOUT_FIELDS)list.push({path:'about.'+key,label,value:profile.about[key]});
 list.push({path:'skills.all',label:'技能 · 全部技能名称',value:profile.skills.map(row=>row.name).filter(Boolean)});return list;
}
export function createFictionalProfile(){
 const p=createProfile();p.isFictional=true;p.contact={...p.contact,name:'林知行',givenName:'Zhixing',familyName:'Lin',email:'lin.zhixing@example.com',phone:'19900000000',city:'杭州',website:'https://example.com/portfolio'};
 const row=(section,value)=>({...newRecord(section),...value});
 p.education=[row('education',{school:'示例理工大学',degree:'本科',major:'计算机科学与技术',startDate:'2017-09',endDate:'2021-06'}),row('education',{school:'虚构信息学院',degree:'硕士',major:'软件工程',startDate:'2021-09',endDate:'2024-06'})];
 p.internships=[row('internships',{organization:'示例实验室',title:'开发实习生',startDate:'2020-07',endDate:'2020-09',description:'仅为测试：编写数据整理工具。'})];
 p.work=[row('work',{organization:'示例科技有限公司',title:'软件工程师',startDate:'2024-07',endDate:'2026-09',description:'仅为测试：维护网页应用和自动化检查。'})];
 p.projects=[row('projects',{name:'虚构求职工具',role:'开发负责人',startDate:'2023-01',endDate:'2023-06',description:'仅为测试：设计本机资料管理原型。'})];
 p.skills=[row('skills',{name:'JavaScript',level:'熟练'}),row('skills',{name:'SQL',level:'熟练'})];
 p.certificates=[row('certificates',{name:'示例软件证书',issuer:'虚构培训中心',date:'2023-06-18'})];return p;
}

