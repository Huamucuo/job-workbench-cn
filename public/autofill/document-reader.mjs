const MAX_FILE=10*1024*1024,MAX_TEXT=60000,MAX_PAGES=30;
const abort=signal=>{if(signal?.aborted)throw new DOMException('已取消读取','AbortError');};
export async function readResumeFile(file,{signal}={}){
 if(!/\.(docx|pdf)$/i.test(file.name))throw new Error('仅支持 DOCX 和可提取文字的 PDF；旧版 DOC 请先另存为 DOCX');
 if(file.size>MAX_FILE)throw new Error('单份文件不能超过10MB');if(!file.size)throw new Error('文件为空');abort(signal);
 const data=new Uint8Array(await file.arrayBuffer());abort(signal);const id=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const type=/\.pdf$/i.test(file.name)?'pdf':'docx';
 const result=type==='pdf'?await readPDF(data,signal):await readDOCX(data,signal);abort(signal);
 const text=result.lines.map(l=>l.text).join('\n');if(text.length>MAX_TEXT)throw new Error('文字超过6万字限制，请拆分文件');if(text.trim().length<10)throw new Error('没有足够的可提取文字。扫描件/图片简历暂不支持 OCR，请使用文字版 PDF 或 DOCX');
 return {id,name:file.name.slice(0,240),type,text,...result};
}
async function readDOCX(data,signal){
 if(data[0]!==80||data[1]!==75)throw new Error('这不是有效的 DOCX 文件');
 const {Unzip,UnzipInflate,strFromU8}=await import('./vendor/fflate.mjs');
 const files=new Map();let actual=0,count=0,error=null;const start=performance.now();
 const unzip=new Unzip(file=>{
  if(++count>2000){error=new Error('DOCX 内部文件过多');return;}
  if(!/^word\/(document|header\d+|footer\d+)\.xml$/.test(file.name))return;
  if(files.has(file.name)){error=new Error('DOCX 含重复文档片段');return;}
  if(file.originalSize>4*1024*1024){error=new Error('DOCX 解压后的文字片段过大');return;}
  const chunks=[];files.set(file.name,chunks);file.ondata=(err,chunk)=>{if(err){error=err;return;}actual+=chunk?.length||0;if(actual>8*1024*1024){file.terminate();error=new Error('DOCX 解压文字超过8MB安全限制');return;}if(chunk?.length)chunks.push(chunk);};file.start();
 });unzip.register(UnzipInflate);
 for(let i=0;i<data.length;i+=2048){abort(signal);if(performance.now()-start>25000)throw new Error('读取超时，请使用更小的文件');unzip.push(data.subarray(i,i+2048),i+2048>=data.length);if(error)throw error;if(i%131072===0)await new Promise(r=>setTimeout(r,0));}
 if(!files.has('word/document.xml'))throw new Error('DOCX 缺少正文');
 const lines=[],warnings=[];let index=0;
 for(const[name,chunks]of [...files].sort((a,b)=>a[0]==='word/document.xml'?-1:b[0]==='word/document.xml'?1:a[0].localeCompare(b[0]))){
  const total=chunks.reduce((n,c)=>n+c.length,0),bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const xml=strFromU8(bytes);
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('DOCX 含不支持的实体声明');const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('DOCX 正文格式损坏');
  // Read text nodes only. Relationships, images, macros and external links are never loaded.
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const textOf=node=>{if(node.namespaceURI===W&&node.localName==='del')return '';if(node.namespaceURI===W&&node.localName==='t')return node.textContent;if(node.namespaceURI===W&&['tab','br','cr'].includes(node.localName))return node.localName==='tab'?' | ':'\n';return [...node.childNodes].map(textOf).join('');};
  const push=text=>{for(const t of text.split('\n')){if(t.length>3000)throw new Error('存在超过3000字的单段，请在原文拆分段落');lines.push({text:t.trim(),line:++index,page:1});}};
  const walk=node=>{if(node.namespaceURI===W&&node.localName==='tr'){const cells=[...node.childNodes].filter(n=>n.namespaceURI===W&&n.localName==='tc');push(cells.map(n=>[...n.getElementsByTagNameNS(W,'p')].map(textOf).join(' / ')).join(' | '));return;}if(node.namespaceURI===W&&node.localName==='p'){push(textOf(node));return;}for(const child of node.childNodes)walk(child);};walk(doc.documentElement);
  if(name!=='word/document.xml')warnings.push('页眉/页脚文字附在正文之后；DOCX 来源位置使用段落号，不推测页码');
  if(doc.getElementsByTagNameNS(W,'txbxContent').length)warnings.push('含文本框，复杂排版的阅读顺序需要人工核对');
 }
 if(lines.length>6000)throw new Error('段落数量过多');return {lines,warnings};
}
async function readPDF(data,signal){
 if(new TextDecoder().decode(data.subarray(0,5))!=='%PDF-')throw new Error('这不是有效的 PDF 文件');
 const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
 const task=pdfjs.getDocument({data,isEvalSupported:false,useWasm:false,disableFontFace:true,useSystemFonts:false,isOffscreenCanvasSupported:false,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,stopAtErrors:true});
 let timedOut=false;const timer=setTimeout(()=>{timedOut=true;task.destroy();},30000),cancel=()=>task.destroy();signal?.addEventListener('abort',cancel,{once:true});const lines=[],warnings=[];let length=0;
 try{const pdf=await task.promise;if(pdf.numPages>MAX_PAGES)throw new Error('PDF 超过30页，请只保留简历页');let index=0;
  for(let n=1;n<=pdf.numPages;n++){abort(signal);const page=await pdf.getPage(n),content=await page.getTextContent(),items=content.items.filter(i=>typeof i.str==='string'&&i.str.trim());const rows=[];
   for(const item of items){const y=item.transform[5];let row=rows.find(r=>Math.abs(r.y-y)<Math.max(2,Math.abs(item.height)*0.2));if(!row){row={y,items:[]};rows.push(row);}row.items.push(item);}
   rows.sort((a,b)=>b.y-a.y);let columns=false;
   for(const row of rows){row.items.sort((a,b)=>a.transform[4]-b.transform[4]);let text='',end=null;
    for(const item of row.items){const gap=end===null?0:item.transform[4]-end;if(gap>70)columns=true;const sep=!text?'':gap>18?' | ':gap>2?' ':'';text+=sep+item.str;end=item.transform[4]+item.width;}
    text=text.trim();if(text.length>3000)throw new Error('PDF 单行文字过长，排版可能无法可靠还原');length+=text.length;if(length>MAX_TEXT)throw new Error('PDF 文字超过6万字限制');if(text)lines.push({text,line:++index,page:n});
   }
   if(columns)warnings.push('第'+n+'页存在较大列间距，可能是多栏排版；请逐项核对阅读顺序');if(!items.length)warnings.push('第'+n+'页没有可提取文字，图片内容未识别');page.cleanup();
  }return {lines,warnings};
 }catch(e){abort(signal);if(timedOut)throw new Error('PDF 读取超时，请使用更小的文字版文件');if(e.name==='PasswordException')throw new Error('PDF 已加密。请先在本机另存为可读取的版本');throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);await task.destroy();}
}
