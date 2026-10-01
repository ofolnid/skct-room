import { confirmAction } from './dialog.js';
export function calculate(expression) {
  if (expression.length>200) throw new Error('수식이 너무 깁니다.');
  const clean=expression.replace(/\s/g,'').replace(/×/g,'*').replace(/÷/g,'/');
  const tokens=clean.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g) || [];
  if (tokens.join('')!==clean || !tokens.length) throw new Error('수식을 확인해 주세요.');
  let i=0;
  function primary() {
    let v;
    if (tokens[i]==='+') { i++; v=primary(); }
    else if (tokens[i]==='-') { i++; v=-primary(); }
    else if (tokens[i]==='(') { i++; v=sum(); if(tokens[i++]!==')') throw new Error('괄호를 확인해 주세요.'); }
    else { const t=tokens[i++]; if(!t || !/^(?:\d|\.)/.test(t)) throw new Error('수식을 확인해 주세요.'); v=Number(t); }
    while(tokens[i]==='%') { i++; v/=100; }
    return v;
  }
  function product() { let v=primary(); while(['*','/'].includes(tokens[i])) { const op=tokens[i++],rhs=primary(); if(op==='/' && rhs===0) throw new Error('0으로 나눌 수 없습니다.'); v=op==='*'?v*rhs:v/rhs; } return v; }
  function sum() { let v=product(); while(['+','-'].includes(tokens[i])) { const op=tokens[i++],rhs=product(); v=op==='+'?v+rhs:v-rhs; } return v; }
  const result=sum(); if(i!==tokens.length || !Number.isFinite(result)) throw new Error('계산할 수 없는 수식입니다.');
  return Number(result.toPrecision(12));
}
export function mountTools(container, state, onChange) {
  const memo=container.querySelector('#scratch-note'); memo.value=state.memo || '';
  memo.oninput=()=>{state.memo=memo.value.slice(0,15000);onChange();};
  container.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{
    container.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));
    container.querySelectorAll('[data-tool-panel]').forEach(p=>p.hidden=p.dataset.toolPanel!==button.dataset.tool);
  });
  state.calculator ??= {expression:'',result:'0'};
  let expression=state.calculator.expression, completed=!!state.calculator.completed;
  let history=(state.calculator.history||[]).slice(-2);
  const input=container.querySelector('#calc-input');input.value=expression;
  const result=container.querySelector('#calc-result');result.textContent=state.calculator.result;
  function renderHistory(){
    const box=container.querySelector('#calc-history');box.replaceChildren();
    history.forEach(entry=>{const row=document.createElement('div');row.textContent=`${entry.expression} = ${entry.result}`;box.append(row);});
  }
  function saveCalc(){state.calculator={expression:input.value,result:result.textContent,completed,history};onChange();}
  function fresh(key){
    if(!completed)return;
    if(!/^[+\-*/×÷%]$/.test(key)&&key!=='+/-'){expression='';input.value='';}
    else input.setSelectionRange(input.value.length,input.value.length);
    result.textContent='0';completed=false;
  }
  function clear(){expression='';input.value='';result.textContent='0';completed=false;saveCalc();}
  function erase(){if(completed)result.textContent='0';completed=false;expression=input.value.slice(0,-1);input.value=expression;saveCalc();}
  function equals(){
    if(completed)return;
    try{
      const original=input.value,value=String(calculate(original));
      history=[...history,{expression:original,result:value}].slice(-2);renderHistory();
      result.textContent=value;expression=value;input.value=value;completed=true;
    }catch(err){result.textContent=err.message;}
    saveCalc();
  }
  input.onbeforeinput=event=>{if(completed&&event.inputType.startsWith('insert'))fresh(event.data);};
  input.oninput=()=>{if(completed)result.textContent='0';expression=input.value;completed=false;saveCalc();};
  container.querySelector('.calculator-box').onkeydown=event=>{
    if(event.metaKey||event.ctrlKey||event.altKey)return;
    if(event.key==='Enter'){event.preventDefault();equals();return;}
    if(event.key==='Escape'){event.preventDefault();clear();return;}
    if(event.target===input)return;
    if(/^[0-9.+\-*/()%]$/.test(event.key)||event.key==='Backspace'){
      event.preventDefault();if(event.key==='Backspace'){erase();return;}fresh(event.key);expression=input.value+event.key;
      input.value=expression.slice(0,200);saveCalc();
    }
  };
  container.querySelectorAll('[data-calc]').forEach(button=>button.onclick=()=>{
    const key=button.dataset.calc;
    if(key==='='){equals();return;}
    if(key==='AC'){clear();input.focus();return;}
    if(key==='backspace'){erase();input.focus();return;}
    fresh(key);
    if(key==='+/-')expression=input.value.startsWith('-(')?input.value.slice(2,-1):`-(${input.value||'0'})`;
    else expression=input.value.length<200?input.value+key:input.value;
    input.value=expression;saveCalc();input.focus();
  });
  renderHistory();
  const canvas=container.querySelector('#drawing'), ctx=canvas.getContext('2d');
  let current=null;
  function line(stroke){ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();stroke.points.forEach((p,i)=>i?ctx.lineTo(p[0]*canvas.width,p[1]*canvas.height):ctx.moveTo(p[0]*canvas.width,p[1]*canvas.height));ctx.stroke();}
  function repaint(){ctx.clearRect(0,0,canvas.width,canvas.height);(state.drawings||[]).forEach(line);if(current)line(current);}
  function point(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];}
  canvas.onpointerdown=e=>{ if(e.button!==0)return; canvas.setPointerCapture(e.pointerId);current={color:container.querySelector('#pen-color').value,width:Number(container.querySelector('#pen-width').value),points:[point(e)]};current.points.push([current.points[0][0]+0.0001,current.points[0][1]+0.0001]);repaint(); };
  canvas.onpointermove=e=>{if(!current)return; if(current.points.length<5000)current.points.push(point(e));repaint();};
  const end=()=>{if(!current)return;state.drawings.push(current);current=null;onChange();repaint();};canvas.onpointerup=end;canvas.onpointercancel=end;
  container.querySelector('#clear-drawing').onclick=async()=>{if(!state.drawings.length)return;if(await confirmAction('그림판 내용을 모두 지울까요?','모두 지우기')){state.drawings=[];onChange();repaint();}};
  container.querySelector('#undo-drawing').onclick=()=>{state.drawings.pop();onChange();repaint();};
  repaint();
}
export function toolsMarkup() {
  return `<div class="tools-box"><div class="tool-tabs"><button class="active" data-tool="note">메모장</button><button data-tool="draw">그림판</button></div>
  <div data-tool-panel="note"><textarea id="scratch-note" maxlength="15000" placeholder="계산 과정과 생각을 자유롭게 적어 보세요." aria-label="시험 메모장"></textarea><span class="subtle">다음 문제로 넘어가면 도구가 초기화됩니다.</span></div>
  <div data-tool-panel="draw" hidden><div class="drawing-controls"><label>색상 <input type="color" id="pen-color" value="#23463e"></label><label>굵기 <select id="pen-width"><option value="3">얇게</option><option value="6">보통</option><option value="10">굵게</option></select></label><button id="undo-drawing" class="text-button">한 획 취소</button><button id="clear-drawing" class="text-button">전체 지우기</button></div><canvas id="drawing" width="900" height="360" aria-label="풀이 그림판"></canvas></div>
  </div><div class="calculator-box" tabindex="0" aria-label="계산기"><div class="calculator-heading"><strong>계산기</strong><span>Enter 계산 · Esc 초기화</span></div><div id="calc-history" aria-label="최근 계산 기록"></div><label class="sr-only" for="calc-input">계산 수식</label><input id="calc-input" maxlength="200" placeholder="수식을 입력하거나 버튼을 누르세요" autocomplete="off"><output id="calc-result">0</output><div class="calc-grid">${['(',')','%','backspace','AC','+/-','÷','×','7','8','9','-','4','5','6','+','1','2','3','=','0','.'].map(k=>`<button data-calc="${k}" class="${k==='='?'equals':''}" ${k==='backspace'?'aria-label="한 글자 지우기" title="한 글자 지우기"':k==='AC'?'aria-label="전체 지우기" title="전체 지우기"':''}>${k==='backspace'?'⌫':k}</button>`).join('')}</div></div>`;
}
