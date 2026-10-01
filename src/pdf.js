import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
let pdfDocument=null, hash='', renderQueue=Promise.resolve();
const pages=new Map();
export async function openPDF(file) {
  if(!file || file.size>250*1024*1024)throw new Error('PDF는 250MB 이하 파일을 선택해 주세요.');
  await renderQueue;clearPages();if(pdfDocument){await pdfDocument.loadingTask.destroy();pdfDocument=null;}
  const bytes=new Uint8Array(await file.arrayBuffer());
  hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const base=new URL('./vendor/',import.meta.url).href;
  const task=pdfjs.getDocument({data:bytes,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',isEvalSupported:false,enableXfa:false});
  task.onPassword=()=>task.destroy();
  try{pdfDocument=await task.promise;}catch{throw new Error('PDF를 열 수 없습니다. 암호가 없는 정상 PDF인지 확인해 주세요.');}
  return {count:pdfDocument.numPages,hash};
}
export function clearPages(){for(const p of pages.values())URL.revokeObjectURL(p.url);pages.clear();}
export function hasPage(n){return pages.has(n);}
async function raster(n,width){
  const page=await pdfDocument.getPage(n),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:width/original.width});
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  try{
    if(canvas.width*canvas.height>64000000 || canvas.height>16000)throw new Error('PDF 페이지 크기가 너무 큽니다. 일반 크기의 PDF를 선택해 주세요.');
    await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PDF 화면 준비 실패')),'image/png'));
    return {url:URL.createObjectURL(blob),width:canvas.width,height:canvas.height,ratio:original.height/original.width,bytes:blob.size};
  }finally{canvas.width=1;canvas.height=1;page.cleanup();}
}
function enqueue(n,width){const job=renderQueue.then(()=>raster(n,width));renderQueue=job.catch(()=>{});return job;}
export async function preparePDF(range,progress){
  if(!pdfDocument)throw new Error('먼저 PDF를 선택해 주세요.');
  if(range.end>pdfDocument.numPages)throw new Error(`이 PDF는 ${pdfDocument.numPages}페이지입니다. 시작·끝 페이지를 확인해 주세요.`);
  clearPages();const count=range.end-range.start+1;let bytes=0;
  try{
    for(let n=range.start;n<=range.end;n++){
      // Lossless pages are prepared sequentially; full-resolution decoded images are kept only near the viewport.
      const rasterized=await enqueue(n,3200);bytes+=rasterized.bytes;
      if(bytes>384*1024*1024){URL.revokeObjectURL(rasterized.url);throw new Error('선택한 페이지의 고화질 준비 용량이 384MB를 넘습니다. 이번에 풀 페이지 범위를 줄여 주세요.');}
      pages.set(n,rasterized);progress(n-range.start+1,count);
    }
  }catch(err){clearPages();throw err;}
  return {count,hash};
}
export function mountPDFViewer(box,range,initialZoom,initialPosition,onPage,onError){
  let active=true, zoom=initialZoom, frame=null;
  const entries=[], upgrades=new Map();
  for(let n=range.start;n<=range.end;n++){
    const source=pages.get(n),wrapper=document.createElement('div');
    wrapper.className='pdf-sheet';wrapper.dataset.page=String(n);wrapper.setAttribute('aria-label',`PDF ${n}페이지`);
    box.append(wrapper);entries.push({n,wrapper,source,image:null,loading:false,failedWidth:0});
  }
  function position(){
    const entry=entries.findLast(p=>p.wrapper.offsetTop<=box.scrollTop+2)||entries[0];
    return {page:entry.n,fraction:Math.max(0,(box.scrollTop-(entry.wrapper.offsetTop))/entry.wrapper.offsetHeight),left:box.scrollLeft};
  }
  function restore(pos){const entry=entries.find(p=>p.n===pos.page)||entries[0];box.scrollTop=entry.wrapper.offsetTop+entry.wrapper.offsetHeight*(pos.fraction||0);box.scrollLeft=pos.left||0;}
  function layout(pos){
    const width=Math.max(100,(box.clientWidth-24)*zoom/100);
    entries.forEach(p=>{p.wrapper.style.width=`${width}px`;p.wrapper.style.height=`${width*p.source.ratio}px`;});
    restore(pos);update();
  }
  async function upgrade(p,width){
    if(p.loading || width<=p.source.width || width===p.failedWidth)return;
    p.loading=true;
    try{
      const improved=await enqueue(p.n,Math.ceil(width));
      if(!active){URL.revokeObjectURL(improved.url);return;}
      const old=upgrades.get(p.n);if(old)URL.revokeObjectURL(old.url);
      upgrades.set(p.n,improved);p.source=improved;if(p.image)p.image.src=improved.url;
    }catch(err){p.failedWidth=width;if(active)onError(err.message);}finally{p.loading=false;if(active)schedule();}
  }
  function update(){
    if(!active)return;
    const top=box.scrollTop,height=box.clientHeight;
    let current=entries[0].n;
    for(const p of entries){
      const y=p.wrapper.offsetTop,h=p.wrapper.offsetHeight;
      if(y<=top+height*.25)current=p.n;
      const near=y+h>=top-height*.6 && y<=top+height*1.6;
      if(near){
        if(!p.image){p.image=new Image();p.image.alt=`PDF ${p.n}페이지`;p.image.src=p.source.url;p.image.draggable=false;p.wrapper.append(p.image);}
        const required=p.wrapper.clientWidth*(window.devicePixelRatio||1);
        if(required>p.source.width+1)upgrade(p,required);
      }else{
        if(p.image){p.image.removeAttribute('src');p.image.remove();p.image=null;}
        const improved=upgrades.get(p.n);
        if(improved&&!p.loading){URL.revokeObjectURL(improved.url);upgrades.delete(p.n);p.source=pages.get(p.n);}
      }
    }
    onPage(current);
  }
  function schedule(){if(frame===null)frame=requestAnimationFrame(()=>{frame=null;update();});}
  box.addEventListener('scroll',schedule,{passive:true});
  const resize=new ResizeObserver(()=>layout(position()));resize.observe(box);
  layout(initialPosition);
  return {
    position,
    go(n){const entry=entries.find(p=>p.n===n);if(entry){box.scrollTop=entry.wrapper.offsetTop;update();}},
    zoom(value){const pos=position();zoom=value;entries.forEach(p=>p.failedWidth=0);layout(pos);},
    destroy(){active=false;resize.disconnect();box.removeEventListener('scroll',schedule);if(frame!==null)cancelAnimationFrame(frame);for(const p of entries)if(p.image)p.image.removeAttribute('src');for(const p of upgrades.values())URL.revokeObjectURL(p.url);}
  };
}
