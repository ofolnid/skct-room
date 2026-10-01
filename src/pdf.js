import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
let document = null;
const pages = new Map();
let hash = '';
export async function openPDF(file) {
  if (!file || file.size > 250*1024*1024) throw new Error('PDF는 250MB 이하 파일을 선택해 주세요.');
  clearPages();
  if (document) { await document.destroy(); document=null; }
  const bytes = new Uint8Array(await file.arrayBuffer());
  hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b=>b.toString(16).padStart(2,'0')).join('');
  const base = new URL('./vendor/', import.meta.url).href;
  const task = pdfjs.getDocument({ data:bytes, cMapUrl:base+'cmaps/', cMapPacked:true, standardFontDataUrl:base+'standard_fonts/', wasmUrl:base+'wasm/', isEvalSupported:false, enableXfa:false });
  task.onPassword = () => { task.destroy(); };
  try { document = await task.promise; }
  catch { throw new Error('PDF를 열 수 없습니다. 암호가 없는 정상 PDF인지 확인해 주세요.'); }
  return {count:document.numPages,hash};
}
export function clearPages() { for (const entry of pages.values()) URL.revokeObjectURL(entry.url); pages.clear(); }
export async function preparePDF(sections, width, progress) {
  if (!document) throw new Error('먼저 PDF를 선택해 주세요.');
  clearPages();
  const numbers = [...new Set(sections.flatMap(s => Array.from({length:s.end-s.start+1},(_,i)=>s.start+i)))].sort((a,b)=>a-b);
  if (numbers.some(n=>n>document.numPages)) throw new Error(`이 PDF는 ${document.numPages}페이지입니다. 과목별 페이지 범위를 확인해 주세요.`);
  let pixels=0;
  for (const n of numbers) {
    const page=await document.getPage(n), v=page.getViewport({scale:1});
    pixels += width*width*v.height/v.width; page.cleanup();
  }
  if (pixels > 65000000) throw new Error('선택 범위가 메모리 한도를 넘습니다. 표준 화질을 선택하거나 시험 페이지 범위를 줄여 주세요.');
  try {
    for (let i=0;i<numbers.length;i++) {
      const n=numbers[i], page=await document.getPage(n), original=page.getViewport({scale:1}), viewport=page.getViewport({scale:width/original.width});
      const canvas=globalThis.document.createElement('canvas'); canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PDF 화면을 준비하지 못했습니다.')),'image/webp',0.94));
      const url=URL.createObjectURL(blob), image=new Image(); image.src=url; image.alt=`PDF ${n}페이지`;
      try { await image.decode(); } catch(e) { URL.revokeObjectURL(url); throw e; }
      pages.set(n,{url,image}); canvas.width=1; canvas.height=1; page.cleanup(); progress(i+1,numbers.length);
    }
  } catch (e) { clearPages(); throw e; }
  return {count:numbers.length,hash};
}
export function pageImage(n) { return pages.get(n)?.image; }
