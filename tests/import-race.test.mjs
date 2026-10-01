import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateConfig} from '../src/core.js';

// Exercise the actual async UI callback with controlled file-read completion.
const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const line=source.split('\n').find(s=>s.includes("querySelector('#config-file').onchange="));
const callback=line.slice(line.indexOf('=async')+1).replace(/;$/,'');
const names=['언어이해','자료해석','창의수리','언어추리','수열추리'];
const input={title:'설정 복구',mode:'single',pdfRange:{start:1,end:1},sections:[{name:'언어이해',count:20,minutes:15}]};
function harness(){
  return new Function('validateConfig','subjectNames',`
    let examMode='single',config={},fullSections=subjectNames.map(name=>({name})),singleSubject=subjectNames[0],selectedKey='',library=[],view='setup',busy=false;
    const disabled=[],messages=[];let renders=0;
    function disableSetup(value){disabled.push(value);}
    function renderSetup(){renders++;view='setup';}
    function notify(message){messages.push(message);}
    const handler=${callback};
    return {handler,get:()=>({busy,disabled,messages,renders,config}),tryPrepare:()=>!busy};
  `)(validateConfig,names);
}
function event(file){return {target:{files:file?[file]:[]}};}
test('설정 읽기 대기 중 준비·복구와 중복 가져오기를 막고 완료 후 해제한다',async()=>{
  const h=harness();let resolveRead,secondReads=0;
  const pending=h.handler(event({size:100,text:()=>new Promise(resolve=>{resolveRead=resolve;})}));
  assert.equal(h.get().busy,true);assert.deepEqual(h.get().disabled,[true]);assert.equal(h.tryPrepare(),false);
  await h.handler(event({size:100,text:async()=>{secondReads++;return JSON.stringify(input);}}));
  assert.equal(secondReads,0);assert.equal(h.get().renders,0);
  resolveRead(JSON.stringify(input));await pending;
  assert.equal(h.get().busy,false);assert.deepEqual(h.get().disabled,[true,false]);assert.equal(h.get().renders,1);assert.equal(h.get().config.title,input.title);
});
test('설정 읽기 실패 및 잘못된 JSON에서도 잠금을 해제하고 재입력한다',async()=>{
  for(const text of [async()=>{throw new Error('읽기 실패');},async()=>'{invalid']){
    const h=harness();await h.handler(event({size:100,text}));
    assert.equal(h.get().busy,false);assert.deepEqual(h.get().disabled,[true,false]);assert.equal(h.get().renders,0);assert.equal(h.get().messages.length,1);
    await h.handler(event({size:100,text:async()=>JSON.stringify(input)}));assert.equal(h.get().renders,1);assert.equal(h.get().busy,false);
  }
});
test('선택 취소와 크기 제한 오류에서도 준비 화면을 다시 사용할 수 있다',async()=>{
  for(const file of [null,{size:1024*1024+1,text:async()=>{throw new Error('읽으면 안 됨');}}]){
    const h=harness();await h.handler(event(file));assert.equal(h.get().busy,false);assert.deepEqual(h.get().disabled,[true,false]);assert.equal(h.get().renders,0);assert.equal(h.tryPrepare(),true);
  }
});
