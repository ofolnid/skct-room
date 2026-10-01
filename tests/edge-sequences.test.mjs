import test from 'node:test';
import assert from 'node:assert/strict';
import {createExam,startSection,pauseExam,resumePausedExam,chooseAnswer,toggleFlag,advance,expire,submitSection} from '../src/core.js';
function fixture(){return createExam({title:'경계 검증',mode:'full',pdfRange:{start:1,end:1},sections:['언어이해','자료해석','창의수리','언어추리','수열추리'].map(name=>({name,count:20,minutes:15}))},'synthetic',0);}
test('무작위 상태 전이 200개 시험에서 확정 답안·시간·과목 경계 불변식을 지킨다',()=>{
  let seed=73;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let run=0;run<200;run++){
    let state=fixture(),now=0;const recorded=new Map();
    for(let step=0;step<300;step++){
      now+=next()%120000;
      if(state.phase==='ready'||state.phase==='between')startSection(state,now);
      const operation=next()%9;
      if(operation===0)chooseAnswer(state,1+next()%5,now);
      if(operation===1)toggleFlag(state,next()%2?'guessed':'uncertain',now);
      if(operation===2)advance(state,true,now);
      if(operation===3)advance(state,false,now);
      if(operation===4)pauseExam(state,now);
      if(operation===5)resumePausedExam(state,now);
      if(operation===6)expire(state,now);
      if(operation===7)submitSection(state,now);
      if(operation===8)state=JSON.parse(JSON.stringify(state));
      state.sections.forEach((s,si)=>{
        assert.ok(s.elapsed>=0&&s.elapsed<=900000);
        s.items.forEach((item,qi)=>{assert.ok(item.ms>=0);const id=`${si}/${qi}`;if(recorded.has(id))assert.deepEqual(item,recorded.get(id));else if(item.status!=='unreached')recorded.set(id,structuredClone(item));});
        if(s.endedAt!=null)assert.equal(s.items.reduce((sum,i)=>sum+i.ms,0),s.elapsed);
      });
      assert.ok(state.sections.reduce((sum,s)=>sum+s.elapsed,0)<=4500000);
      if(state.phase==='paused'){const before=JSON.stringify(state);expire(state,now+999999999);assert.equal(JSON.stringify(state),before);}
    }
  }
});
test('pause/resume 직후 1ms 남은 마감·이전 문항의 중복 확정·다음 영역 정지를 처리한다',()=>{
  const s=fixture();startSection(s,0);chooseAnswer(s,3,1);assert.equal(pauseExam(s,899999),true);resumePausedExam(s,9899999);assert.equal(expire(s,9900000),true);assert.equal(s.sections[0].elapsed,900000);assert.equal(s.sections[0].items[0].answer,3);assert.equal(pauseExam(s,9900001),false);
  startSection(s,10000000);chooseAnswer(s,1,10000001);advance(s,false,10000002,0);assert.equal(advance(s,true,10000003,0),false);assert.equal(s.questionIndex,1);assert.equal(s.sections[1].pausedMs,0);
});
