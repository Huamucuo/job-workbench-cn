import {createFictionalProfile} from '../profile.mjs';
import {mountPanel} from '../panel.mjs';
import {storage,VAULT_KEY,decryptProfile,downloadJson} from '../vault.mjs';
import {el} from '../ui.mjs';
const $=s=>document.querySelector(s),page=location.pathname.split('/').at(-1),fiction=createFictionalProfile();
let activeProfile=fiction,loadedFromVault=false,profileTimer=null,panel;
$('#fictional-reference').textContent=JSON.stringify(fiction,null,2);
let submissions=0,engineReports=[],assistedStart=null,lastReport=null,manualStart=null;
const timingKey='zhiyouyinli.lab.timing.'+page;
const manual=()=>{try{return JSON.parse(localStorage.getItem(timingKey)||'null');}catch{return null;}};
function renderTiming(){const m=manual();$('#manual-status').textContent=m?'已记录人工基线 '+(m.durationMs/1000).toFixed(1)+' 秒；该数值由操作人计时，未自动认证。':'尚无人工基线，不估算节省时间。';}
renderTiming();
$('#manual-start').addEventListener('click',()=>{manualStart=performance.now();$('#manual-stop').disabled=false;$('#manual-status').textContent='人工计时中，请自己按虚构档案填写；不要使用助手。';});
$('#manual-stop').addEventListener('click',()=>{if(manualStart===null)return;localStorage.setItem(timingKey,JSON.stringify({durationMs:Math.round(performance.now()-manualStart),recordedAt:new Date().toISOString()}));manualStart=null;$('#manual-stop').disabled=true;renderTiming();});
$('#clear-timing').addEventListener('click',()=>{localStorage.removeItem(timingKey);renderTiming();});
$('#application').addEventListener('submit',e=>{e.preventDefault();submissions++;$('#submission-count').textContent=String(submissions);});
$('#use-extension').addEventListener('change',e=>{$('#assistant').hidden=e.target.checked;});
const transport={scan:()=>{if(assistedStart===null)assistedStart=performance.now();return JobAutofillEngine.scan();},apply:async(id,items)=>{$('#check-result').disabled=true;try{return await JobAutofillEngine.apply(id,items);}finally{$('#check-result').disabled=false;}},prepareGroups:counts=>{if(assistedStart===null)assistedStart=performance.now();return JobAutofillEngine.prepareGroups(counts);}};
async function mount(){panel?.destroy();panel=await mountPanel($('#assistant'),{transport,getProfile:()=>activeProfile,onResult:r=>engineReports.push(r)});}
await mount();
function refreshLabLock(){clearTimeout(profileTimer);if(loadedFromVault)profileTimer=setTimeout(lockImported,300000);}
async function lockImported(){clearTimeout(profileTimer);loadedFromVault=false;activeProfile=fiction;$('#lab-imported-password').value='';$('#fictional-reference').textContent=JSON.stringify(fiction,null,2);$('#lab-profile-status').textContent='导入档案已锁定；内置助手恢复页面样例。已填到表单的内容请自行清理。';await mount();}
$('#lab-load-imported').addEventListener('click',async()=>{const password=$('#lab-imported-password').value;$('#lab-imported-password').value='';try{const profile=await decryptProfile(await storage.get(VAULT_KEY),password);if(!profile.isFictional)throw new Error('档案未标记为虚构测试资料。为避免真实资料进入验收页面，请先在档案页核对标记并保存');activeProfile=profile;loadedFromVault=true;$('#fictional-reference').textContent=JSON.stringify(profile,null,2);$('#lab-profile-status').textContent='已使用本机保存的导入档案 · '+profile.contact.name+' · 教育'+profile.education.length+' / 实习'+profile.internships.length+' / 项目'+profile.projects.length+'。这是共用引擎测试，不代表扩展已安装。';await mount();refreshLabLock();}catch(e){$('#lab-profile-status').textContent='未载入：'+e.message;}});
$('#lab-lock-imported').addEventListener('click',lockImported);document.addEventListener('pointerdown',refreshLabLock);document.addEventListener('keydown',refreshLabLock);window.addEventListener('pagehide',()=>{clearTimeout(profileTimer);activeProfile=fiction;loadedFromVault=false;panel?.destroy();$('#fictional-reference').textContent='';});
function input(id,text,type='text'){const n=el('input',{id,name:id,type});return el('label',{class:'af-field'},[text,n]);}
$('#add-education')?.addEventListener('click',()=>{
 const index=$('#education-list').children.length+1;if(index>3)return;
 const prefix='bEdu'+index,select=el('select',{id:prefix+'Degree'},[el('option',{value:'',text:'Please select'}),el('option',{value:'B',text:"Bachelor's degree"}),el('option',{value:'M',text:"Master's degree"})]);
 $('#education-list').append(el('fieldset',{},[el('legend',{text:'Education '+index}),el('div',{class:'af-grid'},[input(prefix+'School','University'),el('label',{class:'af-field'},['Qualification',select]),input(prefix+'Major','Field of study'),input(prefix+'Start','Start date','month'),input(prefix+'End','End date','month')])]));
});
$('#next-step')?.addEventListener('click',()=>{$('#step-one').hidden=true;$('#step-two').hidden=false;});
$('#prev-step')?.addEventListener('click',()=>{$('#step-two').hidden=true;$('#step-one').hidden=false;});
// Independent literals, deliberately not derived from the rule engine or its plan.
const expectations={
 'guards.html':{gSchool:'虚构信息学院',gSkills:['SQL','JavaScript']},
 'basic.html':{aName:'林知行',aEmail:'lin.zhixing@example.com',aPhone:'19900000000',aWebsite:'https://example.com/portfolio',aEduSchool:'示例理工大学',aEduDegree:'B',aEduMajor:'计算机科学与技术',aEduStart:'2017-09',aEduEnd:'2021-06'},
 'dynamic.html':{bFirst:'Zhixing',bLast:'Lin',bEmail:'lin.zhixing@example.com',bEdu1School:'示例理工大学',bEdu1Degree:'B',bEdu1Major:'计算机科学与技术',bEdu1Start:'2017-09',bEdu1End:'2021-06',bEdu2School:'虚构信息学院',bEdu2Degree:'M',bEdu2Major:'软件工程',bEdu2Start:'2021-09',bEdu2End:'2024-06',bCompany:'示例科技有限公司',bTitle:'软件工程师',bStart:'2024-07',bEnd:'2026-09',bDescription:'仅为测试：维护网页应用和自动化检查。'},
 'wizard.html':{cName:'林知行',cEmail:'lin.zhixing@example.com',cPhone:'19900000000',cBachelor:true,cMaster:false,cJS:true,cSQL:true,cGo:false,cInternCompany:'示例实验室',cInternTitle:'开发实习生',cInternStart:'2020-07',cInternEnd:'2020-09',cInternDesc:'仅为测试：编写数据整理工具。',cProject:'虚构求职工具',cRole:'开发负责人',cProjectStart:'2023-01',cProjectEnd:'2023-06',cProjectDesc:'仅为测试：设计本机资料管理原型。',cCertificate:'示例软件证书',cIssuer:'虚构培训中心',cCertDate:'2023-06-18'}
};
const protectedFields={
 'guards.html':{gEmergencyName:'',gEmergencyEmail:'',gDisabledPhone:'',gDegree:false,gHiddenSchool:'',gSQL:true,gJS:false,gRace:'保留手工修改'},
 'basic.html':{aCity:'上海',aCaptcha:'',aConsent:false,aIdentity:''},
 'dynamic.html':{bEmergency:''},
 'wizard.html':{cStart:'',cCode:'',cCustom:'',cConsent:false}
};
const omissionReasons={gEmergencyName:'紧急联系人姓名不使用申请人资料',gEmergencyEmail:'紧急联系人邮箱不使用申请人资料',gDisabledPhone:'继承fieldset禁用状态',gDegree:'学历摘要不当作第一段教育经历',gHiddenSchool:'折叠记录不填，其他记录不移位',gSQL:'禁用的已选项目必须保留',gJS:'含禁用成员的勾选组整组跳过',gRace:'预览后人工编辑不覆盖','aCity':'已有内容默认保留','aCaptcha':'验证码人工处理','aConsent':'同意条款人工处理','aIdentity':'敏感字段人工处理','bEmergency':'不将申请人资料用于紧急联系人','cStart':'档案只有年月，不能补出具体日','cCode':'编号含义不明','cCustom':'自定义组合控件不支持','cConsent':'声明由本人阅读确认'};
function valueOf(id){const e=document.getElementById(id);if(!e)return null;if(e.tagName==='SELECT'&&e.multiple)return Array.from(e.selectedOptions).map(o=>o.value);return ['radio','checkbox'].includes(e.type)?e.checked:e.value;}
$('#check-result').addEventListener('click',()=>{
 const expected=expectations[page],items=Object.entries(expected).map(([id,expectedValue])=>{const actual=valueOf(id),correct=JSON.stringify(actual)===JSON.stringify(expectedValue),missing=actual===null||actual===''||actual===false&&expectedValue===true;return {id,correct,status:correct?'correct':missing?'missing':'wrong'};});
 const populated=items.filter(i=>!['cMaster','cGo'].includes(i.id));
 const correct=populated.filter(i=>i.correct).length,wrong=populated.filter(i=>i.status==='wrong').length;
 const safeguards=Object.entries(protectedFields[page]).map(([id,expectedValue])=>({id,unchanged:valueOf(id)===expectedValue,reason:omissionReasons[id]}));
 const totalMs=assistedStart===null?null:Math.round(performance.now()-assistedStart),m=manual();
 lastReport={version:'0.4.0',profileSource:$('#use-extension').checked?'extension-user-selected':loadedFromVault?'imported-encrypted-profile':'built-in-fiction',profileSourceVerifiedByPage:!$('#use-extension').checked,profileSourceNote:$('#use-extension').checked?'网页无法读取扩展来源，请在扩展预览核对；此处仅记录本人选择的验收模式。':'网页演练使用本页已选择的资料。',page,recordedAt:new Date().toISOString(),fictionalOnly:true,mode:$('#use-extension').checked?'extension-manual':'same-engine-browser-prototype',expectedItems:populated.length,correctItems:correct,wrongItems:wrong,unfilledItems:populated.filter(i=>i.status==='missing').map(i=>i.id),filledAccuracy:correct+wrong?correct/(correct+wrong):null,coverage:correct/populated.length,allCheckedItems:items,safeguards,protectedFieldsUnchanged:safeguards.every(i=>i.unchanged),submissions,engineWriteMs:engineReports.reduce((n,r)=>n+r.durationMs,0),assistedObservedMs:totalMs,manualBaselineMs:m?.durationMs??null,timeSavedPercent:m&&totalMs!==null?Math.round((1-totalMs/m.durationMs)*1000)/10:null,timingNote:'辅助总耗时包含核对、切换及操作工具等待。没有人工基线时不估算节时；扩展模式的耗时请人工计时。'};
 $('#benchmark-summary').textContent='正确 '+correct+' / '+populated.length+'；错填 '+wrong+'；未填 '+lastReport.unfilledItems.length+'；保护项 '+(lastReport.protectedFieldsUnchanged?'均保留':'有变化！')+'；提交 '+submissions+' 次。';
 $('#benchmark-report').textContent=JSON.stringify(lastReport,null,2);$('#download-report').disabled=false;
});
$('#download-report').addEventListener('click',()=>lastReport&&downloadJson(lastReport,'填表验收-'+page.replace('.html','')+'.json'));
