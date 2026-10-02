import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnswerSet,applyAnswerSet,clearAnswerMetadata,regradeAnswerSet } from '../src/answer-sets.js';
import { createExam,startSection,submitSection,resultOf } from '../src/core.js';
import { reportMarkup } from '../src/report.js';
const input={id:'practice-1',title:'직접 작성한 시험',sections:[{name:'수리',count:3,key:[1,2,3],difficulty:['쉬움',null,'어려움'],correctRate:[90,null,0],source:'직접 입력한 참고 자료'}]};
test('배포 정답 세트의 선택적 정보와 0% 참고값을 보존한다',()=>{
  const set=validateAnswerSet(input);assert.deepEqual(set.sections[0].correctRate,[90,null,0]);
  const exam=createExam({title:set.title,sections:set.sections.map(s=>({...s,start:1,end:1,minutes:1}))},'test');
  startSection(exam,0);submitSection(exam,1000);const markup=reportMarkup(exam);
  assert.match(markup,/참고 정답률 · <strong>0%/);assert.doesNotMatch(markup,/직접 입력한 참고 자료/);assert.match(markup,/난이도는 AI 추정 또는 출판사 표시 기준/);assert.equal((markup.match(/사이트 응시자 통계가 아닙니다/g)||[]).length,1);
  assert.equal(markup.includes('난이도별 내 정답률'),true);
  assert.match(markup,/class="question-difficulty">쉬움/);assert.match(markup,/class="question-difficulty">어려움/);assert.match(markup,/class="question-difficulty">미분류/);
  assert.equal((markup.match(/class="question-difficulty"/g)||[]).length,3);
});
test('난이도 없는 정답 세트는 참고 정보 분석을 만들지 않는다',()=>{
  const set=validateAnswerSet({id:'simple',title:'정답만',sections:[{name:'수리',count:1,key:[3]}]});
  const exam=createExam({title:set.title,sections:set.sections.map(s=>({...s,start:1,end:1,minutes:1}))},'test');
  assert.equal(reportMarkup(exam).includes('해설집 참고 정보와 내 결과'),false);
  assert.match(reportMarkup(exam),/class="question-difficulty">미분류/);
});
test('메타데이터 길이·난이도·정답률 범위와 타입을 거절한다',()=>{
  for(const update of [{correctRate:[90]},{correctRate:[90,null,101]},{correctRate:[90,null,'70']},{difficulty:['낮음',null,'어려움']},{key:[1,2,6]}]){
    assert.throws(()=>validateAnswerSet({...input,sections:[{...input.sections[0],...update}]}));
  }
});

test('등록 시험 후 다른 문제집 수동 채점은 이전 정답과 참고값을 가져오지 않는다',()=>{
  const old=validateAnswerSet({...input,sections:[{...input.sections[0],tags:[['비율'],[],[]]}]}).sections[0];
  const cleared=clearAnswerMetadata({...old,minutes:15});assert.equal(cleared.name,old.name);assert.equal(cleared.minutes,15);
  for(const k of ['key','tags','difficulty','correctRate'])assert.equal(cleared[k],null);assert.equal(cleared.source,'');
  const reapplied=applyAnswerSet({sections:[cleared]},validateAnswerSet({...input,sections:[{...input.sections[0],tags:[['비율'],[],[]]}]}));assert.deepEqual(reapplied.sections[0].tags,[['비율'],[],[]]);
});


test('종료한 영역별 시험은 해당 영역만 재채점하고 응시 데이터는 보존한다',()=>{
  const set=validateAnswerSet({...input,sections:[{...input.sections[0],tags:[['새 유형'],[],[]]},{name:'다른 영역',count:1,key:[5]}]});
  const exam=createExam({title:'직접 입력',sections:[{name:'수리',count:3,minutes:1,start:1,end:1}]},'test');
  startSection(exam,0);submitSection(exam,1000);exam.sections[0].items[0].answer=1;exam.sections[0].items[0].uncertain=true;exam.reflection='메모';
  const before=structuredClone(exam),updated=regradeAnswerSet(exam,set);
  assert.equal(resultOf(updated.sections[0],0),'정답');assert.equal(updated.title,set.title);assert.equal(updated.sections.length,1);
  assert.deepEqual(updated.sections[0].key,[1,2,3]);assert.deepEqual(updated.sections[0].tags,[['새 유형'],[],[]]);
  assert.deepEqual(updated.sections[0].items,before.sections[0].items);assert.equal(updated.sections[0].elapsed,before.sections[0].elapsed);assert.equal(updated.reflection,'메모');
  assert.deepEqual(exam,before);
  const second=validateAnswerSet({...input,id:'other',title:'다른 회차',sections:[{...input.sections[0],key:[5,4,3]}]});
  const replaced=regradeAnswerSet(updated,second);assert.equal(resultOf(replaced.sections[0],0),'오답');assert.deepEqual(replaced.sections[0].key,[5,4,3]);assert.equal(replaced.sections[0].tags,null);
});

test('재채점은 영역 불일치·진행 중 시험을 거절하고 일치하는 세트만 표시한다',()=>{
  const exam=createExam({title:'시험',sections:[{name:'수리',count:3,minutes:1,start:1,end:1}]},'test');
  const set=validateAnswerSet(input);assert.throws(()=>regradeAnswerSet(exam,set),/종료 후/);
  startSection(exam,0);submitSection(exam,1000);
  const mismatch=validateAnswerSet({id:'mismatch',title:'다른 문항 수',sections:[{name:'수리',count:1,key:[1]}]});
  const before=structuredClone(exam);assert.throws(()=>regradeAnswerSet(exam,mismatch),/다릅니다/);assert.deepEqual(exam,before);
  const markup=reportMarkup(exam,[set,mismatch]);assert.match(markup,/value="practice-1"/);assert.doesNotMatch(markup,/value="mismatch"/);assert.match(markup,/선택한 정답 세트로 재채점/);
});
