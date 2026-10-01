import test from 'node:test';
import assert from 'node:assert/strict';
import { createExam,startSection,chooseAnswer,toggleFlag,advance,expire,submitSection,sectionSummary,validateConfig } from '../src/core.js';
import { applyAnswerSet } from '../src/answer-sets.js';
import { copyContent,resultRows,resultHeaders } from '../src/report.js';
const names=['언어이해','자료해석','창의수리','언어추리','수열추리'];
const full={title:'전체 시험',mode:'full',sections:names.map(name=>({name,start:1,end:1,count:20,minutes:15,key:Array(20).fill(3)}))};
test('전체 5영역은 영역별 15분, 휴식 제외 최대 75분이다',()=>{
  const s=createExam(full,'test');let now=1000;
  for(let i=0;i<5;i++){
    assert.equal(startSection(s,now),true);expire(s,now+900001);
    assert.equal(s.sections[i].elapsed,900000);
    if(i<4){assert.equal(s.phase,'between');assert.equal(s.deadline,null);assert.equal(expire(s,now+99999999),false);now+=1800000;}
  }
  assert.equal(s.phase,'finished');assert.equal(s.sections.reduce((sum,s)=>sum+s.elapsed,0),75*60000);
});
test('조기 제출 후 남은 시간을 다음 영역에 더하지 않는다',()=>{
  const s=createExam(full,'test');startSection(s,1000);chooseAnswer(s,3,2000);submitSection(s,3000);
  assert.equal(s.phase,'between');assert.equal(s.sections[0].elapsed,2000);assert.equal(s.deadline,null);
  startSection(s,100000);assert.equal(s.deadline,100000+15*60000);
});
test('단일 영역은 전체 정답 세트에서 해당 영역의 답과 참고값만 가져온다',()=>{
  const set={sections:names.map((name,i)=>({name,count:20,key:Array(20).fill(i+1),difficulty:Array(20).fill('보통'),correctRate:Array(20).fill(50)}))};
  const config=applyAnswerSet({title:'창의수리만',mode:'single',sections:[full.sections[2]]},set);
  assert.equal(config.sections.length,1);assert.equal(config.sections[0].key[0],3);assert.equal(config.sections[0].correctRate[0],50);
  const s=createExam(config,'test');startSection(s,0);expire(s,900000);assert.equal(s.phase,'finished');
  assert.throws(()=>validateConfig({...full,sections:full.sections.slice(0,4)}));
});
test('헷갈림·찍었음은 확정 시 잠기고 다음 문제에는 초기화된다',()=>{
  const s=createExam({title:'표시 시험',sections:[{name:'수리',start:1,end:1,count:3,minutes:1,key:[3,3,3]}]},'test');startSection(s,0);
  toggleFlag(s,'uncertain',100);toggleFlag(s,'guessed',200);chooseAnswer(s,3,300);advance(s,false,1000);
  assert.equal(s.sections[0].items[0].uncertain,true);assert.equal(s.sections[0].items[0].guessed,true);
  assert.deepEqual(s.selectionFlags,{uncertain:false,guessed:false});chooseAnswer(s,3,1500);advance(s,false,2000);expire(s,60000);
  const summary=sectionSummary(s.sections[0]);assert.equal(summary.correct,2);assert.equal(summary.guessedCorrect,1);assert.equal(summary.uncertainCorrect,1);assert.equal(summary.unmarkedCorrect,1);
  assert.equal(toggleFlag(s,'guessed',70000),false);assert.equal(s.sections[0].items[0].guessed,true);
  assert.match(copyContent(s).text,/헷갈림\t찍었음/);assert.equal(resultRows(s)[0].length,resultHeaders(s).length);
});
test('표시는 새로고침 후 복구하고 타임아웃 자동 제출에도 남긴다',()=>{
  const s=createExam({title:'표시 복구',sections:[{name:'수리',start:1,end:1,count:1,minutes:1,key:[3]}]},'test');startSection(s,0);toggleFlag(s,'guessed',1000);chooseAnswer(s,3,2000);
  const recovered=JSON.parse(JSON.stringify(s));expire(recovered,90000);assert.equal(recovered.sections[0].items[0].guessed,true);assert.equal(sectionSummary(recovered.sections[0]).guessedCorrect,1);
});
