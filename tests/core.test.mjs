import test from 'node:test';
import assert from 'node:assert/strict';
import { salaryMatches, effectiveStatus, matchesJob, validateBackup, safeUrl, matchingSalaryRanges } from '../public/core.mjs';

// Synthetic unit inputs are isolated here and never copied to public/data.
const now = Date.parse('2026-10-10T04:00:00Z');
const job = { id:'test:1',title:'Software Engineer', company:'Example',companyType:'外企',locations:['Beijing, China'],regionScopes:['中国大陆'],education:[],majors:[],graduationYears:[],experience:null,recruitmentType:null,workSchedule:null,sourceStatus:'listed',lastVerifiedAt:'2026-10-10T00:00:00Z',publishedAt:'2026-10-01T00:00:00Z',salary:{status:'undisclosed',ranges:[]},systemTags:[] };
const pay = { status:'disclosed',months:13,ranges:[{min:10000,max:20000,currency:'CNY',period:'month',kind:'salary'},{min:100000,max:120000,currency:'USD',period:'year',kind:'salary'}] };
test('salary compares overlap only inside matching currency and period',()=>{
 assert.equal(salaryMatches(pay,{salaryMin:15000,salaryMax:25000,currency:'CNY',period:'month'}),true);
 assert.equal(salaryMatches(pay,{salaryMin:30000,currency:'CNY',period:'month'}),false);
 assert.equal(salaryMatches(pay,{salaryMin:10000,currency:'USD',period:'month'}),false);
 assert.equal(salaryMatches(pay,{salaryMin:10000}),false);
});
test('salary floor, pay months, and absence are not treated as zero',()=>{
 assert.equal(salaryMatches(pay,{salaryMin:15000,currency:'CNY',period:'month',salaryMode:'floor'}),false);
 assert.equal(salaryMatches(pay,{payMonths:13}),true);
 assert.equal(salaryMatches(pay,{payMonths:14}),false);
 assert.equal(salaryMatches({status:'undisclosed',ranges:[]},{salaryMin:0,currency:'CNY',period:'month'}),false);
 assert.equal(salaryMatches({status:'negotiable',ranges:[]},{salaryDisclosure:'undisclosed'}),false);
});
test('salary open bounds must not fabricate guaranteed pay or mix OTE',()=>{
 const s={status:'disclosed',ranges:[{min:null,max:20000,currency:'CNY',period:'month',kind:'salary'}]};
 assert.equal(salaryMatches(s,{salaryMin:10000,currency:'CNY',period:'month'}),true);
 assert.equal(salaryMatches(s,{salaryMin:10000,currency:'CNY',period:'month',salaryMode:'floor'}),false);
 const ote={status:'disclosed',ranges:[{min:10000,max:20000,currency:'CNY',period:'month',kind:'ote'}]};
 assert.equal(salaryMatches(ote,{salaryMin:15000,currency:'CNY',period:'month'}),false);
 assert.equal(salaryMatches(ote,{salaryMin:15000,currency:'CNY',period:'month',salaryKind:'ote'}),true);
});
test('unknown pay period cannot be numerically compared',()=>{
 const salary={status:'disclosed',ranges:[{min:100,max:200,currency:'USD',period:'unknown',kind:'salary'}]};
 assert.equal(salaryMatches(salary,{salaryMin:150,currency:'USD',period:'unknown'}),false);
 assert.equal(salaryMatches(salary,{period:'unknown'}),true);
});
test('multi-location salary filtering requires a matching declared tier location',()=>{
 const j={...job,locations:['Singapore','Philippines'],regionScopes:['海外'],salary:{status:'disclosed',ranges:[{min:80000,max:96000,currency:'SGD',period:'year',kind:'salary',label:'Singapore'},{min:480000,max:900000,currency:'PHP',period:'year',kind:'salary',label:'Philippines'}]}};
 assert.equal(matchesJob(j,{location:'Philippines',currency:'SGD',period:'year',salaryMin:80000},{},now),false);
 assert.equal(matchesJob(j,{location:'新加坡',currency:'SGD',period:'year',salaryMin:80000},{},now),true);
 assert.equal(matchingSalaryRanges(j,{currency:'PHP',period:'year'})[0].currency,'PHP');
 const ambiguous={...j,salary:{...j.salary,ranges:[{...j.salary.ranges[0],label:null}]}};
 assert.equal(matchesJob(ambiguous,{location:'Singapore',currency:'SGD',period:'year'},{},now),false);
});
test('expiry wins, stale snapshots downgrade and notices are not invented open',()=>{
 assert.equal(effectiveStatus(job,now),'listed');
 assert.equal(effectiveStatus({...job,deadline:'2026-10-09T23:59:59+08:00'},now),'expired');
 assert.equal(effectiveStatus({...job,lastVerifiedAt:'2026-10-05T00:00:00Z'},now),'stale');
 assert.equal(effectiveStatus({...job,sourceStatus:'notice'},now),'unknown');
 assert.equal(effectiveStatus({...job,sourceStatus:'notice',opensAt:'2026-10-01T00:00:00+08:00',deadline:'2026-10-15T23:59:59+08:00'},now),'notice_open');
 assert.equal(effectiveStatus({...job,opensAt:'2026-10-15T00:00:00+08:00'},now),'not_started');
 assert.equal(effectiveStatus({...job,lastVerifiedAt:'2099-01-01T00:00:00Z'},now),'unknown');
});
test('multi criteria AND, group OR, unknown is not unlimited, Chinese search alias',()=>{
 assert.equal(matchesJob(job,{q:'工程师 北京',companyTypes:['国企','外企'],regionScopes:['中国大陆']},{},now),true);
 assert.equal(matchesJob(job,{education:['本科']},{},now),false);
 assert.equal(matchesJob(job,{education:['未披露']},{},now),true);
 assert.equal(matchesJob(job,{graduationYear:'2027'},{},now),false);
 assert.equal(matchesJob(job,{companyTypes:['国企']},{},now),false);
 assert.equal(matchesJob(job,{deadlineBefore:'2026-10-15'},{},now),false);
 assert.equal(matchesJob(job,{publishedAfter:'2026-10-02'},{},now),false);
 assert.equal(matchesJob(job,{onlySaved:true},{'test:1':{saved:true}},now),true);
});
test('backups are versioned, bounded and allowlisted; dangerous URLs rejected',()=>{
 const b=validateBackup({schemaVersion:1,kind:'job-workbench-private',records:{'test:1':{saved:true,stage:'已投递',tags:['关注'],note:'note'}},savedSearches:[]});
 assert.equal(b.records['test:1'].stage,'已投递');
 assert.throws(()=>validateBackup({schemaVersion:2,kind:'job-workbench-private'}));
 assert.throws(()=>validateBackup(JSON.parse('{"schemaVersion":1,"kind":"job-workbench-private","records":{"__proto__":{}},"savedSearches":[]}')));
 assert.throws(()=>validateBackup({schemaVersion:1,kind:'job-workbench-private',records:{'test:1':{tags:['x'.repeat(81)]}},savedSearches:[]}));
 assert.equal(safeUrl('javascript:alert(1)'),null);
 assert.equal(safeUrl('https://example.com/path'),'https://example.com/path');
});
