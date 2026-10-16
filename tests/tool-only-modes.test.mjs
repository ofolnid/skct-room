import test from 'node:test';
import assert from 'node:assert/strict';
import {createExam,validateConfig,beginPreparation,synchronizeExam,pauseForNavigation,resumePausedExam,chooseAnswer,advance,submitSection,restartExam} from '../src/core.js';
import {examMarkup} from '../src/exam-layout.js';
import {applyAnswerSet} from '../src/answer-sets.js';
import {createReview,startReview,pauseReview,reviewElapsed,submitReview,nextReview} from '../src/review-tools.js';
const names=['언어이해','자료해석','창의수리','언어추리','수열추리'];
const config=(inputMode,mode,timeMode,breakMode)=>({title:'모드 검증',inputMode,mode,timeMode,breakMode,...(inputMode==='pdf'?{pdfRange:{start:20,end:39}}:{}),sections:(mode==='full'?names:names.slice(0,1)).map(name=>({name,count:20,minutes:15,key:Array(20).fill(3)}))});
for(const inputMode of ['pdf','tools'])for(const [mode,timeMode,breakMode] of [['full','timed','free'],['full','timed','timed'],['full','practice','free'],['single','timed','free'],['single','practice','free']]){
 test(`${inputMode} ${mode}/${timeMode}/${breakMode}: 공통 도구·제출·시간·전환·리셋`,()=>{
  const state=createExam(config(inputMode,mode,timeMode,breakMode),inputMode==='pdf'?'pdf':null,0);
  const html=examMarkup(state);for(const id of ['scratch-note','drawing','calc-input','undo-drawing','clear-note','clear-drawing','question-time','remaining-time'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);
  assert.equal(html.includes('id="pdf-page"'),inputMode==='pdf');assert.doesNotMatch(html,/pen-color|pen-width/);
  beginPreparation(state,1000);if(mode==='full')synchronizeExam(state,6000);
  const start=mode==='full'?6000:1000;assert.equal(state.phase,'running');
  pauseForNavigation(state,start+1000);resumePausedExam(state,start+11000);
  chooseAnswer(state,3,start+12000);advance(state,false,start+13000);assert.equal(state.sections[0].items[0].ms,3000);
  if(timeMode==='timed'){
   synchronizeExam(state,state.deadline);assert.equal(state.phase,mode==='single'?'finished':breakMode==='timed'?'preparing':'between');
   if(mode==='full'&&breakMode==='timed'){const deadline=state.preparationDeadline;synchronizeExam(state,deadline);assert.equal(state.phase,'running');assert.equal(state.sectionIndex,1);}
  }else{assert.equal(synchronizeExam(state,start+3600000),false);assert.equal(state.phase,'running');submitSection(state,start+3600000);assert.equal(state.phase,mode==='full'?'between':'finished');}
  const fresh=restartExam(state,'all',9999999);assert.equal(fresh.inputMode,inputMode);assert.equal(fresh.phase,'ready');assert.ok(fresh.sections.every(s=>s.items.every(i=>i.ms===0&&i.answer===null)));
 });
}
test('도구 모드는 PDF 없이 정답 세트를 해당 영역에 매칭하고 PDF 모드는 범위 검증을 유지한다',()=>{
 const c=config('tools','single','timed','free');const set={sections:names.map(name=>({name,count:20,key:Array(20).fill(4)}))};
 const state=createExam(applyAnswerSet(c,set),null,0);assert.equal(state.pdfHash,null);assert.equal(state.sections.length,1);assert.deepEqual(state.sections[0].key,Array(20).fill(4));
 assert.throws(()=>validateConfig({...c,inputMode:'pdf'}));assert.throws(()=>validateConfig({...c,inputMode:'invalid'}));
});
test('오답풀이 제출은 시계를 동결하고 중복 제출·무응답을 막으며 다음 풀이만 초기화한다',()=>{
 const s=createReview();assert.equal(submitReview(s,1000),false);startReview(s,1000);assert.equal(startReview(s,2000),false);s.selection=3;s.memo='복습';
 pauseReview(s,4000);assert.equal(reviewElapsed(s,99999),3000);startReview(s,10000);assert.equal(submitReview(s,12000),true);assert.equal(reviewElapsed(s,999999),5000);assert.deepEqual(s.records,[{answer:3,ms:5000}]);
 assert.equal(submitReview(s,14000),false);assert.equal(startReview(s,14000),false);assert.equal(nextReview(s),true);assert.equal(s.memo,'');assert.equal(s.elapsed,0);assert.equal(s.selection,null);assert.equal(s.records.length,1);assert.equal(nextReview(s),false);
});
test('오답풀이 재로드 저장본은 외출 시간을 더하지 않고 답과 경과시간을 보존한다',()=>{
 const s=createReview();startReview(s,1000);s.selection=2;const saved=JSON.parse(JSON.stringify({...s,elapsed:reviewElapsed(s,7000),startedAt:null}));assert.equal(reviewElapsed(saved,999999),6000);startReview(saved,1000000);submitReview(saved,1001000);assert.equal(saved.records[0].ms,7000);
});
