import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,createExam,startSection,chooseAnswer,advance,submitSection,expire} from '../src/core.js';
const subject={name:'연습',count:3,minutes:1};
const config={title:'범위 테스트',pdfRange:{start:30,end:70},sections:[subject]};
test('시험 전체 PDF 범위는 한 번만 설정하고 영역 설정과 독립적이다',()=>{
  const checked=validateConfig(config);assert.deepEqual(checked.pdfRange,{start:30,end:70});
  const state=createExam(config,'hash');assert.deepEqual(state.pdfRange,checked.pdfRange);
  assert.throws(()=>validateConfig({...config,pdfRange:{start:70,end:30}}));
  assert.throws(()=>validateConfig({...config,pdfRange:{start:0,end:30}}));
});
test('예전 설정 파일의 과목별 페이지는 하나의 전체 범위로 복구한다',()=>{
  const checked=validateConfig({title:'예전 설정',sections:[{...subject,start:2,end:8},{...subject,name:'다음',start:9,end:15}]});
  assert.deepEqual(checked.pdfRange,{start:2,end:15});
});
function scratch(state){state.memo='풀이 메모';state.drawings=[{points:[[0,0],[1,1]],color:'#000',width:3}];state.calculator={expression:'12+8',result:'20'};}
function assertClear(state){assert.equal(state.memo,'');assert.deepEqual(state.drawings,[]);assert.deepEqual(state.calculator,{expression:'',result:'0'});}
test('확정 및 건너뜀은 모든 풀이 도구를 초기화한다',()=>{
  const state=createExam(config,'hash');startSection(state,0);scratch(state);
  assert.equal(advance(state,false,500),false);assert.equal(state.memo,'풀이 메모');
  chooseAnswer(state,2,600);advance(state,false,1000);assertClear(state);
  scratch(state);advance(state,true,2000);assertClear(state);
  assert.equal(state.sections[0].items[0].answer,2);assert.equal(state.sections[0].items[1].status,'skipped');
});
test('제출·시간 종료·영역 시작 시 도구는 초기화하고 현재 문항 복구는 보존한다',()=>{
  for(const finish of [submitSection,expire]){
    const state=createExam(config,'hash');startSection(state,0);scratch(state);
    const restored=JSON.parse(JSON.stringify(state));assert.equal(restored.memo,'풀이 메모');assert.equal(restored.calculator.result,'20');
    finish(state,60000);assertClear(state);
  }
  const state=createExam(config,'hash');scratch(state);startSection(state,0);assertClear(state);
});
