import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const testFiles = (await readdir(resolve(root,'tests'))).filter(f=>f.endsWith('.test.mjs')).map(f=>`tests/${f}`);
const report={ checkedAt:new Date().toISOString(), node:process.version, steps:[] };
for(const [name,args] of [
 ['页面脚本语法',['scripts/syntax-check.mjs']],
 ['规则测试',['--test',...testFiles]],
 ['真实数据校验',['scripts/validate.mjs']],
 ['本机静态构建',['scripts/build.mjs']],
 ['浏览器扩展构建',['scripts/build-extension.mjs']]
]) {
 const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:60000});
 const step={name,passed:r.status===0,exitCode:r.status,output:(r.stdout||'')+(r.stderr||''),error:r.error?.message||null};
 report.steps.push(step);console.log(`${step.passed?'通过':'失败'}：${name}\n${step.output}`);
 if(!step.passed)break;
}
const data=JSON.parse(await readFile(resolve(root,'public/data/jobs.json'),'utf8'));
report.snapshot={generatedAt:data.generatedAt,records:data.jobs.length,sourceRuns:data.sourceRuns};
report.passed=report.steps.length===5&&report.steps.every(s=>s.passed);
await mkdir(resolve(root,'.local'),{recursive:true});
await writeFile(resolve(root,'.local/check-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(report.passed?'基础检查全部通过。完整闭环仍须执行实际扩展验收；请查看 docs/beta/验收报告.html。':'存在失败项，请保留 .local/check-report.json 供排查。');
process.exitCode=report.passed?0:1;
