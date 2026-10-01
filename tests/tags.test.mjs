import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTags,createExam} from '../src/core.js';
import {validateAnswerSet,applyAnswerSet} from '../src/answer-sets.js';
import {tagSummary,tagMarkup} from '../src/tags.js';
import {copyContent,csvContent,resultHeaders,resultRows,reportMarkup} from '../src/report.js';
const section={name:'언어추리',count:4,minutes:1,key:[1,1,1,1],tags:[['참·거짓'],['참·거짓'],['참·거짓','조건 추론'],['조건 추론']]};
function fixture(){const exam=createExam({title:'태그 검증',pdfRange:{start:1,end:1},sections:[section]},'test');exam.sections[0].items=[{answer:1,status:'answered',ms:1000},{answer:1,status:'answered',ms:1000,guessed:true},{answer:2,status:'answered',ms:1000},{answer:null,status:'unreached',ms:0}];return exam;}
test('태그 구조·문항 수·중복·잘못된 값을 거절한다',()=>{
  assert.deepEqual(validateTags([[' 참·거짓 '],[]],2),[['참·거짓'],[]]);
  for(const bad of [[['x']],['x',[]],[['x','x'],[]],[[null],[]],[["x".repeat(25)],[]]])assert.throws(()=>validateTags(bad,2));
});
test('영역별 정답 매칭과 시험 복구에서 태그를 보존한다',()=>{
  const set=validateAnswerSet({id:'tags',title:'유형',sections:[section,{name:'수리',count:1,key:[2],tags:[['비율']]}]});
  const config=applyAnswerSet({title:'유형',pdfRange:{start:1,end:1},sections:[{name:'수리',count:1,minutes:1}]},set);
  assert.deepEqual(JSON.parse(JSON.stringify(createExam(config,'test'))).sections[0].tags,[['비율']]);
});
test('미도달 제외·복수 태그·찍은 정답·표본 부족을 구분한다',()=>{
  const groups=tagSummary(fixture());assert.equal(groups[0].attempts,3);assert.equal(groups[0].correct,2);assert.equal(groups[0].unmarked,1);assert.equal(groups[0].guessed,1);assert.equal(groups[0].label,'재확인');assert.equal(groups[1].unreached,1);assert.equal(groups[1].label,'표본 부족');
  const exam=fixture();exam.sections[0].items[1].answer=2;assert.equal(tagSummary(exam)[0].label,'보완할 유형');
  exam.sections[0].items.slice(0,3).forEach(i=>{i.answer=1;i.guessed=false;});assert.equal(tagSummary(exam)[0].label,'강점 후보');exam.sections[0].items[0].ms=60000;assert.equal(tagSummary(exam)[0].label,'시간 관리');
});
test('미채점은 강점 판정을 하지 않고 영역별로 별도 집계한다',()=>{
  const exam=fixture();exam.sections.push({...exam.sections[0],name:'다른 영역',key:null});const groups=tagSummary(exam);assert.equal(groups.length,4);assert.equal(groups[2].attempts,0);assert.equal(groups[2].rate,null);
});
test('태그와 분석을 화면·복사·CSV에 포함하고 HTML을 이스케이프한다',()=>{
  const exam=fixture();exam.sections[0].tags[0].push('<script>');const copy=copyContent(exam);
  assert.match(copy.text,/유형별 강점·보완점/);assert.match(copy.text,/3문항 미만/);assert.match(copy.html,/해설 기반/);assert.match(csvContent(exam),/中복|중복/);assert.match(copy.html,/&lt;script&gt;/);assert.match(reportMarkup(exam),/유형별 강점·보완점/);assert.match(csvContent(exam),/문항 유형/);assert.match(csvContent(exam),/표본 부족/);assert.equal(resultRows(exam)[0].length,resultHeaders(exam).length);
});

test('영역별 유형 카드와 오답 표시 개수·비율을 함께 집계한다',()=>{
 const exam=fixture();exam.sections[0].items[0].uncertain=true;exam.sections[0].items[0].answer=2;
 const g=tagSummary(exam)[0];assert.equal(g.uncertainCount,1);assert.equal(g.uncertain,0);
 const html=tagMarkup(exam);assert.match(html,/type-area/);assert.match(html,/헷갈림 1개 · 33%/);assert.match(html,/<details class="type-category type-sample"/);assert.match(copyContent(exam).text,/헷갈림 전체/);
});
