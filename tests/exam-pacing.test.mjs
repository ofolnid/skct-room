import test from 'node:test';
import assert from 'node:assert/strict';
import {createExam,validateConfig,beginPreparation,synchronizeExam,startSection,submitSection,chooseAnswer,pauseExam,advance} from '../src/core.js';
const config=mode=>({title:'진행 모드',mode:'full',breakMode:mode,pdfRange:{start:1,end:10},sections:['언어이해','자료해석','창의수리','언어추리','수열추리'].map(name=>({name,count:20,minutes:15}))});
test('자유 휴식은 수동 시작 뒤 정확히 5초 준비하며 시험 시간에 포함하지 않는다',()=>{
 const s=createExam(config('free'),'pdf',0);assert.equal(beginPreparation(s,100),true);assert.equal(beginPreparation(s,200),false);
 assert.equal(startSection(s,200),false);assert.equal(chooseAnswer(s,1,200),false);assert.equal(pauseExam(s,200),false);assert.equal(advance(s,true,200),false);
 assert.equal(synchronizeExam(s,5099),false);assert.equal(s.phase,'preparing');synchronizeExam(s,5100);assert.equal(s.sections[0].startedAt,5100);assert.equal(s.deadline,905100);
 submitSection(s,6100);assert.equal(s.phase,'between');synchronizeExam(s,1000000);assert.equal(s.phase,'between');
 beginPreparation(s,1000000);synchronizeExam(s,1005000);assert.equal(s.sections[1].startedAt,1005000);assert.equal(s.sections[0].elapsed,1000);
});
test('실전 진행의 자동 제출·조기 제출 모두 30초 준비 뒤 예약 시각에 시작한다',()=>{
 for(const early of [false,true]){
  const s=createExam(config('timed'),'pdf',0);startSection(s,0);const end=early?1000:900000;
  if(early)submitSection(s,end);else synchronizeExam(s,end);
  assert.equal(s.phase,'preparing');assert.equal(s.preparationDeadline,end+30000);
  const restored=JSON.parse(JSON.stringify(s));synchronizeExam(restored,end+29999);assert.equal(restored.phase,'preparing');
  synchronizeExam(restored,end+31000);assert.equal(restored.sections[1].startedAt,end+30000);assert.equal(restored.deadline,end+930000);
 }
});
test('탭 정지·새로고침 후 긴 지연도 추가 시간을 주지 않고 마지막 영역까지 정산한다',()=>{
 const s=createExam(config('timed'),'pdf',0);beginPreparation(s,0);synchronizeExam(s,5000+5*900000+4*30000+10000);
 assert.equal(s.phase,'finished');assert.equal(s.sections.reduce((sum,x)=>sum+x.elapsed,0),4500000);assert.equal(s.sections[4].startedAt,5000+4*930000);
});
test('기존 설정은 자유 휴식으로 복구하고 영역별 시험에는 휴식 모드를 적용하지 않는다',()=>{
 const c=config('free');delete c.breakMode;assert.equal(validateConfig(c).breakMode,'free');
 assert.throws(()=>validateConfig({...c,breakMode:'bad'}));
 const single=createExam({...config('timed'),mode:'single',sections:[config('timed').sections[0]]},'pdf',0);beginPreparation(single,100);assert.equal(single.phase,'running');assert.equal(single.deadline,900100);
});
