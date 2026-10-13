export {installationState} from '../public/autofill/install-state.mjs';
export function assertDownloadContents(entries){
 for(const name of Object.keys(entries)){
  if(name.includes('\\')||name.startsWith('/')||name.includes(':')||name.split('/').some(p=>p==='..'||p==='.'))throw new Error('禁止的发行路径：'+name);
  if(/(?:^|\/)(?:\.local|\.git|private|BrowserProfile|User Data|node_modules)(?:\/|$)|\.private\.json$/i.test(name))throw new Error('禁止私人文件进入下载包：'+name);
 }
 const dataset=entries['public/data/jobs.json'];if(!dataset)throw new Error('缺少公开包空岗位快照');
 const data=JSON.parse(Buffer.from(dataset).toString('utf8'));
 if(!Array.isArray(data.jobs)||data.jobs.length)throw new Error('公开下载包禁止附带招聘岗位快照');
 if(!Array.isArray(data.sourceRuns)||data.sourceRuns.length)throw new Error('公开下载包禁止附带采集记录');
 return {jobsIncluded:0,sourceRunsIncluded:0,privatePathsAbsent:true};
}
