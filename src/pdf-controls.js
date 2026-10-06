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
