import test from 'node:test';
import assert from 'node:assert/strict';
const policy=await import('../scripts/download-policy.mjs').catch(()=>null);
test('public download refuses real job snapshots and private paths before creating a ZIP',()=>{
 assert(policy,'download policy is not implemented');
 const base={'public/data/jobs.json':Buffer.from(JSON.stringify({jobs:[],sourceRuns:[]})),'extension/manifest.json':Buffer.from('{}')};
 assert.doesNotThrow(()=>policy.assertDownloadContents(base));
 for(const privateName of ['.local/jobs.json','BrowserProfile/Preferences','private/profile.json','档案.private.json'])assert.throws(()=>policy.assertDownloadContents({...base,[privateName]:Buffer.from('{}')}),/私人|禁止/);
 assert.throws(()=>policy.assertDownloadContents({...base,'public/data/jobs.json':Buffer.from(JSON.stringify({jobs:[{id:'should-never-publish'}],sourceRuns:[]}))}),/岗位/);
 assert.throws(()=>policy.assertDownloadContents({...base,'public/data/jobs.json':Buffer.from(JSON.stringify({jobs:[],sourceRuns:[{raw:'not-public'}]}))}),/采集/);
 assert.throws(()=>policy.assertDownloadContents({...base,'../outside.txt':Buffer.from('x')}),/路径/);
});
test('installer compatibility describes old versions instead of claiming ready, without gaining data access',()=>{
 assert(policy,'download policy is not implemented');
 assert.equal(policy.installationState({installed:false},'0.4.2').kind,'missing');
 assert.equal(policy.installationState({installed:true,version:'0.4.1',connected:true},'0.4.2').kind,'update');
 assert.equal(policy.installationState({installed:true,version:'0.4.2',connected:false},'0.4.2').kind,'ready');
 assert.equal(policy.installationState({installed:true,version:'0.4.2',connected:false},'0.4.2').connected,false);
});
