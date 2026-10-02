import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateAnswerSet,applyAnswerSet} from '../src/answer-sets.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/answer-sets.json',import.meta.url)));
test('원본 이미지 대조한 에듀윌 4회 400정답을 보존하고 모든 영역에 매칭한다',()=>{
  const eduwill=data.filter(s=>s.id.startsWith('eduwill-'));const sets=eduwill.map(validateAnswerSet);assert.equal(sets.length,4);assert.equal(new Set(sets.map(s=>s.id)).size,4);
  for(const set of sets){assert.deepEqual(set.sections.map(s=>s.name),['언어이해','자료해석','창의수리','언어추리','수열추리']);for(const s of set.sections){assert.equal(s.count,20);assert.deepEqual(applyAnswerSet({sections:[{name:s.name,count:20}]},set).sections[0].key,s.key);}}
  assert.equal(createHash('sha256').update(JSON.stringify(eduwill.map(s=>s.sections.map(a=>a.key)))).digest('hex'),'473cec2b16b95e9e131d158b2fb9eaa64b720ca0cdffbb642a5c649020c9de01');
});

test('원본 확대 대조한 해커스 4회 400정답·유형을 모든 영역에 매칭한다',()=>{
  const hackers=data.filter(s=>s.id.startsWith('hackers-'));const sets=hackers.map(validateAnswerSet);
  assert.equal(data.length,12);assert.equal(new Set(data.map(s=>s.id)).size,12);assert.equal(sets.length,4);
  for(const set of sets){
    assert.deepEqual(set.sections.map(s=>s.name),['언어이해','자료해석','창의수리','언어추리','수열추리']);
    for(const section of set.sections){
      assert.equal(section.count,20);assert.equal(section.tags.length,20);assert.ok(section.tags.every(tags=>tags.length===1));
      assert.equal(section.difficulty,null);assert.equal(section.correctRate,null);
      const applied=applyAnswerSet({sections:[{name:section.name,count:20}]},set).sections[0];
      assert.deepEqual(applied.key,section.key);assert.deepEqual(applied.tags,section.tags);
    }
  }
  assert.equal(createHash('sha256').update(JSON.stringify(hackers.map(s=>s.sections.map(a=>a.key)))).digest('hex'),'90f10375290e98414be0fc7f7d9ab34c951f1c9363e738251149566d479ebe11');
  assert.equal(createHash('sha256').update(JSON.stringify(hackers.map(s=>s.sections.map(a=>a.tags)))).digest('hex'),'9c1bd57f403ad630aba9b33d0046ac518aad576813bc514bea19d558d92ca611');
});


test('시대에듀 최종점검 4회 400정답은 원본 대조값과 일치하고 영역별로 매칭된다',()=>{
 const raw=data.filter(s=>s.id.startsWith('sidae-'));const sets=raw.map(validateAnswerSet);assert.equal(sets.length,4);
 assert.equal(raw.flatMap(s=>s.sections.flatMap(a=>a.tags)).filter(t=>t.length).length,368);
 assert.equal(createHash('sha256').update(JSON.stringify(raw.map(s=>s.sections.map(a=>a.tags)))).digest('hex'),'a703e19db3ee9341558d2da963dc78ce077958a3588df6ce1c34066f1470ef9b');
 assert.equal(createHash('sha256').update(JSON.stringify(raw.map(s=>s.sections.map(a=>a.key)))).digest('hex'),'369827990737f5a33fce779c236eefac748889b5378fefe7f14b6be3027e5379');
 for(const [i,set]of sets.entries()){
  assert.equal(set.title,`2026 시대에듀 통합기본서 · 최종점검 모의고사 ${i+1}회`);
  assert.deepEqual(set.sections.map(s=>s.name),['언어이해','자료해석','창의수리','언어추리','수열추리']);
  for(const s of set.sections){assert.equal(s.count,20);assert.equal(s.tags.length,20);assert.equal(s.difficulty,null);assert.equal(s.correctRate,null);assert.match(s.source,/해설 기반 AI 추정/);const applied=applyAnswerSet({sections:[{name:s.name,count:20}]},set).sections[0];assert.deepEqual(applied.key,s.key);assert.deepEqual(applied.tags,s.tags);}
 }
});
