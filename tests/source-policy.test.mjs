import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyCachedCapture,retainRegisteredJobs} from '../scripts/source-policy.mjs';
test('cache timestamp is bound to a captured response hash, not filesystem mtime',()=>{
 const raw='{"jobs":[]}',source={id:'a',endpoint:'https://example.com/api'},capturedAt='2026-10-01T00:00:00Z';
 const capture={sourceId:'a',endpoint:source.endpoint,capturedAt,sha256:createHash('sha256').update(raw).digest('hex')};
 assert.equal(verifyCachedCapture(raw,source,capture),capturedAt);
 assert.throws(()=>verifyCachedCapture(raw+' ',source,capture));
 assert.throws(()=>verifyCachedCapture(raw,source,null));
 assert.throws(()=>verifyCachedCapture(raw,source,{...capture,capturedAt:'2099-01-01T00:00:00Z'}));
});
test('removed sources are dropped without blocking valid sources or mutating input',()=>{
 const previous=[{id:'a:1',sourceId:'a'},{id:'b:1',sourceId:'b'}];
 const result=retainRegisteredJobs(previous,[{id:'a'}]);
 assert.deepEqual(result,[previous[0]]);assert.equal(previous.length,2);
});
