export function confirmAction(message, confirmLabel='확인') {
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');
    dialog.dataset.actionDialog='true';
    dialog.innerHTML='<h2>진행 전에 확인해 주세요.</h2><p></p><div class="actions"><button class="secondary" data-cancel>취소</button><button class="primary" data-confirm></button></div>';
    dialog.querySelector('p').textContent=message;dialog.querySelector('[data-confirm]').textContent=confirmLabel;
    let result=false;dialog.querySelector('[data-confirm]').onclick=()=>{result=true;dialog.close();};dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.onclose=()=>{dialog.remove();resolve(result);};document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').focus();
  });
}
export function dismissActionDialogs(){document.querySelectorAll('dialog[data-action-dialog]').forEach(d=>d.close());}
