import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnswerSet,applyAnswerSet,clearAnswerMetadata } from '../src/answer-sets.js';
import { createExam,startSection,submitSection } from '../src/core.js';
import { reportMarkup } from '../src/report.js';
const input={id:'practice-1',title:'직접 작성한 시험',sections:[{name:'수리',count:3,key:[1,2,3],difficulty:['쉬움',null,'어려움'],correctRate:[90,null,0],source:'직접 입력한 참고 자료'}]};
test('배포 정답 세트의 선택적 정보와 0% 참고값을 보존한다',()=>{
  const set=validateAnswerSet(input);assert.deepEqual(set.sections[0].correctRate,[90,null,0]);
  const exam=createExam({title:set.title,sections:set.sections.map(s=>({...s,start:1,end:1,minutes:1}))},'test');
  startSection(exam,0);submitSection(exam,1000);const markup=reportMarkup(exam);
  assert.match(markup,/참고 정답률 0%/);assert.match(markup,/직접 입력한 참고 자료/);
  assert.equal(markup.includes('난이도별 내 정답률'),true);
});
test('난이도 없는 정답 세트는 참고 정보 분석을 만들지 않는다',()=>{
  const set=validateAnswerSet({id:'simple',title:'정답만',sections:[{name:'수리',count:1,key:[3]}]});
  const exam=createExam({title:set.title,sections:set.sections.map(s=>({...s,start:1,end:1,minutes:1}))},'test');
  assert.equal(reportMarkup(exam).includes('해설집 참고 정보와 내 결과'),false);
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
