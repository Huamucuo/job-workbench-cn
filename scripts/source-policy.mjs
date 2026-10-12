import {createHash} from 'node:crypto';
export function verifyCachedCapture(raw,source,capture) {
 if(!capture||capture.sourceId!==source.id||capture.endpoint!==source.endpoint||!Number.isFinite(Date.parse(capture.capturedAt))||Date.parse(capture.capturedAt)>Date.now()+300000) throw new Error('缓存没有有效的真实采集凭据；不能用文件修改时间作核验时间');
 if(createHash('sha256').update(raw).digest('hex')!==capture.sha256) throw new Error('缓存内容与采集凭据不一致，拒绝导入');
 return capture.capturedAt;
}
export function retainRegisteredJobs(jobs,sources){const ids=new Set(sources.map(s=>s.id));return jobs.filter(j=>ids.has(j.sourceId));}
