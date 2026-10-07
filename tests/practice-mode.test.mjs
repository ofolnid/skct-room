import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,createExam,startSection,beginPreparation,synchronizeExam,chooseAnswer,advance,submitSection,pauseForNavigation,resumePausedExam,resultOf} from '../src/core.js';
import {reportMarkup} from '../src/report.js';
const names=['언어이해','자료해석','창의수리','언어추리','수열추리'];
const config=mode=>({title:'무제한 연습',mode,timeMode:'practice',breakMode:'timed',pdfRange:{start:1,end:2},sections:(mode==='single'?names.slice(0,1):names).map(name=>({name,count:20,minutes:15,key:Array(20).fill(1)}))});
test('전체·영역별 연습은 15분 이후에도 제출되지 않으며 시간·정답을 기록한다',()=>{
 for(const mode of ['full','single']){
  const state=createExam(config(mode),'pdf',1000);startSection(state,1000);
  assert.equal(state.deadline,null);assert.equal(state.breakMode,'free');
  assert.equal(synchronizeExam(state,3601000),false);assert.equal(state.phase,'running');
  chooseAnswer(state,1,3601000);advance(state,false,3601000);
  assert.equal(state.sections[0].items[0].ms,3600000);assert.equal(resultOf(state.sections[0],0),'정답');
  submitSection(state,3602000);assert.equal(state.sections[0].elapsed,3601000);
  assert.equal(state.phase,mode==='full'?'between':'finished');
  assert.match(reportMarkup(state),/연습 모드 \(시간 제한 없음\)/);assert.match(reportMarkup(state),/제한 없음/);
 }
});
test('연습 모드 재로드·일시정지는 제한시간을 만들지 않고 휴식 시간을 제외한다',()=>{
 let state=createExam(config('single'),'pdf',1000);startSection(state,1000);
 pauseForNavigation(state,11000);state=JSON.parse(JSON.stringify(state));resumePausedExam(state,1011000);
 assert.equal(state.deadline,null);chooseAnswer(state,1,1021000);advance(state,false,1021000);
 assert.equal(state.sections[0].items[0].ms,20000);submitSection(state,1022000);assert.equal(state.sections[0].elapsed,21000);
});
test('전체 연습의 다음 영역은 자유 휴식 후 준비하고 자동 시간 종료는 없다',()=>{
 const state=createExam(config('full'),'pdf',0);beginPreparation(state,0);synchronizeExam(state,5000);
 submitSection(state,10000);assert.equal(state.phase,'between');synchronizeExam(state,99999999);assert.equal(state.phase,'between');
 beginPreparation(state,100000000);synchronizeExam(state,200000000);assert.equal(state.sectionIndex,1);assert.equal(state.phase,'running');assert.equal(state.deadline,null);
});
test('이전 설정은 시간 제한 모드이고 잘못된 시간 모드를 거절한다',()=>{
 const old=config('single');delete old.timeMode;assert.equal(validateConfig(old).timeMode,'timed');assert.throws(()=>validateConfig({...old,timeMode:'unknown'}));
});

test('연습도 마지막 문항 제출 시 정상 종료하며 정답을 시험 중 노출하지 않는다',()=>{
 const state=createExam(config('single'),'pdf',0);startSection(state,0);
 for(let i=0;i<20;i++){chooseAnswer(state,1,(i+1)*120000);assert.equal(advance(state,false,(i+1)*120000),true);}
 assert.equal(state.phase,'finished');assert.equal(state.sections[0].elapsed,2400000);assert.ok(state.sections[0].items.every(i=>i.ms===120000));
});
