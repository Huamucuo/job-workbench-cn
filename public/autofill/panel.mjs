import './rules.js';
import {profileFields,materializeProfile} from './profile.mjs';
import {storage,MEMORY_KEY} from './vault.mjs';
import {el,message} from './ui.mjs';
const R=globalThis.JobAutofillRules;
const names={ready:'可填写',occupied:'已有内容',missing:'暂不填写',blocked:'人工处理',unsupported:'暂不支持',unmapped:'待对应',choice:'请选择教育记录',filled:'已稳定回读',failed:'未保留填写',skipped:'已跳过',pending:'等待或重试'};
export async function mountPanel(container,{transport,getProfile,onResult=()=>{},continuous=false}){
 container.dataset.autofillUi='true';container.classList.add('af-panel');
 let snapshot=null,profileSnapshot=null,rows=[],memories=[],last=null,processing=false,epoch=0,destroyed=false;
 container.dataset.scanReady='false';
 const status=el('p',{'role':'status','aria-live':'polite'}),destination=el('p',{class:'af-target',text:'先识别当前页面，再核对资料。'});
 const preview=el('div',{class:'af-preview'}),results=el('div',{class:'af-results'}),count=el('strong');
 const confirm=el('input',{type:'checkbox',id:'af-confirm'}),remember=el('input',{type:'checkbox',id:'af-remember',checked:true});
 const fill=el('button',{type:'button',class:'af-button af-primary',text:continuous?'核对并填写本页':'填写已勾选字段',disabled:true});
 const scan=el('button',{type:'button',class:'af-button',text:continuous?'重新检测':'识别当前页'});
 const prepare=el('button',{type:'button',class:'af-button',text:'准备经历分组'});
 const forget=el('button',{type:'button',class:'af-button',text:'忘记此页对应关系'});
 container.replaceChildren(el('h2',{text:continuous?'本页填写预览':'填写助手'}),el('p',{class:'af-muted',text:continuous?'已自动检测。核对所选资料后点击填写；网站可能即时读取已填内容。下一步和提交仍由你操作。':'先核对后填写。不会点击下一步、提交申请或验证码。'}),el('div',{class:'af-actions'},[scan,prepare]),status,el('label',{class:'af-check'},[remember,'记住我手工更正的字段对应关系（只保存对应关系）']),preview,el('div',{class:'af-confirm'},[destination,count,...(continuous?[]:[el('label',{class:'af-check'},[confirm,'我已核对目标网站及所选资料，允许填入页面。网站可能即时读取已填内容。'])]),fill]),results,forget);
 function refresh(reset=true){if(reset)confirm.checked=false;const n=rows.filter(x=>x.selected).length;count.textContent='本次选择 '+n+' 项 / 识别 '+rows.length+' 项';fill.disabled=processing||(!continuous&&!confirm.checked)||!n||!snapshot||destroyed;}
 function busy(value){processing=value;if(value)container.dataset.scanReady='false';scan.disabled=value;prepare.disabled=value;forget.disabled=value;preview.inert=value;refresh(false);}
 async function loadMemories(){const v=await storage.get(MEMORY_KEY);memories=Array.isArray(v)?v.filter(m=>m&&typeof m.scope==='string'&&m.scope.length<2000&&typeof m.signature==='string'&&m.signature.length<5000&&R.validPath.test(m.path)).slice(-1000):[];}
 function draw(){
  const catalog=profileFields(profileSnapshot);
  preview.replaceChildren();
  for(const row of rows){
   const protectedField=!!R.blocked(row)||row.type==='custom'||['blocked','unsupported'].includes(row.status);
   const select=el('select',{'aria-label':row.label+' 对应档案字段',disabled:protectedField});
   select.append(el('option',{value:'',text:'不填写 / 手工选择对应关系'}));
   for(const field of catalog)if(!row.choiceKey||new RegExp('^education\\.\\d+\\.'+row.choiceKey+'$').test(field.path))select.append(el('option',{value:field.path,text:field.label}));
   select.value=row.path||'';
   const check=el('input',{type:'checkbox',checked:row.selected,disabled:!['ready','occupied'].includes(row.status),'aria-label':'填写 '+row.label});
   const value=el('p',{class:'af-value',text:row.path?(Array.isArray(row.raw)?row.raw.join('、'):row.raw||'（档案为空）'):'—'});
   const reason=el('p',{class:'af-muted',text:(names[row.status]||row.status)+' · '+row.reason});
   const overwrite=el('input',{type:'checkbox','aria-label':'允许覆盖 '+row.label,disabled:!row.hasValue});
   check.addEventListener('change',()=>{row.selected=check.checked;refresh();});
   overwrite.addEventListener('change',()=>{row.overwrite=overwrite.checked;check.disabled=row.hasValue&&!row.overwrite||!['ready','occupied'].includes(row.status);if(check.disabled){check.checked=false;row.selected=false;}refresh();});
   if(row.hasValue)check.disabled=true;
   select.addEventListener('change',async()=>{
    if(protectedField||R.blocked(row)){row.selected=false;select.value='';check.checked=false;refresh();return;}
    row.path=select.value||null;
    if(row.choiceKey&&row.path&&!new RegExp('^education\\.\\d+\\.'+row.choiceKey+'$').test(row.path)){row.path=null;select.value='';}
    row.raw=row.path?R.valueAt(profileSnapshot,row.path):undefined;
    const cv=R.previewValue(row.raw,row,row.path,snapshot?.fields.find(p=>p.id===row.cascade?.parentId)?.hasValue===true);
    row.value=cv.value;row.deferred=cv.deferred;row.choice=cv.choice;row.status=row.path&&cv.ok?(row.hasValue?'occupied':'ready'):row.choiceKey?'choice':'unmapped';
    row.reason=row.path?(cv.ok?cv.reason||'你手工指定的对应关系，请核对':cv.reason):'本次保留人工填写';
    row.selected=!!row.path&&cv.ok&&(!row.hasValue||row.overwrite);
    check.disabled=!row.path||!cv.ok||(row.hasValue&&!row.overwrite);check.checked=row.selected;
    value.textContent=Array.isArray(row.raw)?row.raw.join('、'):row.raw||'—';reason.textContent=(names[row.status]||row.status)+' · '+row.reason;
    refresh();
    if(remember.checked&&snapshot&&!row.choiceKey){
     const sig=R.signature(row);memories=memories.filter(m=>!(m.scope===snapshot.scope&&m.signature===sig));
     if(row.path)memories.push({scope:snapshot.scope,signature:sig,path:row.path});
     await storage.set(MEMORY_KEY,memories.slice(-1000));
     message(status,row.path?'已在本机记住此字段对应关系；更换网站或路径不会套用。':'已移除此字段的记忆。');
    }
   });
   preview.append(el('article',{class:'af-row'},[el('label',{class:'af-check'},[check,el('strong',{text:row.label})]),el('p',{class:'af-muted',text:(row.context?row.context+' · ':'')+row.type}),select,value,reason,...(row.hasValue?[el('label',{class:'af-check'},[overwrite,'我确认覆盖这一项原有内容'])]:[])]));
  }
  refresh();
 }
 async function doScan(){
  if(destroyed)return;
  const ticket=++epoch;container.dataset.scanReady='false';
  busy(true);results.replaceChildren();
  try{
   if(!getProfile())throw new Error('请先解锁求职档案');
   profileSnapshot=materializeProfile(getProfile());
   await loadMemories();const next=await transport.scan();if(ticket!==epoch||destroyed)return;snapshot=next;
   rows=R.planFields(snapshot.fields,profileSnapshot,memories,snapshot.scope);
   // Duplicate destinations for a record key are ambiguous, never broadcast a record.
   const tally=new Map();for(const r of rows)if(r.path)tally.set(r.path,(tally.get(r.path)||0)+1);
   for(const r of rows)if(r.path&&tally.get(r.path)>1){r.status='unmapped';r.selected=false;r.reason='出现重复对应关系，请逐项指定并核对所属经历';}
   destination.textContent='目标：'+snapshot.url;draw();container.dataset.scanReady='true';
   const unsupported=snapshot.unsupported||{};
   message(status,'识别完成。'+(unsupported.iframes?'发现 '+unsupported.iframes+' 个内嵌页面，本版不进入。':'')+(unsupported.shadowHosts?'发现影子组件，本版不进入。':'')+(continuous?' 页面变化会自动更新预览；已有内容默认保留。':' 预览有效期 2 分钟；页面变化后请重新识别。'));
  }catch(error){if(ticket!==epoch||destroyed)return;snapshot=null;profileSnapshot=null;rows=[];preview.replaceChildren();message(status,error.message,true);}finally{if(ticket===epoch&&!destroyed){busy(false);refresh();}}
 }
 scan.addEventListener('click',doScan);
 prepare.addEventListener('click',async()=>{
  busy(true);
  try{const p=getProfile();if(!p)throw new Error('请先解锁档案');const r=await transport.prepareGroups(Object.fromEntries(['education','internships','work','projects','skills','certificates','languages'].map(k=>[k,(p[k]||[]).length])));await doScan();const issues=[...new Set(r.groups.filter(g=>g.reason).map(g=>g.reason))];message(status,'新增按钮已点击 '+r.clicks+' 次；已等待记录出现并重新识别。'+(issues.length?' '+issues.join('；'):' 请核对记录顺序后填写。'),issues.length>0);}catch(e){message(status,e.message,true);}finally{busy(false);}
 });
 confirm.addEventListener('change',()=>refresh(false));
 fill.addEventListener('click',async()=>{
  if((!continuous&&!confirm.checked)||!snapshot||processing||destroyed)return;
  const ticket=++epoch;container.dataset.scanReady='false';
  busy(true);
  try{
   const items=R.requestItems(rows);
   last=await transport.apply(snapshot.scanId,items);
   if(ticket!==epoch||destroyed){onResult({...last,pageChanged:true});return;}
   const retry=el('button',{type:'button',class:'af-button secondary',text:'重新识别未填写项'});retry.addEventListener('click',doScan);
   results.replaceChildren(el('h3',{text:'本次结果：'+last.filled+' / '+last.attempted+' 项已稳定回读'}),el('p',{text:'未保留 '+(last.failed||0)+' 项；已跳过 '+(last.skipped||0)+' 项；等待或重试 '+(last.pending||0)+' 项。写入耗时 '+(last.durationMs/1000).toFixed(2)+' 秒；助手未主动提交。请核对网站保存结果。'}),...last.results.map(r=>el('p',{text:(r.status==='filled'?'✓ ':r.status==='failed'?'! ':'○ ')+(names[r.status]||r.status)+' · '+r.label+'：'+r.reason})),retry);
   message(status,'请在原网页核对保存结果；未保留或仍在等待的内容可重新识别后重试，已有值仍默认保留。'+(continuous?'下一步会自动准备新预览。':'进入下一步后再次识别。'));
   onResult(last);
  }catch(e){if(ticket===epoch&&!destroyed)message(status,e.message,true);}finally{if(ticket===epoch&&!destroyed){snapshot=null;busy(false);refresh();}}
 });
 forget.addEventListener('click',async()=>{
  if(!snapshot){message(status,'先识别页面，才能确定要忘记哪个网站和路径。');return;}
  memories=memories.filter(m=>m.scope!==snapshot.scope);await storage.set(MEMORY_KEY,memories);await doScan();message(status,'已忘记此页面的字段对应关系。');
 });
 return {scan:doScan,invalidate(reason='页面变化，正在重新检测。'){epoch++;snapshot=null;profileSnapshot=null;rows=[];container.dataset.scanReady='false';preview.replaceChildren();results.replaceChildren();destination.textContent='正在检测当前页面';busy(false);message(status,reason);},isBusy:()=>processing,destroy(){destroyed=true;epoch++;snapshot=null;profileSnapshot=null;rows=[];memories=[];last=null;container.dataset.scanReady='false';container.replaceChildren();},getLastResult:()=>last};
}
