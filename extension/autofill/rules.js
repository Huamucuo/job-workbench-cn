(()=>{
'use strict';
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/必填|required|optional|选填/g,'').replace(/[\s_－\-:：*＊()（）/\\.,。'’\[\]]/g,'');
const groups={education:/教育|学历|education|academic/i,internships:/实习|internship/i,work:/工作经历|任职经历|employment|work experience/i,projects:/项目经历|project/i,skills:/技能|skills/i,certificates:/证书|资格证|certificat/i};
const contacts={name:['姓名','真实姓名','中文姓名','fullname','legalname','name','applicantname'],givenName:['英文名','firstname','givenname'],familyName:['英文姓','lastname','familyname','surname'],email:['邮箱','电子邮箱','电子邮件','email','emailaddress','emailaddressrequired'],phone:['手机','手机号','手机号码','联系电话','联系电话手机','mobile','mobilephone','phonenumber','telephone','contactnumber','phone'],birthDate:['出生日期','出生年月','生日','dateofbirth','birthdate','birthday','dob'],gender:['性别','gender','sex'],politicalStatus:['政治面貌','politicalstatus','politicalaffiliation'],province:['现居省份','居住省份','所在省份','省份','province','currentprovince','stateprovince','state'],city:['居住城市','所在城市','现居城市','city','currentcity','locationcity'],district:['所在区县','居住区县','现居区县','区县','district','currentdistrict'],website:['作品集','作品集网址','个人网站','website','portfoliourl','portfolio']};
const records={school:['院校名称','学校','学校名称','毕业院校','就读学校','school','university','institution','schoolname'],degree:['学历','学位','最高学历','degree','qualification','educationlevel'],major:['专业','所学专业','专业名称','major','fieldofstudy'],organization:['公司名称','工作单位','实习单位','单位名称','company','companyname','employer','organization'],title:['职位','职位名称','岗位','岗位名称','实习职位','职务','jobtitle','position','title'],startDate:['开始时间','起始时间','入学时间','入职时间','开始日期','startdate','fromdate','startmonth'],endDate:['结束时间','毕业时间','离职时间','结束日期','enddate','todate','endmonth','graduationdate'],description:['工作描述','经历描述','项目描述','职责描述','description','responsibilities'],name:['项目名称','证书名称','技能名称','projectname','certificatename','skillname','name'],role:['担任角色','项目角色','role'],issuer:['颁发机构','发证机构','issuer','issuingorganization'],date:['获得时间','获证时间','issuedate','dateobtained']};
const validPath=/^(contact\.(name|givenName|familyName|email|phone|birthDate|gender|politicalStatus|province|city|district|website)|skills\.all|(education|internships|work|projects|skills|certificates)\.(?:[0-9]|[12][0-9])\.(school|degree|major|organization|title|startDate|endDate|description|name|role|issuer|date|level))$/;
function blocked(f){const s=[f.label,f.name,f.context,f.safetyContext,f.autocomplete].join(' ');if(['password','file','hidden','submit','button','reset'].includes(f.type))return '密码、上传、隐藏和提交控件不处理';if(/验证码|captcha|one.?time.?code|短信码|动态口令|同意|承诺|声明|隐私政策|terms|consent|privacy|agree|身份证|护照|passport|national.?id|social.?security|银行卡|信用卡|民族|宗教|婚育|健康|残疾|紧急联系人|emergency|推荐人|referee/i.test(s))return '受保护或非申请人字段，必须人工处理';if(/家庭|家属|亲属|亲友|社会关系|与本人关系|父亲|母亲|配偶|监护人|子女|父母|兄弟|姐妹|儿子|女儿|孩子|哥哥|姐姐|弟弟|妹妹|祖父|祖母|外公|外婆|爷爷|奶奶|孙子|孙女|侄|外甥|岳父|岳母|叔叔|伯父|姑姑|阿姨|舅舅|family(?![\s_-]*name\b)|relative|father|mother|parent|spouse|guardian|next[\s_-]*of[\s_-]*kin|depend[ae]nt|referrer|sibling|children|brother|sister|daughter|husband|wife|cousin|uncle|aunt|\bchild\b|\bson(?:\b|[_-]|name|phone|email)/i.test(s))return '家庭成员、亲属或其他非申请人资料，必须人工填写';if(f.ambiguousGroup)return '经历顺序存在歧义，请展开并核对后手工填写';if(f.disabled||f.readOnly)return '禁用或只读控件';return null;}
function groupFor(text){for(const[k,re]of Object.entries(groups))if(re.test(text||''))return k;return null;}
function inferField(f){
 const reason=blocked(f);if(reason)return {path:null,status:'blocked',reason};
 if(f.type==='custom')return {path:null,status:'unsupported',reason:'自定义控件尚不支持，保留人工填写'};
 if(/户籍|籍贯|出生|birth|hometown|registered|native.?place/i.test([f.context,f.safetyContext,f.label].join(' '))&&([f.label,f.name].some(s=>['province','city','district'].some(k=>contacts[k].map(norm).includes(norm(s))))||/address-level[123]/.test(f.autocomplete||'')))return {path:null,status:'blocked',reason:'此处要求户籍、籍贯或出生地，不能套用现居地址'};
 const group=f.group||groupFor(f.context),index=Number.isInteger(f.index)?f.index:0;
 const auto={'name':'name','given-name':'givenName','family-name':'familyName','email':'email','tel':'phone','bday':'birthDate','sex':'gender','address-level1':'province','address-level2':'city','address-level3':'district','url':'website'};
 const ac=String(f.autocomplete||'').split(/\s+/).at(-1);
 if(!group&&auto[ac])return {path:'contact.'+auto[ac],status:'matched',reason:'标准 autocomplete 明确对应'};
 const terms=[f.label,f.placeholder,f.name].filter(Boolean).map(norm);
 let key=null;
 if(group){
  const allowed={education:['school','degree','major','startDate','endDate'],internships:['organization','title','startDate','endDate','description'],work:['organization','title','startDate','endDate','description'],projects:['name','role','startDate','endDate','description'],skills:['name'],certificates:['name','issuer','date']}[group];
  if(group==='skills'&&['checkbox-group','select-multiple'].includes(f.type))return {path:'skills.all',status:'matched',reason:'技能多选分组'};
  const found=allowed.filter(k=>terms.some(t=>(records[k]||[]).map(norm).includes(t)));
  if(found.length===1)key=found[0];
  if(key)return {path:group+'.'+index+'.'+key,status:'matched',reason:'明确经历分组及第 '+(index+1)+' 条标签'};
 }else{
  const found=Object.entries(contacts).filter(([,aliases])=>terms.some(t=>aliases.map(norm).includes(t)));
  if(found.length===1)return {path:'contact.'+found[0][0],status:'matched',reason:'明确联系人字段名称'};
  if(terms.some(t=>['技能','skills','专业技能'].map(norm).includes(t)))return {path:'skills.all',status:'matched',reason:'技能字段'};
  // A school without a record boundary may mean latest/previous school. Do not assume index 0.
 }
 return {path:null,status:'unmapped',reason:'名称或所属经历不够明确，请人工指定'};
}
function signature(f){return JSON.stringify([norm(f.label)||norm(f.name),f.type,f.group||groupFor(f.context)||'',f.index||0,(f.options||[]).map(o=>[norm(o.label),o.value,!!o.disabled])]);}
function valueAt(profile,path){if(!validPath.test(path))return undefined;if(path==='skills.all')return(profile.skills||[]).map(x=>x.name).filter(Boolean);return path.split('.').reduce((o,k)=>o?.[k],profile);}
const degreeAliases={本科:['本科','学士','bachelor','bachelorsdegree','bachelordegree','bachelorofscience','undergraduate'],硕士:['硕士','master','mastersdegree','masterdegree'],博士:['博士','phd','doctorate'],大专:['大专','专科','associate','associatedegree'],高中:['高中','highschool']};
function optionMatch(value,options,path){let aliases=[norm(value)];if(path?.endsWith('.degree'))for(const[label,values]of Object.entries(degreeAliases))if([label,...values].map(norm).includes(norm(value)))aliases=[label,...values].map(norm);const matches=options.filter(o=>!o.disabled&&(aliases.includes(norm(o.label))||aliases.includes(norm(o.value))));return matches.length===1?matches[0]:null;}
function convertValue(raw,f,path=''){
 if(raw===undefined||raw===null||raw===''||(Array.isArray(raw)&&!raw.length))return {ok:false,reason:'档案中未提供，不推测'};
 if(['select-one','radio-group','select-multiple','checkbox-group'].includes(f.type)){
  const values=Array.isArray(raw)?raw:[raw];if(['select-one','radio-group'].includes(f.type)&&values.length!==1)return {ok:false,reason:'多条内容不能合并到单选'};
  const matches=values.map(v=>optionMatch(v,f.options||[],path));if(matches.some(x=>!x))return {ok:false,reason:'选项缺失或不唯一，请人工选择'};
  return {ok:true,value:['select-multiple','checkbox-group'].includes(f.type)?matches.map(m=>m.value):matches[0].value};
 }
 let value=Array.isArray(raw)?raw.join('、'):String(raw);
 if(f.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return {ok:false,reason:'来源日期不含完整年月日，不能编造具体日'};
 if(f.type==='month'){if(!/^\d{4}-\d{2}(-\d{2})?$/.test(value))return {ok:false,reason:'不是有效年月'};value=value.slice(0,7);}
 if(f.type==='checkbox')return {ok:false,reason:'独立勾选不自动推断'};
 if(!['text','email','tel','url','search','textarea','date','month','number'].includes(f.type))return {ok:false,reason:'尚不支持的控件'};
 if(f.maxLength>0&&value.length>f.maxLength)return {ok:false,reason:'内容超过网站长度限制，不截断资料'};
 if(f.type==='number'&&!/^-?\d+(\.\d+)?$/.test(value))return {ok:false,reason:'网站要求数字'};
 return {ok:true,value};
}
function previewValue(raw,f,path='',parentHasValue=false){
 if(parentHasValue&&f.cascade&&f.cascade.path===path){const current=convertValue(raw,f,path);if(current.ok)return {...current,reason:'先核对现有上级与档案一致，再填写已加载的唯一选项；不覆盖上级'};}
 if(f.cascade&&f.cascade.path===path&&['contact.city','contact.district'].includes(path)&&f.type==='select-one'&&!f.hasValue&&!blocked(f)&&typeof raw==='string'&&raw.trim()&&raw.length<=120)return {ok:true,value:raw,deferred:{path},reason:'需同时勾选上级地区；填写时等待上级加载后按此文字唯一匹配'};
 return convertValue(raw,f,path);
}
function planFields(fields,profile,memory=[],scope=''){
 return fields.map(f=>{
  const initial=inferField(f);const saved=memory.find(m=>m.scope===scope&&m.signature===signature(f)&&validPath.test(m.path));
  const mapping=['blocked','unsupported'].includes(initial.status)?initial:saved?{path:saved.path,status:'matched',reason:'本机已确认映射，请复核'}:initial;
  if(!mapping.path)return {...f,...mapping,selected:false};
  const raw=valueAt(profile,mapping.path),converted=previewValue(raw,f,mapping.path,fields.find(p=>p.id===f.cascade?.parentId)?.hasValue===true);
  return {...f,...mapping,raw,value:converted.value,...(converted.deferred?{deferred:converted.deferred}:{}),status:converted.ok?(f.hasValue?'occupied':'ready'):'missing',reason:converted.ok?(f.hasValue?'已有内容，默认不覆盖':converted.reason||mapping.reason):converted.reason,selected:converted.ok&&!f.hasValue};
 });
}
function requestItems(rows){
 const selected=new Set(rows.filter(r=>r.selected).map(r=>r.id));
 return rows.filter(r=>r.selected).map(r=>{
  const item={fieldId:r.id,value:r.value,overwrite:r.overwrite===true};
  if(r.cascade&&r.path===r.cascade.path&&!r.hasValue&&selected.has(r.cascade.parentId)){item.value=r.raw;item.deferred={path:r.path};}
  else if(r.deferred)item.deferred=r.deferred;
  else if(r.cascade){
   const anchors=[];let id=r.cascade.parentId;
   for(let i=0;i<3&&id&&!selected.has(id);i++){const parent=rows.find(p=>p.id===id);if(!parent||!parent.hasValue||typeof parent.value!=='string')break;anchors.push({fieldId:id,value:parent.value});id=parent.cascade?.parentId;}
   item.anchors=anchors;
  }
  return item;
 });
}
globalThis.JobAutofillRules=Object.freeze({norm,groupFor,blocked,inferField,signature,valueAt,convertValue,previewValue,planFields,requestItems,validPath});
})();
