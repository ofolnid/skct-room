import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateAnswerSet,applyAnswerSet,regradeAnswerSet} from '../src/answer-sets.js';
import {createExam} from '../src/core.js';
import {reportMarkup,copyContent,csvContent} from '../src/report.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/answer-sets.json',import.meta.url)));
const raw=data.find(s=>s.id==='linkareer-2026-h1-mock-2');
const areas=['언어이해','자료해석','창의수리','언어추리','수열추리'];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('링커리어 2026 상반기 2회 정답·제공 정답률 100개를 번호 순서대로 보존한다',()=>{
 assert.equal(data.length,16);assert.equal(raw.title,'링커리어 2026 상반기 2회');
 const set=validateAnswerSet(raw);assert.deepEqual(set.sections.map(s=>s.name),areas);
 assert.equal(hash(set.sections.flatMap(s=>s.key)),'31d285cead7b121214977a001d8cdc5af98a38d45f197287537f0a130a7a0c98');
 assert.equal(hash(set.sections.flatMap(s=>s.correctRate)),'51b4130eae333f15b2db5e4d6df916df89c716d45c36527831aaa916e554da63');
 for(const s of set.sections){assert.equal(s.count,20);assert.equal(s.tags.length,20);assert.ok(s.tags.every(t=>t.length===1));assert.equal(s.difficulty.length,20);assert.ok(s.difficulty.every(x=>['쉬움','보통','어려움'].includes(x)));assert.match(s.source,/AI 추정/);assert.match(s.source,/사용자 제공 링커리어 정답률/);}
 assert.equal(set.sections[4].key[2],3);
});
test('전체와 단일 영역에 정답·유형·난이도·정답률을 동일하게 적용한다',()=>{
 const set=validateAnswerSet(raw);const full=applyAnswerSet({sections:areas.map(name=>({name,count:20}))},set);
 for(const [i,s] of set.sections.entries()){
  const one=applyAnswerSet({sections:[{name:s.name,count:20}]},set).sections[0];
  for(const field of ['key','tags','difficulty','correctRate','source']){assert.deepEqual(one[field],s[field]);assert.deepEqual(full.sections[i][field],s[field]);}
 }
});
test('링커리어 참고값을 결과·복사·CSV에 표시하고 재채점에서 내 답·시간을 보존한다',()=>{
 const set=validateAnswerSet(raw);const config=applyAnswerSet({title:set.title,mode:'single',pdfRange:{start:1,end:100},sections:[{name:'수열추리',count:20,minutes:15}]},set);
 const exam=createExam(config,'test-pdf',0);exam.phase='finished';exam.sections[0].items[2]={answer:3,status:'answered',ms:12345,guessed:false,uncertain:true};
 const markup=reportMarkup(exam),copied=copyContent(exam),csv=csvContent(exam);
 for(const text of [markup,copied.text,csv]){assert.match(text,/41.8%/);assert.match(text,/등비수열/);assert.match(text,/보통/);}
 assert.match(markup,/사이트 응시자 통계가 아닙니다/);
 const regraded=regradeAnswerSet(exam,set);assert.deepEqual(regraded.sections[0].items,exam.sections[0].items);assert.equal(regraded.sections[0].correctRate[2],41.8);
});
