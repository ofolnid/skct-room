import {advance} from './core.js';
export function mountZoomInput(input,initialZoom,onZoom,onError){
  let current=initialZoom;
  input.value=String(current);
  function apply(){
    const value=Number(input.value);
    if(!input.value.trim()||!Number.isInteger(value)||value<25||value>300){
      input.value=String(current);onError('PDF 배율은 25~300% 사이의 정수로 입력해 주세요.');return;
    }
    if(value===current)return;
    current=value;onZoom(value);
  }
  input.onchange=apply;
  input.onblur=apply;
  input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();apply();}};
}

export function submitAnswerAndTurnPage(exam,viewer,skip=false,now=Date.now(),expectedIndex=exam.questionIndex){
  const sectionIndex=exam.sectionIndex;
  const position=exam.autoAdvancePDF&&viewer?viewer.position():null;
  const submitted=advance(exam,skip,now,expectedIndex);
  const end=exam.pdfRange?.end??exam.sections[sectionIndex].end;
  if(submitted&&position&&exam.phase==='running'&&exam.sectionIndex===sectionIndex&&position.page<end){
    viewer.go(position.page+1);
  }
  return submitted;
}

export function mountAutoAdvanceToggle(input,exam,onChange){
  if(!input)return;
  input.checked=exam.autoAdvancePDF===true;
  input.onchange=()=>{exam.autoAdvancePDF=input.checked;onChange();};
}
