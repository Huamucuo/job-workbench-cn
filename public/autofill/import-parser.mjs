import {SECTIONS,validDate} from './profile.mjs';

// A conservative local parser. Candidate values always retain their original line.
const HEADINGS={education:/^(教育(背景|经历)|学习经历|education( background)?)$/i,internships:/^(实习(经历|经验)|internship(s| experience)?)$/i,work:/^(工作(经历|经验)|职业经历|(work|professional|employment) experience|employment)$/i,projects:/^(项目(经历|经验)|project(s| experience)?)$/i,skills:/^(专业技能|个人技能|技能(特长)?|skills|technical skills)$/i,certificates:/^(证书(与资质)?|资格证书|荣誉证书|certifications?|certificates)$/i,languages:/^(语言(能力|技能)?|外语(水平|能力)|languages?|language skills)$/i};
const ABOUT_HEADINGS={introduction:/^(自我(介绍|评价)|个人(简介|总结)|summary|about me|introduction)$/i,other:/^(其他(信息|补充)|补充说明|other information|additional information)$/i};
const ABOUT_LABELS={introduction:['自我介绍','自我评价','个人简介','introduction','summary'],other:['其他信息','其他补充','补充说明','other information','additional information']};
const LANGUAGE_LABELS={name:['语种','语言','外语','language','language name'],level:['熟练程度','语言水平','水平','level','proficiency'],certificate:['语言证书','语言成绩','考试成绩','证书','certificate','test score']};
const STOP=/^(自我评价|兴趣爱好|个人总结|求职意向|获奖经历|校园经历|社会实践|联系方式|个人信息|基本信息|个人资料|profile|summary|interests|references|awards|contact( information)?|personal information)$/i;
const CONTACT={name:['姓名','中文姓名','name','full name'],givenName:['英文名','given name','first name'],familyName:['英文姓','surname','family name','last name'],email:['电子邮箱','邮箱','e-mail','email'],phone:['手机号码','联系电话','手机','电话','mobile','phone','tel'],gender:['性别','gender','sex'],politicalStatus:['政治面貌','political status'],birthDate:['出生日期','出生年月','生日','date of birth','birth date'],province:['现居省份'],city:['居住城市','现居城市','现居地','current city'],district:['所在区县','现居区县'],website:['作品集网址','个人网站','作品集','website','portfolio']};
const LABELS={school:['院校名称','毕业院校','院校','学校','school','university'],degree:['学历','education level','educational qualification'],academicDegree:['学位','academic degree'],major:['专业','major'],organization:['实习单位','公司名称','工作单位','公司','机构名称','单位','organization','company','employer'],title:['实习职位','职位名称','职位','岗位','title','position'],name:['项目名称','证书名称','技能名称','项目','证书','project name','certificate','skill'],role:['担任角色','项目角色','角色','role'],startDate:['入学时间','开始时间','起始时间','start date'],endDate:['毕业时间','结束时间','end date'],date:['获得时间','发证时间','date'],issuer:['颁发机构','发证机构','issuer'],level:['熟练程度','level'],description:['工作描述','经历描述','项目描述','职责','工作内容','描述','description','responsibilities']};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const datePattern='(?:19|20)\\d{2}(?:[年./-]\\d{1,2}(?:[月./-]\\d{1,2}日?)?月?)?';
const rangeRE=new RegExp('('+datePattern+')\\s*(?:至|到|[~～—–−-]|\\bto\\b)\\s*('+datePattern+'|至今|现在|present|current)', 'i');
export function normalizeDate(value){const v=value.trim().replace(/日/g,'').replace(/[年/月.]/g,'-').replace(/-$/,'');const m=v.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);if(!m)return '';const out=[m[1],...m.slice(2).filter(Boolean).map(s=>s.padStart(2,'0'))].join('-');return validDate(out)?out:'';}
function labels(text,dict){
 const names=Object.values(dict).flat().sort((a,b)=>b.length-a.length),rx=new RegExp('(?:^|[|｜;；,，\\t]|\\s+)('+names.map(esc).join('|')+')\\s*[:：]\\s*','gi'),matches=[...text.matchAll(rx)];
 const result=matches.map((m,i)=>{const key=Object.keys(dict).find(k=>dict[k].some(n=>n.toLowerCase()===m[1].toLowerCase())),raw=text.slice(m.index+m[0].length,matches[i+1]?.index??text.length).trim().replace(/[|｜;；,，]+$/,'').trim();
  const boundary=key==='description'?-1:raw.search(/(?:[|｜;；,，\t]\s*[\p{L}][\p{L} ._-]{0,24}|\s+(?:age|location|nationality|ethnicity|民族|籍贯|年龄|出生地))\s*[:：]/iu);
  const value=boundary<0?raw:raw.slice(0,boundary).trim(),ambiguous=key!=='description'&&key!=='website'&&/[:：]/.test(value);
  return {key,value:ambiguous?'':value,hasUnknown:boundary>=0||ambiguous};});
 result.unknown=text.split(/[|｜;；,，\t]/).some(part=>{const label=part.trim().match(/^([\p{L}][\p{L} ._-]{0,24})\s*[:：]/u)?.[1]?.trim();return label&&!names.some(n=>n.toLowerCase()===label.toLowerCase());});return result;
}
const primary=s=>s==='education'?'school':['work','internships'].includes(s)?'organization':'name';
const strip=text=>text.trim().replace(/^[•●▪·]\s*/,'');
export function parseDocument(input){
 if(!input||typeof input.text!=='string'||input.text.length>60000||!Array.isArray(input.lines)||input.lines.length>6000)throw new Error('文档文字超过限制或无法读取');
 const source={id:input.id,name:input.name,type:input.type,text:input.text,warnings:[...(input.warnings||[])],importedAt:new Date().toISOString()};
 const result={source,contact:[],about:[],records:[],unresolved:[]};let section=null,current=null,contactArea=true,serial=0,aboutKey=null,aboutCurrent=null;
 const evidence=(line,confidence='high',reason='明确标签或结构')=>({sourceId:source.id,line:line.line,page:line.page||1,quote:line.text.slice(0,300),confidence,reason});
 const unresolved=(line,reason)=>result.unresolved.push({sourceId:source.id,line:line.line,page:line.page||1,text:line.text,reason});
 const finish=()=>{if(current){if(current.values[primary(current.section)])result.records.push(current);else for(const line of current.lines)unresolved(line,'经历缺少名称，请手工归类');}current=null;};
 const start=()=>{finish();current={id:source.id+'-'+(++serial),section,values:Object.fromEntries(SECTIONS[section].fields.map(([k])=>[k,''])),evidence:{},lines:[],warnings:[]};};
 const set=(key,value,line,confidence='high',reason)=>{if(!value)return;if(!current)start();if(!(key in current.values))return;current.values[key]=value;current.evidence[key]=evidence(line,confidence,reason);if(!current.lines.includes(line))current.lines.push(line);};
 const contact=(key,value,line,confidence='high',reason)=>{if(key==='birthDate'){const date=normalizeDate(value);if(!date){unresolved(line,'出生日期格式不明确，不推测日期');return;}value=date;}if(!value)return;if(!result.contact.some(c=>c.key===key&&c.value===value))result.contact.push({key,value,evidence:evidence(line,confidence,reason)});};
 const self=(key,value,line,newCandidate=false)=>{if(!value)return;if(newCandidate||!aboutCurrent||aboutCurrent.key!==key){aboutCurrent={key,value:'',evidence:[]};result.about.push(aboutCurrent);}const next=(aboutCurrent.value?aboutCurrent.value+'\n':'')+value;if(next.length>6000){unresolved(line,'自述超过6000字，请手动整理；原文仍保留');return;}aboutCurrent.value=next;aboutCurrent.evidence.push(evidence(line,'high','明确自述标题或标签下的原文'));};
 for(const line of input.lines){
  const text=strip(line.text);if(!text)continue;const heading=text.replace(/[：:]$/,'').replace(/\s+/g,' ').trim();
  const found=Object.entries(HEADINGS).find(([,rx])=>rx.test(heading));if(found){finish();section=found[0];aboutKey=null;aboutCurrent=null;contactArea=false;continue;}
  const selfHeading=Object.entries(ABOUT_HEADINGS).find(([,rx])=>rx.test(heading));if(selfHeading){finish();section=null;aboutKey=selfHeading[0];aboutCurrent=null;contactArea=false;continue;}
  if(STOP.test(heading)){finish();section=null;aboutKey=null;aboutCurrent=null;contactArea=/联系方式|个人信息|基本信息|个人资料|profile|contact|personal/i.test(heading);continue;}
  if(/^(个人简历|简历|求职简历|resume|curriculum vitae)$/i.test(text))continue;
  if(/推荐人|紧急联系人|家庭成员|家庭情况|家庭关系|社会关系|父亲|母亲|配偶|reference\s*(name|email|phone|contact)?|referee|family\s+(members|information)|emergency\s+contact/i.test(text)){finish();section=null;aboutKey=null;aboutCurrent=null;contactArea=false;unresolved(line,'第三方资料区块不导入本人信息，直到明确的新章节');continue;}
  if(!section){const marked=labels(text,ABOUT_LABELS);if(marked.length){for(const{key,value}of marked){self(key,value,line,true);aboutKey=key;}contactArea=false;if(marked.unknown||marked.some(item=>item.hasUnknown))unresolved(line,'自述标签存在歧义，请核对原文');continue;}}
  if(aboutKey){self(aboutKey,line.text.trim(),line);continue;}
  if(contactArea){const marked=labels(text,CONTACT);if(marked.length){for(const {key,value}of marked)contact(key,value,line);if(marked.unknown||marked.some(m=>m.hasUnknown))unresolved(line,'包含不支持的标签，额外资料未放入本人字段');continue;}
   let recognized=false;const email=text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i),phone=text.match(/(?:^|\s|[|｜])((?:\+86[- ]?)?1[3-9]\d{9})(?=$|\s|[|｜])/);
   if(email){contact('email',email[0],line,'medium','联系信息区域的邮箱');recognized=true;}if(phone){contact('phone',phone[1],line,'medium','联系信息区域的手机号码');recognized=true;}
   if(recognized)continue;
   if(line.line<=4&&/^[\u4e00-\u9fff]{2,4}$/.test(text)&&!/(简历|学生|求职|资料|信息|测试|虚构|工程师)/.test(text)){contact('name',text,line,'low','开头短文本可能为姓名，需人工确认');continue;}
  }
  if(!section){unresolved(line,'未识别类别');continue;}
  const allowed=section==='languages'?LANGUAGE_LABELS:Object.fromEntries(SECTIONS[section].fields.map(([k])=>[k,LABELS[k]]));const marked=labels(text,allowed);const pk=primary(section),range=text.match(rangeRE);
  if(marked.some(v=>v.key===pk)&&current?.values[pk])start();
  if(marked.length){if(!current)start();for(const {key,value}of marked){if(/Date$/.test(key)||key==='date'){const d=normalizeDate(value);if(d)set(key,d,line);else if(!/^(至今|现在|present|current)$/i.test(value)){current.warnings.push('日期未识别：'+value);unresolved(line,'日期不明确');}}else set(key,key==='description'&&current.values.description?current.values.description+'\n'+value:value,line);}if(marked.unknown||marked.some(m=>m.hasUnknown))unresolved(line,'包含未识别的经历标签');continue;}
  if(section==='skills'){
   const parts=text.split(/[、,，;；|｜]/).map(s=>s.trim()).filter(Boolean);for(const part of parts){const pair=part.match(/^(.{1,80}?)(?:\s*[:：]\s*|\s+)(熟练|精通|熟悉|了解|初学|advanced|intermediate|beginner)$/i);if(part.length>100){unresolved(line,'技能描述过长，请拆分');continue;}start();set('name',pair?pair[1]:part,line,'medium','技能标题下的列表');if(pair)set('level',pair[2],line);}continue;
  }
  if(section==='languages'){const pair=text.match(/^(英语|中文|汉语|日语|法语|德语|西班牙语|韩语|English|Mandarin|Chinese|Japanese|French|German|Spanish|Korean)\s*[:：]\s*(母语|熟练|精通|熟悉|基础|初学|native|fluent|advanced|intermediate|beginner|[ABC][12])$/i);if(pair){start();set('name',pair[1],line,'medium','明确语种与熟练程度');set('level',pair[2],line,'medium','明确语种与熟练程度');}else unresolved(line,'语言记录缺少明确标签或程度，请手动归类，不推测证书与水平');continue;}
  const remainder=range?text.replace(range[0],'').replace(/^[|｜\s]+|[|｜\s]+$/g,''):'',bits=remainder.split(/\s*[|｜\t]\s*|\s{2,}/).filter(Boolean);
  const rangeAtEdge=range&&(!text.slice(0,range.index).trim()||!text.slice(range.index+range[0].length).replace(/[|｜\s]/g,''));
  const rangeHeader=rangeAtEdge&&(bits.length>=2||!remainder||/(公司|大学|学院|学校|实验室|中心|university|college|inc\.?|ltd\.?)$/i.test(remainder));
  if(rangeHeader&&!(current?.values.startDate&&!remainder)){
   if(remainder&&current?.values[pk])start();if(!current)start();
   const startDate=normalizeDate(range[1]),endDate=normalizeDate(range[2]);
   if(startDate)set('startDate',startDate,line);else {current.warnings.push('开始日期不合法');unresolved(line,'开始日期不合法');}
   if(endDate)set('endDate',endDate,line);else if(/至今|现在|present|current/i.test(range[2]))current.warnings.push('原文为“至今”，结束时间留空，不替换为今天');else {current.warnings.push('结束日期不合法');unresolved(line,'结束日期不合法');}
   if(bits.length){set(pk,bits[0],line,bits.length>1?'high':'medium','经历标题与时间范围');
    if(section==='education'){const degree=bits.slice(1).find(v=>/^(专科|大专|本科|硕士|博士|高中|中专)$/.test(v));if(degree)set('degree',degree,line);const rest=bits.slice(1).filter(v=>v!==degree),ambiguous=rest.some(v=>/学士|MBA|PhD|Bachelor|Master|Doctor/i.test(v));if(ambiguous)unresolved(line,'学位或英文Degree含义不明确，仅明确学位标签可导入');else if(rest.length===1)set('major',rest[0],line,'medium','教育标题的剩余列');else if(rest.length>1)unresolved(line,'教育标题列数不明确，请核对专业');}
    else if(['work','internships','projects'].includes(section)&&bits[1])set(section==='projects'?'role':'title',bits.slice(1).join(' | '),line,'medium','经历标题的职位列');
   }continue;
  }
  if(section==='education'){
   const pieces=text.split(/\s*[|｜\t]\s*|\s{2,}/).filter(Boolean),school=pieces.find(v=>/(大学|学院|学校|university|college|institute)$/i.test(v));
   if(school){if(current?.values.school)start();set('school',school,line,'medium','院校名称后缀');const degree=pieces.find(v=>/^(本科|专科|大专|硕士|博士)$/.test(v));if(degree)set('degree',degree,line,'medium');const other=pieces.filter(v=>v!==school&&v!==degree);if(other.some(v=>/学士|MBA|PhD|Bachelor|Master|Doctor/i.test(v)))unresolved(line,'学位含义不明确，仅明确学位标签可导入');else if(other.length===1)set('major',other[0],line,'medium');else if(other.length>1)unresolved(line,'教育标题列数不明确，请手工核对');continue;}
  }
  if(!current&&section==='certificates'&&text.length<=200){start();set('name',text,line,'low','证书名称未分列，请核对');continue;}
  if(current&&'description'in current.values){const previous=current.values.description;set('description',(previous?previous+'\n':'')+line.text.trim(),line,'medium','经历标题下的原始描述');continue;}
  unresolved(line,'当前类别内无法可靠映射');
 }
 finish();for(const row of result.records){row.raw=row.lines.map(l=>l.text).join('\n');delete row.lines;}
 return result;
}
