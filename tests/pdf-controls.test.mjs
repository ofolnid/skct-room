import test from 'node:test';
import assert from 'node:assert/strict';
import {mountZoomInput} from '../src/pdf-controls.js';
function setup(){const input={value:''},calls=[],errors=[];mountZoomInput(input,100,v=>calls.push(v),e=>errors.push(e));return {input,calls,errors};}
test('PDF 배율을 축소·확대·직접 입력하며 Enter와 변경 이벤트는 중복 적용하지 않는다',()=>{
 const {input,calls,errors}=setup();assert.equal(input.value,'100');
 for(const value of [25,50,75,88,125,300]){input.value=String(value);input.onkeydown({key:'Enter',preventDefault(){}});input.onchange();input.onblur();}
 assert.deepEqual(calls,[25,50,75,88,125,300]);assert.deepEqual(errors,[]);
});
test('빈 값·범위 밖·잘못된 배율은 기존 배율로 복원하고 뷰어에 넘기지 않는다',()=>{
 const {input,calls,errors}=setup();input.value='75';input.onchange();
 for(const value of ['', '0','24','301','Infinity','abc','75.5']){input.value=value;input.onchange();assert.equal(input.value,'75');}
 assert.deepEqual(calls,[75]);assert.equal(errors.length,7);
});
