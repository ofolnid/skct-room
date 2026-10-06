import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {mountTools,calculate} from '../src/tools.js';
const originalDocument=globalThis.document;
globalThis.document={createElement:()=>({textContent:''})};
after(()=>{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;});

function calculator(){
  const nodes=new Map();
  const node=()=>({value:'',textContent:'',focus(){},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},replaceChildren(){},append(){}});
  for(const id of ['#scratch-note','#calc-input','#calc-result','#calc-history','.calculator-box','#drawing','#clear-drawing','#undo-drawing'])nodes.set(id,node());
  nodes.get('#drawing').getContext=()=>({clearRect(){}});
  const buttons=['0','1','2','3','4','5','6','7','8','9','.', '(',')','+','-','×','÷','=','AC','backspace','%','+/-'].map(key=>({...node(),dataset:{calc:key}}));
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

test('연속 연산 기호는 버튼과 키보드에서 마지막 기호로 대체한다',()=>{
 for(const mode of ['button','keyboard']){
  const c=calculator();c.click('AC');
  for(const key of ['2','1','3','×','÷','-','+']){
   if(mode==='button')c.click(key);else c.box.onkeydown({key:key==='×'?'*':key==='÷'?'/':key,target:c.box,preventDefault(){}});
  }
  assert.equal(c.input.value,'213+');c.click('2');c.click('=');assert.equal(c.state.calculator.result,'215');
 }
});
test('직접 입력·붙여넣기도 기호를 대체하고 커서·상태를 맞춘다',()=>{
 const c=calculator();c.click('AC');c.input.value='213*/-+2';c.input.selectionStart=7;c.input.oninput();
 assert.equal(c.input.value,'213+2');assert.equal(c.input.selectionStart,4);assert.equal(c.state.calculator.expression,'213+2');
 c.click('=');assert.equal(c.state.calculator.result,'215');
});
test('연산 기호 교체 후 결과 이어 계산·음수·소수·괄호를 보존한다',()=>{
 const c=calculator();c.click('×');c.click('+');c.click('2');c.click('=');assert.equal(c.state.calculator.result,'72');
 c.click('AC');for(const key of ['-','2','.','1','+','(','-','3',')'])c.click(key);c.click('=');assert.equal(c.state.calculator.result,'-5.1');
 c.click('1');assert.equal(c.input.value,'1');
});

test('마지막 연산 기호 뒤 Enter는 오른쪽 값 0으로 계산한다',()=>{
 for(const [op,value] of [['-','5'],['+','5'],['×','2']]){const c=calculator();c.click('AC');for(const k of ['2','+','3',op,'='])c.click(k);assert.equal(c.state.calculator.result,value);}
 const c=calculator();c.click('AC');c.click('2');c.click('÷');c.click('=');assert.match(c.state.calculator.result,/0으로 나눌/);
});
test('각 숫자 소수점 중복은 차단하고 별도 숫자의 소수점은 허용한다',()=>{
 const c=calculator();c.click('AC');for(const k of ['1','.','.','2','+','3','.','.','4'])c.click(k);assert.equal(c.input.value,'1.2+3.4');c.click('=');assert.equal(c.state.calculator.result,'4.6');
 c.click('AC');c.input.value='1..2+3..4';c.input.selectionStart=10;c.input.oninput();assert.equal(c.input.value,'1.2+3.4');
});
test('오류 후 버튼·직접 수정은 안내를 지우고 정상 재계산한다',()=>{
 const c=calculator();c.click('AC');for(const k of ['1','÷','0','='])c.click(k);assert.match(c.state.calculator.result,/0으로/);c.click('backspace');assert.equal(c.state.calculator.result,'0');c.click('2');c.click('=');assert.equal(c.state.calculator.result,'0.5');
 c.click('AC');c.click('(');c.click('=');c.input.value='2+3';c.input.oninput();assert.equal(c.state.calculator.result,'0');c.click('=');assert.equal(c.state.calculator.result,'5');
});
test('퍼센트는 더하기·빼기에서 왼쪽 값의 비율, 곱하기·나누기에서 소수다',()=>{
 for(const [expression,value] of [['200+10%',220],['200-10%',180],['200×10%',20],['200÷10%',2000],['200+10%+10%',242],['10%',0.1],['(200+100)+10%',330]])assert.equal(calculate(expression),value);
});
test('등호 반복은 마지막 연산을 반복하고 새 입력·AC는 반복을 취소한다',()=>{
 for(const [op,second] of [['+',8],['-',-4],['×',18],['÷',2/9]]){const c=calculator();c.click('AC');for(const k of ['2',op,'3','=','='])c.click(k);assert.equal(Number(c.state.calculator.result),Number(second.toPrecision(12)));}
 const c=calculator();c.click('AC');for(const k of ['2','+','3','=','1','='])c.click(k);assert.equal(c.state.calculator.result,'1');c.click('AC');c.click('2');c.click('=');c.click('=');assert.equal(c.state.calculator.result,'2');
});
test('작거나 큰 지수 표기 결과도 이어 계산 가능하며 비유한 값은 거절한다',()=>{
 assert.equal(calculate('1e-7×2'),2e-7);assert.equal(calculate('1e+21+1e+21'),2e21);assert.throws(()=>calculate('1e309'));
 const c=calculator();c.click('AC');c.input.value='1/10000000';c.input.oninput();c.click('=');assert.equal(c.input.value,'1e-7');c.click('×');c.click('2');c.click('=');assert.equal(c.state.calculator.result,'2e-7');
});
