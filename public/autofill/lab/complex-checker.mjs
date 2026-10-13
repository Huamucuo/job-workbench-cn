// The expected literals are independent of the rule engine and fixture renderer.
export const MAIN_EXPECTED=Object.freeze({name:'林知行',email:'lin.zhixing@example.com',city:'hz',gender:'f',school1:'示例理工大学',degree1:'b',academicDegree1:'工学学士',start1:'2017-09',language:'英语',languageLevel:'熟练',languageCertificate:'虚构英语证书',introduction:'仅为测试：擅长整理资料和维护本机工具。'});
export const PROTECTED_KEYS=Object.freeze(['health','religion','union','hukou','family','emergency','identity','consent','highest','fullBirth','unknown']);
const ACTIVATION_MODES=Object.freeze({'submit-target':'city','radio-submit-target':'gender','ancestor-option':'city','ancestor-trigger':'city','ancestor-radio':'gender'});
export function checkComplex(snapshot,{mode=snapshot.mode}={}){
 const expected=ACTIVATION_MODES[mode]?{}:{...MAIN_EXPECTED};
 if(mode==='async')Object.assign(expected,{school2:'虚构信息学院',degree2:'m',academicDegree2:'工学硕士',start2:'2021-09'});
 if(mode==='occupied'){expected.name='本人已有姓名';expected.city='sh';}
 if(mode==='labels')delete expected.name;
 if(mode==='duplicates'||mode==='timeout')delete expected.city;
 if(mode==='rollback'){delete expected.name;delete expected.gender;}
 const results=Object.entries(expected).map(([key,want])=>({key,want,dom:snapshot.dom[key],model:snapshot.model[key],saved:snapshot.saved[key],passed:snapshot.dom[key]===want&&snapshot.model[key]===want&&snapshot.saved[key]===want}));
 const protectedResults=PROTECTED_KEYS.map(key=>({key,passed:[snapshot.dom[key],snapshot.model[key],snapshot.saved[key]].every(v=>v===''||v===false||v===undefined)}));
 const target=ACTIVATION_MODES[mode];
 const guards={protectedUnchanged:protectedResults.every(r=>r.passed),internalSearchUntouched:snapshot.internalInputEvents===0,submissions:snapshot.submissions,ambiguousCityUntouched:!['duplicates','timeout'].includes(mode)||snapshot.dom.city===''&&snapshot.model.city==='',rolledBackNotReported:mode!=='rollback'||snapshot.dom.name===''&&snapshot.model.name===''&&snapshot.dom.gender===''&&snapshot.model.gender==='',defaultActivationProtected:!target||[snapshot.dom[target],snapshot.model[target],snapshot.saved[target]].every(v=>v==='')&&Object.values(snapshot.openClicks).every(n=>n===0)&&Object.values(snapshot.optionClicks).every(n=>n===0)};
 return {version:'0.4.0',mode,fictionalOnly:true,verification:'independent-DOM-model-save-literals',results,protectedResults,guards,passed:results.every(r=>r.passed)&&guards.protectedUnchanged&&guards.internalSearchUntouched&&guards.submissions===0&&guards.ambiguousCityUntouched&&guards.rolledBackNotReported&&guards.defaultActivationProtected,manualBaselineMs:null,timingNote:'模拟自动化不等于真人完整填写计时。'};
}
