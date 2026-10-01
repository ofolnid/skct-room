import test from 'node:test';
import assert from 'node:assert/strict';
import { createExam,startSection,chooseAnswer,advance,expire,submitSection,resultOf,sectionSummary,parseKey,validateConfig } from '../src/core.js';
import { calculate } from '../src/tools.js';
import { copyContent,csvContent,reportMarkup } from '../src/report.js';
const config={title:'테스트 시험',sections:[{name:'수리',start:1,end:2,count:3,minutes:1,key:[1,2,3]}]};
test('답안은 확정 시에만 기록하고, 이전 문제 호출은 거절한다',()=>{
  const s=createExam(config,'hash',0);startSection(s,1000);chooseAnswer(s,1,2000);chooseAnswer(s,3,2500);
  assert.equal(s.sections[0].items[0].answer,null);assert.equal(advance(s,false,3000,0),true);
  assert.equal(s.sections[0].items[0].answer,3);assert.equal(s.sections[0].items[0].ms,2000);
  chooseAnswer(s,2,3500);assert.equal(advance(s,false,4000,0),false);assert.equal(s.questionIndex,1);
  advance(s,false,4500,1);assert.equal(s.sections[0].items[0].answer,3);
});
test('타임아웃은 마감 시각으로 계산하고 선택 답을 제출한다',()=>{
  const s=createExam(config,'hash',0);startSection(s,1000);chooseAnswer(s,1,2000);advance(s,false,4000);
  chooseAnswer(s,2,6000);assert.equal(expire(s,999999),true);assert.equal(s.phase,'finished');
  assert.equal(s.sections[0].elapsed,60000);assert.equal(s.sections[0].items[1].ms,57000);
  assert.equal(s.sections[0].items[1].answer,2);assert.equal(s.sections[0].items[2].status,'unreached');
  assert.equal(chooseAnswer(s,5,1000000),false);
});
test('선택 없이 시간 종료 시 미응답과 미도달을 구분한다',()=>{
  const s=createExam(config,'hash');startSection(s,0);expire(s,60000);
  assert.equal(resultOf(s.sections[0],0),'미응답');assert.equal(resultOf(s.sections[0],1),'미도달');
  assert.equal(sectionSummary(s.sections[0]).unanswered,1);assert.equal(sectionSummary(s.sections[0]).unreached,2);
});
test('건너뜀은 잠기고, 과목 사이에는 제한시간이 시작되지 않는다',()=>{
  const s=createExam({...config,sections:[...config.sections,{...config.sections[0],name:'언어'}]},'hash');
  startSection(s,0);advance(s,true,100);chooseAnswer(s,2,200);submitSection(s,300);
  assert.equal(s.sections[0].items[0].status,'skipped');assert.equal(s.phase,'between');assert.equal(s.deadline,null);
  assert.equal(expire(s,999999),false);startSection(s,1000000);assert.equal(s.deadline,1060000);
  assert.equal(s.sections[0].items[0].answer,null);
});
test('새로고침을 위한 직렬화에도 deadline과 현재 선택을 보존한다',()=>{
  const s=createExam(config,'hash');startSection(s,1000);chooseAnswer(s,4,1500);
  const recovered=JSON.parse(JSON.stringify(s));expire(recovered,62000);
  assert.equal(recovered.sections[0].items[0].answer,4);assert.equal(recovered.sections[0].items[0].ms,60000);
});
test('정답 개수·값·페이지 범위·문항 수를 검증한다',()=>{
  assert.deepEqual(parseKey('1, 2 3',3),[1,2,3]);assert.throws(()=>parseKey('1 2',3));assert.throws(()=>parseKey('1 2 6',3));assert.throws(()=>parseKey('1 2 3x',3));
  assert.throws(()=>validateConfig({...config,sections:[{...config.sections[0],start:3,end:1}]}));
  assert.throws(()=>validateConfig({...config,sections:[{...config.sections[0],count:0}]}));
});
test('HTML 입력은 복사 결과와 보고서에서 실행되지 않는다',()=>{
  const s=createExam({...config,title:'<img src=x onerror=alert(1)>'},'hash');startSection(s,0);submitSection(s,2000);
  const html=copyContent(s).html;assert.equal(html.includes('<img'),false);assert.match(html,/&lt;img/);
  assert.equal(reportMarkup(s).includes('<img src=x'),false);
});
test('CSV에서는 사용자 입력의 수식 실행을 방지한다',()=>{
  const s=createExam({...config,title:'=1+2'},'hash');startSection(s,0);submitSection(s,2000);
  assert.match(csvContent(s),/"'=1\+2"/);assert.match(copyContent(s).text,/기준 시간/);
});
test('계산기는 연산 순서·괄호·백분율을 지원하고 코드는 실행하지 않는다',()=>{
  assert.equal(calculate('2+3×4'),14);assert.equal(calculate('(2+3)×4'),20);assert.equal(calculate('200×10%'),20);
  assert.equal(calculate('-3 + 2'),-1);assert.equal(calculate('1.5÷0.5'),3);
  assert.throws(()=>calculate('1/0'));assert.throws(()=>calculate('alert(1)'));assert.throws(()=>calculate('(2+3'));
});
