import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateAnswerSet,applyAnswerSet} from '../src/answer-sets.js';
const data=JSON.parse(fs.readFileSync(new URL('../src/answer-sets.json',import.meta.url)));
const areas=['언어이해','자료해석','창의수리','언어추리','수열추리'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const expected={
 eduwill:{key:'473cec2b16b95e9e131d158b2fb9eaa64b720ca0cdffbb642a5c649020c9de01',metadata:'85e51b93c173414cbbc285eab1e83cb8421a7edcf16a94e674303cad204526b7',difficulty:[83,254,63,0]},
 hackers:{key:'90f10375290e98414be0fc7f7d9ab34c951f1c9363e738251149566d479ebe11',metadata:'a4e6ac52694b2302578691eca48dc261363dedab1144746b8e685f5f7df97476',difficulty:[43,301,55,1]},
 sidae:{key:'369827990737f5a33fce779c236eefac748889b5378fefe7f14b6be3027e5379',metadata:'6a2580d4393d4d0da129f7bad6bea7b2c1890143a9e4c0c1f88b574d01c0bc59',difficulty:[95,241,62,2]}
};
for(const [publisher,reference] of Object.entries(expected))test(`${publisher} 본책 대조 유형·난이도를 반영하고 원래 400정답을 보존한다`,()=>{
 const raw=data.filter(s=>s.id.startsWith(publisher+'-'));const sets=raw.map(validateAnswerSet);
 assert.equal(sets.length,4);assert.equal(hash(raw.map(s=>s.sections.map(a=>a.key))),reference.key);
 assert.equal(hash(raw.map(s=>s.sections.map(a=>({tags:a.tags,difficulty:a.difficulty})))),reference.metadata);
 const levels=sets.flatMap(s=>s.sections.flatMap(a=>a.difficulty));
 assert.deepEqual(['쉬움','보통','어려움',null].map(v=>levels.filter(x=>x===v).length),reference.difficulty);
 for(const set of sets){
  assert.deepEqual(set.sections.map(s=>s.name),areas);
  const all=applyAnswerSet({sections:areas.map(name=>({name,count:20}))},set);
  for(const [i,s] of set.sections.entries()){
   assert.equal(s.count,20);assert.equal(s.tags.length,20);assert.ok(s.tags.every(ts=>ts.length>0));
   assert.equal(s.difficulty.length,20);assert.equal(s.correctRate,null);assert.match(s.source,/AI.*추정/);
   const one=applyAnswerSet({sections:[{name:s.name,count:20}]},set).sections[0];
   for(const field of ['key','tags','difficulty','correctRate','source']){assert.deepEqual(one[field],s[field]);assert.deepEqual(all.sections[i][field],s[field]);}
  }
 }
});
test('12세트의 ID·회차 이름을 유지하고 참고 난이도 3문항은 보류한다',()=>{
 assert.equal(data.length,12);assert.equal(new Set(data.map(s=>s.id)).size,12);
 const titles={eduwill:'2026 에듀윌 통합 기본서 · 실전모의고사',hackers:'2026 해커스 통합 기본서 · 실전모의고사',sidae:'2026 시대에듀 통합기본서 · 최종점검 모의고사'};
 const missing=[];
 for(const set of data){
  const publisher=set.id.split('-')[0],round=Number(set.id.split('-').at(-1));
  assert.equal(set.title,`${titles[publisher]} ${round}회`);
  for(const s of set.sections)for(const [i,v] of s.difficulty.entries())if(v===null)missing.push([set.id,s.name,i+1]);
 }
 assert.deepEqual(missing,[['hackers-2026-mock-4','창의수리',7],['sidae-2026-mock-2','수열추리',8],['sidae-2026-mock-3','수열추리',13]]);
});

test('창의수리 유형은 승인한 5묶음으로 통합하며 240문항을 중복 없이 보존한다',()=>{
 const sections=data.map(s=>s.sections.find(a=>a.name==='창의수리'));
 const counts=new Map();for(const a of sections)for(const tags of a.tags){assert.equal(tags.length,1);counts.set(tags[0],(counts.get(tags[0])||0)+1);}
 assert.equal(counts.size,16);assert.equal([...counts.values()].reduce((a,b)=>a+b),240);
 for(const [tag,n] of [['약수·배수',13],['평균',6],['방정식·부등식',25],['비율·증감',22],['손익·비용',33]])assert.equal(counts.get(tag),n);
});
