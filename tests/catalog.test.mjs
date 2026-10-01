import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateAnswerSet,applyAnswerSet} from '../src/answer-sets.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/answer-sets.json',import.meta.url)));
test('원본 이미지 대조한 에듀윌 4회 400정답을 보존하고 모든 영역에 매칭한다',()=>{
  const sets=data.map(validateAnswerSet);assert.equal(sets.length,4);assert.equal(new Set(sets.map(s=>s.id)).size,4);
  for(const set of sets){assert.deepEqual(set.sections.map(s=>s.name),['언어이해','자료해석','창의수리','언어추리','수열추리']);for(const s of set.sections){assert.equal(s.count,20);assert.deepEqual(applyAnswerSet({sections:[{name:s.name,count:20}]},set).sections[0].key,s.key);}}
  assert.equal(createHash('sha256').update(JSON.stringify(data.map(s=>s.sections.map(a=>a.key)))).digest('hex'),'473cec2b16b95e9e131d158b2fb9eaa64b720ca0cdffbb642a5c649020c9de01');
});
