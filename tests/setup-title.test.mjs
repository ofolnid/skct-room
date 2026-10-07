import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clearAnswerMetadata} from '../src/answer-sets.js';
import {validateConfig} from '../src/core.js';
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const configLine=source.split('\n').find(line=>line.startsWith('function currentConfig()'));
function readConfig(key,title){
  const values={'#key-select':key,'#exam-title':title,'#range-start':'1','#range-end':'3'};
  const app={querySelector:selector=>({value:values[selector]})};
  const config={title:'이전 시험',sections:[{name:'언어이해',count:20,minutes:15,key:Array(20).fill(1)}]};
  return new Function('app','library','config','examMode','selectedKey','clearAnswerMetadata',`const breakMode='free',timeMode='timed';${configLine};return currentConfig();`)(app,[{id:'test-set',title:'등록된 모의고사 1회'}],config,'single',key,clearAnswerMetadata);
}
test('정답 세트를 선택하면 직접 입력한 이전 제목 대신 세트 제목을 쓴다',()=>{
  const result=readConfig('test-set','이전 자유 문제집');
  assert.equal(result.title,'등록된 모의고사 1회');assert.equal(result.sections[0].key,null);
  assert.equal(validateConfig(result).title,'등록된 모의고사 1회');
});
test('직접 채점은 입력한 제목을 쓰고 빈 제목을 거절한다',()=>{
  assert.equal(readConfig('','나의 자유 문제집').title,'나의 자유 문제집');
  assert.throws(()=>validateConfig(readConfig('','')));
});
