import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createExam,startSection,beginPreparation,pauseForNavigation,resumePausedExam,synchronizeExam,chooseAnswer,toggleFlag,submitSection} from '../src/core.js';
const make=(breakMode='free')=>createExam({title:'자동 정지 테스트',mode:'full',breakMode,pdfRange:{start:1,end:1},sections:['언어이해','자료해석','창의수리','언어추리','수열추리'].map(name=>({name,count:20,minutes:15}))},'synthetic',0);
test('페이지 이탈 정지는 답·표시·도구를 유지하고 복구 지연을 풀이 시간에서 제외한다',()=>{
  const exam=make();startSection(exam,0);chooseAnswer(exam,3,1000);toggleFlag(exam,'uncertain',1000);exam.memo='memo';exam.pdfPosition={page:3,fraction:.25,left:0};
  assert.equal(pauseForNavigation(exam,2000),true);assert.equal(exam.phase,'paused');assert.equal(exam.pausedPhase,'running');
  const restored=structuredClone(exam);assert.equal(pauseForNavigation(restored,3000),false);assert.equal(restored.pausedAt,2000);assert.equal(synchronizeExam(restored,99999999),false);
  resumePausedExam(restored,1000000);assert.equal(restored.deadline,900000+998000);assert.equal(restored.questionStartedAt,998000);assert.equal(restored.selection,3);assert.equal(restored.selectionFlags.uncertain,true);assert.equal(restored.memo,'memo');assert.deepEqual(restored.pdfPosition,exam.pdfPosition);
  submitSection(restored,1001000);assert.equal(restored.sections[0].elapsed,3000);assert.equal(restored.sections[0].items[0].ms,3000);
});
test('5초 준비와 30초 준비는 남은 시간 그대로 저장하고 수동 재개한다',()=>{
  for(const timed of [false,true]){
    const exam=make(timed?'timed':'free');
    if(timed){startSection(exam,0);submitSection(exam,1000);}else beginPreparation(exam,1000);
    const deadline=exam.preparationDeadline;assert.equal(pauseForNavigation(exam,3000),true);assert.equal(exam.pausedPhase,'preparing');
    const restored=JSON.parse(JSON.stringify(exam));assert.equal(synchronizeExam(restored,1000000),false);assert.equal(restored.phase,'paused');
    resumePausedExam(restored,1000000);assert.equal(restored.phase,'preparing');assert.equal(restored.preparationDeadline,1000000+deadline-3000);
    assert.equal(synchronizeExam(restored,restored.preparationDeadline-1),false);assert.equal(synchronizeExam(restored,restored.preparationDeadline),true);assert.equal(restored.phase,'running');assert.equal(restored.deadline-restored.sections[restored.sectionIndex].startedAt,900000);
  }
});
test('마감 이후 이탈은 종료를 되돌리지 않고 다음 준비만 멈춘다',()=>{
  const timed=make('timed');startSection(timed,0);pauseForNavigation(timed,900010);assert.equal(timed.sectionIndex,1);assert.equal(timed.phase,'paused');assert.equal(timed.pausedPhase,'preparing');assert.equal(timed.preparationDeadline-timed.pausedAt,29990);assert.equal(timed.sections[0].elapsed,900000);
  const free=make();startSection(free,0);pauseForNavigation(free,900010);assert.equal(free.phase,'between');assert.equal(free.sectionIndex,1);
  const last=make();last.sectionIndex=4;startSection(last,0);pauseForNavigation(last,900010);assert.equal(last.phase,'finished');
});
test('실제 beforeunload/pagehide 핸들러는 저장 후 잠금을 해제하고 중복 정지를 하지 않는다',()=>{
  const exam=make();startSection(exam,Date.now());
  const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');const events=new Map(),order=[];
  const window={addEventListener:(name,handler)=>events.set(name,handler)};
  const register=Function('window','exam','pauseForNavigation','persist','clearInterval','releaseLock',`let locked=true,timer=1,helpResume=null;${source.slice(source.indexOf('function pauseOnLeave()'),source.indexOf("window.addEventListener('pageshow'"))}`);
  register(window,exam,pauseForNavigation,()=>order.push('save'),()=>order.push('stop'),()=>order.push('release'));
  events.get('beforeunload')();const pausedAt=exam.pausedAt;events.get('pagehide')();assert.equal(exam.phase,'paused');assert.equal(exam.pausedAt,pausedAt);assert.deepEqual(order,['stop','save','save','release']);
  const fallback=make();startSection(fallback,Date.now());order.length=0;register(window,fallback,pauseForNavigation,()=>order.push('save'),()=>order.push('stop'),()=>order.push('release'));events.get('pagehide')();assert.equal(fallback.phase,'paused');assert.deepEqual(order,['stop','save','release']);
});

test('사용안내는 활성 시험·준비만 멈추고 닫을 때 재개하며 기존 정지는 유지한다',()=>{
  const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function openHelp()'),source.indexOf("document.querySelector('#nav-help').onclick=openHelp"));
  for(const mode of ['running','preparing','paused','leave']){
    const exam=make();if(mode==='preparing')beginPreparation(exam,1000);else startSection(exam,0);
    if(mode==='paused')pauseForNavigation(exam,1000);
    const classes=new Set(),list={add:v=>classes.add(v),remove:v=>classes.delete(v)};
    const dialog={open:false,showModal(){this.open=true;}};
    const document={querySelector:()=>dialog,documentElement:{classList:list},body:{classList:list}};
    let renders=0;
    const actions=Function('exam','document','pauseForNavigation','resumePausedExam','clearInterval','persist','renderExam','afterChange',`let locked=true,helpResume=null,timer=1,view='exam';${code};return {openHelp,closeHelp,leave(){helpResume=null;}};`)(exam,document,s=>pauseForNavigation(s,2000),s=>resumePausedExam(s,10000),()=>{},()=>{},()=>renders++,()=>{});
    actions.openHelp();assert.equal(exam.phase,'paused');assert.equal(classes.has('help-open'),true);
    if(mode==='leave')actions.leave();actions.closeHelp();assert.equal(classes.size,0);
    if(['paused','leave'].includes(mode)){assert.equal(exam.phase,'paused');assert.equal(renders,0);}
    else {assert.equal(exam.phase,mode);assert.equal(renders,1);assert.equal((mode==='preparing'?exam.preparationDeadline:exam.deadline),mode==='preparing'?14000:908000);}
  }
});
