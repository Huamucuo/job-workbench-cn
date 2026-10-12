import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptAshby, adaptGreenhouse, mergeSourceSnapshot } from '../scripts/adapters.mjs';
const source={id:'unit',company:'Test fixture',companyType:'外企',endpoint:'https://example.com/api'};
const checkedAt='2026-10-10T00:00:00Z';
test('Greenhouse preserves first_published; no inference from updated date or title',()=>{
 const job=adaptGreenhouse({id:1,title:'Senior engineer',absolute_url:'https://example.com/job/1',location:{name:'Hybrid'},updated_at:'2026-10-09T00:00:00Z',first_published:null,metadata:[{name:'Job Posting Location',value:['Beijing, China']}],application_deadline:'2026-10-20T12:00:00Z'},source,checkedAt);
 assert.equal(job.publishedAt,null);assert.equal(job.experience,null);assert.equal(job.deadline,'2026-10-20T12:00:00Z');assert.deepEqual(job.regionScopes,['中国大陆']);assert.equal(job.workSchedule,null);
});
test('Ashby preserves salary tiers and does not expose hidden or mix commission',()=>{
 const raw={id:'a',title:'Role',jobUrl:'https://example.com/job',applyUrl:'https://example.com/apply',location:'Europe',isListed:true,isRemote:true,compensation:{compensationTiers:[{title:'EU',components:[{compensationType:'Salary',currencyCode:'EUR',interval:'1 YEAR',minValue:80000,maxValue:100000},{compensationType:'Commission',currencyCode:'EUR',interval:'1 YEAR',minValue:5000,maxValue:15000}]}]}};
 const j=adaptAshby(raw,source,checkedAt);assert.equal(j.salary.ranges.length,1);assert.equal(j.salary.ranges[0].period,'year');assert.equal(j.salary.months,null);assert.equal(j.workplaceType,'远程');
 const hidden=adaptAshby({...raw,shouldDisplayCompensationOnJobPostings:false},source,checkedAt);assert.equal(hidden.salary.ranges.length,0);
});
test('unlisted Ashby records are excluded entirely, not searchable as unknown',()=>{
 assert.equal(adaptAshby({id:'private',title:'Unlisted',isListed:false},source,checkedAt),null);
 assert.equal(adaptAshby({id:'missing',title:'No visibility flag'},source,checkedAt),null);
});
test('failed updates preserve success time and success disappearance is recorded',()=>{
 const previous=[{id:'unit:1',sourceId:'unit',lastVerifiedAt:'2026-10-01T00:00:00Z',sourceStatus:'listed'}];
 const fail=mergeSourceSnapshot(previous,[],{sourceId:'unit',status:'error',checkedAt});
 assert.equal(fail[0].lastVerifiedAt,previous[0].lastVerifiedAt);assert.equal(fail[0].sourceStatus,'listed');
 const result=mergeSourceSnapshot(previous,[{id:'unit:2',sourceId:'unit',sourceStatus:'listed',lastVerifiedAt:checkedAt}],{sourceId:'unit',status:'ok',checkedAt});
 assert.equal(result.find(j=>j.id==='unit:1').sourceStatus,'removed');
 assert.throws(()=>mergeSourceSnapshot(previous,[],{sourceId:'unit',status:'ok',checkedAt}));
});
