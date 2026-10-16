import test from 'node:test';
import assert from 'node:assert/strict';
import {createExam,startSection,chooseAnswer,advance,submitSection,pauseExam,beginPreparation,synchronizeExam,restartExam,expire} from '../src/core.js';
import {examMarkup} from '../src/exam-layout.js';
const config={title:'다시 시작 검증',mode:'full',breakMode:'timed',pdfRange:{start:1,end:3},sections:['언어이해','자료해석','창의수리','언어추리','수열추리'].map(name=>({name,count:20,minutes:15,key:Array(20).fill(2),tags:Array.from({length:20},()=>['검증 유형']),difficulty:Array(20).fill('보통'),correctRate:Array(20).fill(50)}))};
function second(){const s=createExam(config,'pdf',0);startSection(s,100);chooseAnswer(s,2,200);submitSection(s,300);synchronizeExam(s,30300);return s;}
test('현재 과목 재시작은 이전 제출 기록·메타데이터·PDF 위치를 보존하고 시작 대기한다',()=>{
 const s=second();chooseAnswer(s,3,40000);advance(s,false,41000);pauseExam(s,42000);s.memo='메모';s.calculator.expression='3+4';s.pdfPosition={page:2,fraction:.4,left:3};
 const before=structuredClone(s);const r=restartExam(s,'section',90000);
 assert.deepEqual(s,before);assert.equal(r.id,s.id);assert.equal(r.sectionIndex,1);assert.equal(r.phase,'ready');assert.equal(r.deadline,null);assert.equal(r.questionStartedAt,null);assert.equal(r.pausedAt,null);assert.equal(r.questionIndex,0);assert.equal(r.memo,'');assert.equal(r.calculator.expression,'');
 assert.deepEqual(r.sections[0],s.sections[0]);assert.notEqual(r.sections[0],s.sections[0]);assert.ok(r.sections[1].items.every(i=>i.status==='unreached'&&i.ms===0&&i.answer===null));assert.deepEqual(r.pdfPosition,s.pdfPosition);assert.deepEqual(r.sections[1].key,s.sections[1].key);assert.deepEqual(r.sections[1].tags,s.sections[1].tags);assert.equal(expire(r,99999999),false);
});
test('전체 재시작은 새 응시 ID와 모든 과목의 빈 기록을 만들고 15분 시작을 기다린다',()=>{
 const s=second();const r=restartExam(s,'all',50000);assert.notEqual(r.id,s.id);assert.equal(r.createdAt,50000);assert.equal(r.phase,'ready');assert.equal(r.sectionIndex,0);assert.equal(r.pdfHash,'pdf');assert.deepEqual(r.pdfRange,s.pdfRange);assert.ok(r.sections.every(a=>a.elapsed===0&&a.items.every(i=>i.ms===0&&i.status==='unreached')));beginPreparation(r,60000);synchronizeExam(r,65000);assert.equal(r.deadline,965000);
});
test('자동 제출 뒤 준비/휴식에서 직전 과목으로 돌아가 이후 과목 기록도 초기화한다',()=>{
 const s=second();const r=restartExam(s,'section',100000,0);assert.equal(r.sectionIndex,0);assert.equal(r.phase,'ready');assert.ok(r.sections.every(a=>a.items.every(i=>i.status==='unreached')));assert.throws(()=>restartExam(s,'section',0,2));assert.throws(()=>restartExam(s,'wrong'));assert.throws(()=>restartExam(s,'section',0,-1));
});
test('무제한 연습 재시작도 제한 시간을 만들지 않으며 완료 결과 원본은 보존한다',()=>{
 const s=createExam({...config,timeMode:'practice'},'pdf',0);s.phase='finished';s.sections[0].items[0]={answer:2,status:'answered',ms:45000};const before=structuredClone(s);const r=restartExam(s,'all',100);startSection(r,200);assert.equal(r.deadline,null);assert.equal(expire(r,99999999),false);assert.deepEqual(s,before);
});
test('가로 답안·분리된 도구·확정답 OMR과 문항 진행률을 렌더한다',()=>{
 const s=createExam(config,'pdf',0);startSection(s,100);chooseAnswer(s,2,200);advance(s,false,300);advance(s,true,400);const html=examMarkup(s);assert.match(html,/aria-valuenow="2"/);assert.match(html,/class="exam-main"/);assert.match(html,/class="answer-panel answer-bar"/);assert.match(html,/class="omr-panel"/);assert.match(html,/<small>1<\/small><b>2<\/b>/);assert.match(html,/다음 →/);assert.doesNotMatch(html,/data-answer="2"[^>]*selected/);
});

test('문제 풀이시간은 PDF 제목 옆에 한 번만 표시하고 가로 답안에서 제외한다',()=>{
 const s=createExam(config,'pdf',0);startSection(s,100);const html=examMarkup(s);
 assert.equal((html.match(/id="question-time"/g)||[]).length,1);
 assert.match(html, /pdf-question[^]*?question-time[^]*?<div class="actions">/);
 assert.doesNotMatch(html.split('class="answer-panel answer-bar"')[1],/id="question-time"/);
});
