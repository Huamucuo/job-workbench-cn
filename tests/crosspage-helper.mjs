// Independent literals transcribed from the existing DOCX, never from parser/engine output.
export const EXPECTED = Object.freeze({
 contact:{name:'林知行',givenName:'Zhixing',familyName:'Lin',email:'lin.zhixing@example.com',phone:'19900000000',birthDate:'1999-02-03',gender:'男',politicalStatus:'群众',city:'杭州',website:'https://example.com/portfolio'},
 education:[{school:'示例理工大学',degree:'本科',major:'计算机科学与技术',startDate:'2017-09',endDate:'2021-06'},{school:'虚构信息学院',degree:'硕士',major:'软件工程',startDate:'2021-09',endDate:'2024-06'}],
 internships:[{organization:'示例实验室',title:'开发实习生',startDate:'2020-07',endDate:'2020-09',description:'仅为测试：编写数据整理工具。'},{organization:'虚构数据中心',title:'数据实习生',startDate:'2022-07',endDate:'2022-09',description:'仅为测试：整理资料，核对报表。'}],
 work:[{organization:'示例科技有限公司',title:'软件工程师',startDate:'2024-07',endDate:'2026-09',description:'仅为测试：维护网页应用和自动化检查。'}],
 projects:[{name:'虚构求职工具',role:'开发负责人',startDate:'2023-01',endDate:'2023-06',description:'仅为测试：设计本机资料管理原型。'},{name:'示例报表项目',role:'核心开发',startDate:'2023-08',endDate:'2023-12',description:'仅为测试：制作统计图表。'}],
 skills:[{name:'JavaScript',level:'熟练'},{name:'SQL',level:'熟练'}],certificates:[{name:'示例软件证书',issuer:'虚构培训中心',date:'2023-06-18'}]
});
export function flatten(profile=EXPECTED){const values={};for(const [group,data] of Object.entries(profile)){if(Array.isArray(data))data.forEach((r,i)=>Object.entries(r).forEach(([k,v])=>values[`${group}.${i}.${k}`]=v));else Object.entries(data).forEach(([k,v])=>values[`${group}.${k}`]=v);}return values;}
export function checkSnapshot(snapshot,{manual={}}={}){const literals=flatten(),checks=[];for(const [key,dom]of Object.entries(snapshot.dom)){let want=literals[key];if(key==='contact.website')want='https://prefilled.example.invalid/existing';if(key==='contact.province')want=''; // Original DOCX states city only; province must not be guessed.
if(key.startsWith('guard.'))want=key==='guard.consent'?false:key==='guard.upload'?0:'';if(key in manual)want=manual[key];if(want===undefined)continue;checks.push({key,want,dom,model:snapshot.model[key],saved:snapshot.saved[key],pass:dom===want&&snapshot.model[key]===want&&snapshot.saved[key]===want});}return {passed:checks.every(x=>x.pass)&&snapshot.submissions===0,checks,submissions:snapshot.submissions};}
