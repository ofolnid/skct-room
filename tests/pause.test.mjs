import test from 'node:test';
import assert from 'node:assert/strict';
import {createExam,startSection,chooseAnswer,toggleFlag,advance,submitSection,expire,pauseExam,resumePausedExam} from '../src/core.js';
const make=()=>createExam({title:'정지 검증',pdfRange:{start:1,end:1},sections:[{name:'언어',count:3,minutes:1,key:[1,2,3]}]},'test',0);
test('일시정지 중 제출·선택·표시·만료를 막고 기존 선택과 도구를 유지한다',()=>{
  const s=make();startSection(s,0);chooseAnswer(s,2,1000);toggleFlag(s,'guessed',1000);s.memo='보존';assert.equal(pauseExam(s,2000),true);
  assert.equal(expire(s,999999),false);assert.equal(chooseAnswer(s,1,3000),false);assert.equal(toggleFlag(s,'guessed',3000),false);assert.equal(advance(s,false,3000),false);assert.equal(submitSection(s,3000),false);assert.equal(pauseExam(s,3000),false);assert.equal(s.selection,2);assert.equal(s.memo,'보존');assert.equal(s.selectionFlags.guessed,true);
});
test('여러 번 정지해도 문항·과목 시간과 자동 제출에서 정지 시간을 제외한다',()=>{
  const s=make();startSection(s,0);chooseAnswer(s,1,1000);pauseExam(s,2000);resumePausedExam(s,12000);advance(s,false,15000);assert.equal(s.sections[0].items[0].ms,5000);
  pauseExam(s,16000);resumePausedExam(s,36000);assert.equal(s.deadline,90000);assert.equal(resumePausedExam(s,37000),false);assert.equal(expire(s,89999),false);assert.equal(expire(s,999999),true);assert.equal(s.sections[0].elapsed,60000);assert.equal(s.sections[0].items[1].ms,55000);
});
test('직렬화 후 오랜 정지를 복구하고 조기 제출 시간에서도 제외한다',()=>{
  const s=make();startSection(s,0);pauseExam(s,1000);const restored=JSON.parse(JSON.stringify(s));assert.equal(expire(restored,1000000),false);resumePausedExam(restored,1000000);chooseAnswer(restored,1,1001000);submitSection(restored,1002000);assert.equal(restored.sections[0].elapsed,3000);assert.equal(restored.sections[0].items[0].ms,3000);
});
test('마감 시각에 일시정지하면 시간을 연장하지 않고 먼저 자동 제출한다',()=>{
  const s=make();assert.equal(pauseExam(s,0),false);startSection(s,0);assert.equal(pauseExam(s,60000),false);assert.equal(s.phase,'finished');assert.equal(s.sections[0].elapsed,60000);
});
