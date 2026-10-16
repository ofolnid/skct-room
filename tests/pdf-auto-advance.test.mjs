import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig,createExam,startSection,chooseAnswer,restartExam,pauseExam,resumePausedExam} from '../src/core.js';
import {submitAnswerAndTurnPage,mountAutoAdvanceToggle} from '../src/pdf-controls.js';
import {initialPDFOptionsMarkup,pdfAutoAdvanceMarkup} from '../src/exam-layout.js';
const config={title:'자동 넘김',mode:'single',pdfRange:{start:30,end:70},sections:[{name:'언어이해',count:20,minutes:15}],autoAdvancePDF:true};
function setup(extra={}){const exam=createExam({...config,...extra},'pdf',0);startSection(exam,100);let page=35;const calls=[];return {exam,calls,viewer:{position:()=>({page,fraction:.4,left:10}),go:n=>{page=n;calls.push(n);}}};}
test('자동 넘김은 기본 꺼짐이며 설정 내보내기·불러오기·리셋에 보존된다',()=>{
 assert.equal(validateConfig({...config,autoAdvancePDF:undefined}).autoAdvancePDF,false);
 const imported=validateConfig(JSON.parse(JSON.stringify(validateConfig(config))));assert.equal(imported.autoAdvancePDF,true);
 const s=createExam(imported,'pdf',0);assert.equal(restartExam(s,'all',100).autoAdvancePDF,true);assert.equal(restartExam(s,'section',100).autoAdvancePDF,true);
 assert.throws(()=>validateConfig({...config,autoAdvancePDF:'false'}));
});
test('답안 제출·건너뛰기는 표시 중인 PDF의 다음 한 페이지로 이동한다',()=>{
 const {exam,viewer,calls}=setup();chooseAnswer(exam,3,200);assert.equal(submitAnswerAndTurnPage(exam,viewer,false,300,0),true);assert.deepEqual(calls,[36]);assert.equal(exam.questionIndex,1);assert.equal(exam.sections[0].items[0].answer,3);
 assert.equal(submitAnswerAndTurnPage(exam,viewer,true,400,1),true);assert.deepEqual(calls,[36,37]);assert.equal(exam.sections[0].items[1].status,'skipped');
});
test('자동 넘김 미선택과 기존 응시 데이터는 PDF를 이동하지 않는다',()=>{
 for(const option of [false,undefined]){const {exam,viewer,calls}=setup({autoAdvancePDF:option});chooseAnswer(exam,2,200);submitAnswerAndTurnPage(exam,viewer,false,300);assert.deepEqual(calls,[]);assert.equal(exam.questionIndex,1);}
});
test('답 미선택·중복 제출·일시정지에서는 PDF가 넘어가지 않는다',()=>{
 const {exam,viewer,calls}=setup();assert.equal(submitAnswerAndTurnPage(exam,viewer,false,200),false);assert.deepEqual(calls,[]);
 chooseAnswer(exam,2,250);submitAnswerAndTurnPage(exam,viewer,false,300,0);submitAnswerAndTurnPage(exam,viewer,true,301,0);assert.deepEqual(calls,[36]);exam.phase='paused';submitAnswerAndTurnPage(exam,viewer,true,400,1);assert.deepEqual(calls,[36]);
});
test('PDF 범위의 마지막 페이지에서도 답안만 제출한다',()=>{
 const {exam,viewer,calls}=setup({pdfRange:{start:35,end:35}});chooseAnswer(exam,2,200);submitAnswerAndTurnPage(exam,viewer,false,300);assert.deepEqual(calls,[]);assert.equal(exam.questionIndex,1);
});
test('과목의 마지막 문제와 시간 종료 시 다음 과목 페이지를 노출하지 않는다',()=>{
 for(const last of [true,false]){const {exam,viewer,calls}=setup();if(last)exam.questionIndex=19;chooseAnswer(exam,2,200);submitAnswerAndTurnPage(exam,viewer,false,last?300:exam.deadline);assert.deepEqual(calls,[]);assert.equal(exam.phase,'finished');}
});
test('전체 시험에서 과목 전환과 30초 준비 시작 때도 자동 넘기지 않는다',()=>{
 const {exam,viewer,calls}=setup({mode:'full',breakMode:'timed',sections:['언어이해','자료해석','창의수리','언어추리','수열추리'].map(name=>({name,count:20,minutes:15}))});exam.questionIndex=19;chooseAnswer(exam,2,200);submitAnswerAndTurnPage(exam,viewer,false,300);assert.deepEqual(calls,[]);assert.equal(exam.sectionIndex,1);assert.equal(exam.phase,'preparing');
});
test('무제한 연습에서도 자동 넘김을 지원하고 뷰어가 없어도 제출은 가능하다',()=>{
 const {exam,viewer,calls}=setup({timeMode:'practice'});chooseAnswer(exam,2,200);submitAnswerAndTurnPage(exam,viewer,false,300);assert.deepEqual(calls,[36]);assert.equal(submitAnswerAndTurnPage(exam,null,true,400),true);
});

test('첫 시작 대기에서만 옵션을 표시하고 다음 과목·준비·리셋에서는 반복하지 않는다',()=>{
 const exam=createExam(config,'pdf',0);assert.match(initialPDFOptionsMarkup(exam),/ready-auto-advance-pdf/);
 exam.pdfOptionsConfirmed=true;assert.equal(initialPDFOptionsMarkup(exam),'');
 for(const scope of ['all','section'])assert.equal(initialPDFOptionsMarkup(restartExam(exam,scope,100)),'');
 exam.pdfOptionsConfirmed=false;exam.phase='preparing';assert.equal(initialPDFOptionsMarkup(exam),'');
 exam.phase='ready';exam.sectionIndex=1;assert.equal(initialPDFOptionsMarkup(exam),'');
 assert.match(pdfAutoAdvanceMarkup('pause-auto-advance-pdf',true),/checked/);
});
test('일시정지 설정을 바꿔도 답안·타이머·PDF는 유지하고 재개 후 다음 제출부터 적용한다',()=>{
 const {exam,viewer,calls}=setup({autoAdvancePDF:false});pauseExam(exam,200);
 const before=structuredClone(exam),input={checked:false};let saves=0;mountAutoAdvanceToggle(input,exam,()=>saves++);
 input.checked=true;input.onchange();assert.deepEqual(exam,{...before,autoAdvancePDF:true});assert.equal(saves,1);assert.deepEqual(calls,[]);
 resumePausedExam(exam,300);chooseAnswer(exam,2,400);submitAnswerAndTurnPage(exam,viewer,false,500);assert.deepEqual(calls,[36]);
 pauseExam(exam,600);input.checked=false;input.onchange();resumePausedExam(exam,700);submitAnswerAndTurnPage(exam,viewer,true,800);assert.deepEqual(calls,[36]);assert.equal(saves,2);
 const restored=JSON.parse(JSON.stringify(exam));assert.equal(restored.autoAdvancePDF,false);
});
