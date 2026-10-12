import {validateImportData} from './import-meta.mjs';
export const CONTACT_FIELDS=[['name','姓名'],['givenName','英文名（不从中文猜测）'],['familyName','英文姓（不从中文猜测）'],['email','电子邮箱'],['phone','手机号码'],['birthDate','出生日期（只按明确资料）'],['gender','性别（选填）'],['politicalStatus','政治面貌（选填）'],['province','现居省份'],['city','居住城市'],['district','所在区县'],['website','作品集网址']];
export const SECTIONS={
 education:{label:'教育经历',fields:[['school','院校名称'],['degree','学历'],['major','专业'],['startDate','入学时间'],['endDate','毕业时间']]},
 internships:{label:'实习经历',fields:[['organization','实习单位'],['title','实习职位'],['startDate','开始时间'],['endDate','结束时间'],['description','经历描述']]},
 work:{label:'工作经历',fields:[['organization','公司名称'],['title','职位名称'],['startDate','开始时间'],['endDate','结束时间'],['description','工作描述']]},
 projects:{label:'项目经历',fields:[['name','项目名称'],['role','担任角色'],['startDate','开始时间'],['endDate','结束时间'],['description','项目描述']]},
 skills:{label:'技能',fields:[['name','技能名称'],['level','熟练程度']]},
 certificates:{label:'证书',fields:[['name','证书名称'],['issuer','颁发机构'],['date','获得时间']]}
};
export function newRecord(section){if(!SECTIONS[section])throw new Error('未知档案类别');return Object.fromEntries([['id',crypto.randomUUID()],...SECTIONS[section].fields.map(([key])=>[key,''])]);}
export function createProfile(){return {schemaVersion:2,profileId:crypto.randomUUID(),updatedAt:new Date().toISOString(),isFictional:false,contact:Object.fromEntries(CONTACT_FIELDS.map(([key])=>[key,''])),...Object.fromEntries(Object.keys(SECTIONS).map(k=>[k,[]]))};}
function clean(value,max=120){if(typeof value!=='string'||value.length>max)throw new Error('档案字段类型或长度不合法');return value.trim();}
function safeObject(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('档案对象不合法');for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error('档案包含不支持的字段：'+key);}
export function validDate(value){if(!value)return true;if(!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value))return false;const[y,m='01',d='01']=value.split('-');const date=new Date(Date.UTC(+y,+m-1,+d));return +y>=1900&&+y<=2100&&date.getUTCFullYear()===+y&&date.getUTCMonth()===+m-1&&date.getUTCDate()===+d;}
export function validateProfile(value,{allowInvalidFields=false}={}){
 safeObject(value,['schemaVersion','profileId','updatedAt','isFictional','contact','importData',...Object.keys(SECTIONS)]);
 if(value.schemaVersion!==2)throw new Error('不支持的档案版本；请使用 v2 档案');
 if(typeof value.profileId!=='string'||!/^[\w-]{1,80}$/.test(value.profileId))throw new Error('档案标识不合法');
 if(typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))throw new Error('档案修改时间不合法');
 if(typeof value.isFictional!=='boolean')throw new Error('需要明确是否为虚构测试档案');
 safeObject(value.contact,CONTACT_FIELDS.map(([key])=>key));
 const contact=Object.fromEntries(CONTACT_FIELDS.map(([key])=>[key,clean(value.contact[key]??'',key==='website'?500:120)]));
 if(!allowInvalidFields&&contact.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))throw new Error('电子邮箱格式不正确');
 if(!allowInvalidFields&&contact.phone&&!/^\+?[\d ()-]{6,40}$/.test(contact.phone))throw new Error('手机号码格式不正确');
 if(!allowInvalidFields&&contact.website){let u;try{u=new URL(contact.website);}catch{throw new Error('作品集网址不合法');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('作品集网址仅接受普通 HTTP/HTTPS 链接');}
 if(!allowInvalidFields&&!validDate(contact.birthDate))throw new Error('出生日期不合法，请保留原资料的年份、年月或完整日期精度');
 const result={schemaVersion:2,profileId:value.profileId,updatedAt:value.updatedAt,isFictional:value.isFictional,contact};
 for(const [key,section]of Object.entries(SECTIONS)){
  if(!Array.isArray(value[key])||value[key].length>30)throw new Error(section.label+'最多30条');
  const ids=new Set();
  result[key]=value[key].map(record=>{
   safeObject(record,['id',...section.fields.map(([k])=>k)]);
   if(typeof record.id!=='string'||!/^[\w-]{1,80}$/.test(record.id)||ids.has(record.id))throw new Error('经历标识缺失或重复');ids.add(record.id);
   const row={id:record.id};for(const [name]of section.fields){row[name]=clean(record[name]??'',name==='description'?6000:200);if(!allowInvalidFields&&(/Date$/.test(name)||name==='date'))if(!validDate(row[name]))throw new Error(section.label+'日期格式不合法，请用 YYYY、YYYY-MM 或 YYYY-MM-DD');}
   if(!allowInvalidFields&&row.startDate&&row.endDate&&row.startDate>(row.endDate.length===4?row.endDate+'-12-31':row.endDate.length===7?row.endDate+'-31':row.endDate))throw new Error(section.label+'开始时间不能晚于结束时间');return row;
  });
 }
 if(value.importData){const paths=new Set(CONTACT_FIELDS.map(([k])=>'contact.'+k));for(const[k,section]of Object.entries(SECTIONS))for(const row of result[k])for(const[field]of section.fields)paths.add(k+'.'+row.id+'.'+field);result.importData=validateImportData(value.importData,paths);}
 return result;
}
export function profileFields(profile){
 const list=CONTACT_FIELDS.map(([key,label])=>({path:'contact.'+key,label:'个人资料 · '+label,value:profile.contact[key]}));
 for(const [key,section]of Object.entries(SECTIONS))profile[key].forEach((row,index)=>section.fields.forEach(([name,label])=>list.push({path:key+'.'+index+'.'+name,label:section.label+' '+(index+1)+' · '+label,value:row[name]})));
 list.push({path:'skills.all',label:'技能 · 全部技能名称',value:profile.skills.map(s=>s.name).filter(Boolean)});
 return list;
}
export function createFictionalProfile(){
 const p=createProfile();p.isFictional=true;p.contact={...p.contact,name:'林知行',givenName:'Zhixing',familyName:'Lin',email:'lin.zhixing@example.com',phone:'19900000000',city:'杭州',website:'https://example.com/portfolio'};
 const row=(s,v)=>({...newRecord(s),...v});
 p.education=[row('education',{school:'示例理工大学',degree:'本科',major:'计算机科学与技术',startDate:'2017-09',endDate:'2021-06'}),row('education',{school:'虚构信息学院',degree:'硕士',major:'软件工程',startDate:'2021-09',endDate:'2024-06'})];
 p.internships=[row('internships',{organization:'示例实验室',title:'开发实习生',startDate:'2020-07',endDate:'2020-09',description:'仅为测试：编写数据整理工具。'})];
 p.work=[row('work',{organization:'示例科技有限公司',title:'软件工程师',startDate:'2024-07',endDate:'2026-09',description:'仅为测试：维护网页应用和自动化检查。'})];
 p.projects=[row('projects',{name:'虚构求职工具',role:'开发负责人',startDate:'2023-01',endDate:'2023-06',description:'仅为测试：设计本机资料管理原型。'})];
 p.skills=[row('skills',{name:'JavaScript',level:'熟练'}),row('skills',{name:'SQL',level:'熟练'})];
 p.certificates=[row('certificates',{name:'示例软件证书',issuer:'虚构培训中心',date:'2023-06-18'})];return p;
}
