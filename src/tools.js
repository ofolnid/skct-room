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
let expression='';
export function mountTools(container, state, onChange) {
  const memo=container.querySelector('#scratch-note'); memo.value=state.memo || '';
  memo.oninput=()=>{state.memo=memo.value.slice(0,15000);onChange();};
  container.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{
    container.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b===button));
    container.querySelectorAll('[data-tool-panel]').forEach(p=>p.hidden=p.dataset.toolPanel!==button.dataset.tool);
  });
  const input=container.querySelector('#calc-input'); input.value=expression;
  const result=container.querySelector('#calc-result');
  function equals(){ try { const value=calculate(input.value); result.textContent=String(value); expression=String(value); } catch(e){result.textContent=e.message;} }
  input.oninput=()=>{expression=input.value;}; input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();equals();}};
  container.querySelectorAll('[data-calc]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.calc;
    if(k==='='){equals();return;}
    if(k==='AC'){expression='';result.textContent='0';}
    else if(k==='C') expression=input.value.slice(0,-1);
    else if(k==='+/-') expression=input.value.startsWith('-(')?input.value.slice(2,-1):`-(${input.value || '0'})`;
    else expression=input.value.length<200?input.value+k:input.value;
    input.value=expression;
  });
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
  return `<div class="tools-box"><div class="tool-tabs"><button class="active" data-tool="note">메모장</button><button data-tool="draw">그림판</button><button data-tool="calc">계산기</button></div>
  <div data-tool-panel="note"><textarea id="scratch-note" maxlength="15000" placeholder="계산 과정과 생각을 자유롭게 적어 보세요." aria-label="시험 메모장"></textarea><span class="subtle">메모는 내 브라우저에만 저장됩니다.</span></div>
  <div data-tool-panel="draw" hidden><div class="drawing-controls"><label>색상 <input type="color" id="pen-color" value="#23463e"></label><label>굵기 <select id="pen-width"><option value="3">얇게</option><option value="6">보통</option><option value="10">굵게</option></select></label><button id="undo-drawing" class="text-button">한 획 취소</button><button id="clear-drawing" class="text-button">전체 지우기</button></div><canvas id="drawing" width="900" height="360" aria-label="풀이 그림판"></canvas></div>
  <div data-tool-panel="calc" hidden><label class="sr-only" for="calc-input">계산 수식</label><input id="calc-input" maxlength="200" placeholder="수식을 입력하거나 버튼을 누르세요" autocomplete="off"><output id="calc-result">0</output><div class="calc-grid">${['(',')','%','AC','C','+/-','÷','×','7','8','9','-','4','5','6','+','1','2','3','=','0','.'].map(k=>`<button data-calc="${k}" class="${k==='='?'equals':''}">${k}</button>`).join('')}</div></div></div>`;
}
