import test from 'node:test';
import assert from 'node:assert/strict';
import {clearToolData,toolsMarkup} from '../src/tools.js';
const state=()=>({memo:'메모 내용',drawings:[{points:[[0,0],[1,1]],width:3,color:'#111'}],calculator:{expression:'2+3',result:'5',history:[{result:'5'}]},phase:'running',deadline:900000,questionStartedAt:100,selection:3,selectionFlags:{guessed:true}});
test('메모 삭제는 그림판·계산기·답안·타이머를 보존한다',()=>{const s=state(),before=structuredClone(s);assert.equal(clearToolData(s,'note'),true);assert.deepEqual(s,{...before,memo:''});});
test('그림 삭제는 메모장·계산기·답안·타이머를 보존한다',()=>{const s=state(),before=structuredClone(s);assert.equal(clearToolData(s,'draw'),true);assert.deepEqual(s,{...before,drawings:[]});});
test('독립 삭제 버튼은 각각 하나이고 알 수 없는 도구 삭제는 상태를 바꾸지 않는다',()=>{const s=state(),before=structuredClone(s);assert.equal(clearToolData(s,'all'),false);assert.deepEqual(s,before);const html=toolsMarkup();for(const id of ['clear-note','clear-drawing'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1);assert.match(html,/data-clear-tool="draw"[^>]*hidden/);});
