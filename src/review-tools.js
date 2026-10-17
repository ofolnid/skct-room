import {formatTime,resetScratch,escapeHTML as e} from './core.js';
import {mountTools,toolsMarkup} from './tools.js';
import {load,save} from './storage.js';
export function createReview(){return {memo:'',drawings:[],calculator:{expression:'',result:'0'},records:[],elapsed:0,startedAt:null,selection:null,submitted:false};}
export function reviewElapsed(state,now=Date.now()){return state.elapsed+(state.startedAt==null?0:Math.max(0,now-state.startedAt));}
export function pauseReview(state,now=Date.now()){if(state.startedAt==null)return false;state.elapsed=reviewElapsed(state,now);state.startedAt=null;return true;}
export function startReview(state,now=Date.now()){if(state.startedAt!=null||state.submitted)return false;state.startedAt=now;return true;}
export function submitReview(state,now=Date.now()){
 if(state.submitted||state.startedAt==null||!Number.isInteger(state.selection)||state.selection<1||state.selection>5)return false;
 pauseReview(state,now);state.records.push({answer:state.selection,ms:state.elapsed});state.submitted=true;return true;
}
export function nextReview(state){if(!state.submitted)return false;state.elapsed=0;state.startedAt=null;state.selection=null;state.submitted=false;resetScratch(state);return true;}
export function mountReviewTools(app){
 const state=load('review-tools')||createReview();state.startedAt=null; // Recover saved elapsed time without counting time away.
 const persist=()=>save('review-tools',{...state,elapsed:reviewElapsed(state),startedAt:null});
 let interval,lastPersist=0;
 function tick(){const el=app.querySelector('#review-time');if(el){const ms=reviewElapsed(state);el.textContent=formatTime(ms);el.classList.toggle('over-minute',ms>60000);}if(state.startedAt!=null&&Date.now()-lastPersist>=1000){lastPersist=Date.now();persist();}}
 function render(){
  const activeTool=app.querySelector('[data-tool].active')?.dataset.tool;
  app.innerHTML=`<div class="review-layout">
   <aside class="review-records" aria-label="풀이 기록">
    <div class="review-records-heading"><h2>풀이 기록 <small>${state.records.length}</small></h2><button id="review-copy" class="secondary" aria-label="기록 복사" ${state.records.length?'':'disabled'}>복사</button></div>
    <div class="review-record-list">${state.records.length?state.records.map((r,i)=>`<div class="review-record"><span>${i+1}</span><span>내 답 <b>${e(r.answer)}</b></span><b>${formatTime(r.ms)}</b></div>`).reverse().join(''):'<p class="review-record-empty">아직 기록이 없습니다.</p>'}</div>
   </aside>
   <div class="review-workspace">
    <section class="review-clock"><div><h1>오답풀이</h1><b id="review-time">${formatTime(reviewElapsed(state))}</b></div><button id="review-toggle" class="secondary" ${state.submitted?'disabled':''}>${state.startedAt!=null?'일시정지':state.elapsed?'계속 풀기':'풀이 시작'}</button></section>
    <section class="review-answer"><div class="answer-options" role="group" aria-label="오답풀이 답 선택">${[1,2,3,4,5].map(a=>`<button data-review-answer="${a}" aria-pressed="${state.selection===a}" class="${state.selection===a?'selected':''}" ${state.submitted?'disabled':''}>${a}</button>`).join('')}</div><div class="review-actions"><button id="review-submit" class="primary" ${state.startedAt==null||state.selection==null||state.submitted?'disabled':''}>답안 제출</button><button id="review-next" class="secondary" ${state.submitted?'':'disabled'}>다음 풀이</button></div></section>
    <aside class="tool-panel">${toolsMarkup()}</aside>
   </div>
  </div>`;
  mountTools(app.querySelector('.tool-panel'),state,persist);
  if(activeTool==='draw')app.querySelector('[data-tool="draw"]').click();
  app.querySelector('#review-toggle').onclick=()=>{if(state.startedAt==null)startReview(state);else pauseReview(state);persist();render();};
  app.querySelectorAll('[data-review-answer]').forEach(b=>b.onclick=()=>{if(state.submitted)return;state.selection=Number(b.dataset.reviewAnswer);persist();render();});
  app.querySelector('#review-submit').onclick=()=>{if(submitReview(state)){persist();render();}};
  app.querySelector('#review-next')?.addEventListener('click',()=>{nextReview(state);persist();render();});
  app.querySelector('#review-copy')?.addEventListener('click',async()=>{const text=['오답풀이 기록','순서\t내 답\t풀이시간',...state.records.map((r,i)=>`${i+1}\t${r.answer}\t${formatTime(r.ms)}`)].join('\n');try{await navigator.clipboard.writeText(text);app.querySelector('#review-copy').textContent='복사 완료';}catch{app.querySelector('#review-copy').textContent='복사 실패';}});
  tick();
 }
 render();interval=setInterval(tick,200);
 return {pause(){const was=state.startedAt!=null;pauseReview(state);persist();render();return was;},resume(){if(!state.submitted)startReview(state);persist();render();},dispose(){pauseReview(state);persist();clearInterval(interval);}};
}
