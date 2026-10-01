import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {mountTools} from '../src/tools.js';
const originalDocument=globalThis.document;
globalThis.document={createElement:()=>({textContent:''})};
after(()=>{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;});

function calculator(){
  const nodes=new Map();
  const node=()=>({value:'',textContent:'',focus(){},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},replaceChildren(){},append(){}});
  for(const id of ['#scratch-note','#calc-input','#calc-result','#calc-history','.calculator-box','#drawing','#clear-drawing','#undo-drawing'])nodes.set(id,node());
  nodes.get('#drawing').getContext=()=>({clearRect(){}});
  const buttons=['1','2','+','-','×','÷','=','AC','backspace','%','+/-'].map(key=>({...node(),dataset:{calc:key}}));
  const container={querySelector:s=>nodes.get(s),querySelectorAll:s=>s==='[data-calc]'?buttons:[]};
  const state={drawings:[],calculator:{expression:'70',result:'70',completed:true,history:[{expression:'7*10',result:'70'}]}};
  mountTools(container,state,()=>{});
  return {state,input:nodes.get('#calc-input'),box:nodes.get('.calculator-box'),click:key=>buttons.find(b=>b.dataset.calc===key).onclick()};
}

test('결과 뒤 버튼 숫자는 새 계산, 연산 기호는 결과에 이어서 계산한다',()=>{
  const fresh=calculator();fresh.click('1');assert.equal(fresh.state.calculator.expression,'1');assert.equal(fresh.state.calculator.result,'0');
  for(const [op,result] of [['+','72'],['-','68'],['×','140'],['÷','35']]){
    const c=calculator();c.click(op);assert.equal(c.input.value,'70'+op);c.click('2');c.click('=');assert.equal(c.state.calculator.result,result);
    assert.equal(c.state.calculator.history.length,2);
    c.click('1');assert.equal(c.input.value,'1');
  }
});

test('계산기 영역 키보드 입력도 숫자 초기화와 연산 이어가기를 구분한다',()=>{
  for(const [key,value] of [['1','1'],['+','70+'],['-','70-'],['*','70*'],['/','70/']]){
    const c=calculator();c.box.onkeydown({key,target:c.box,preventDefault(){}});assert.equal(c.input.value,value);assert.equal(c.state.calculator.completed,false);
  }
});

test('입력란의 직접 입력은 선택된 결과에서도 연산은 끝에 이어붙이고 숫자는 초기화한다',()=>{
  for(const [key,value] of [['1','1'],['+','70+']]){
    const c=calculator();c.input.selectionStart=0;c.input.selectionEnd=2;
    c.input.onbeforeinput({inputType:'insertText',data:key});
    if(key==='+')assert.equal(c.input.selectionStart,2);
    c.input.value+=key;c.input.oninput();assert.equal(c.input.value,value);assert.equal(c.state.calculator.completed,false);
  }
});
