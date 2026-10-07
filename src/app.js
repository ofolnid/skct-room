import { validateConfig, createExam, beginPreparation, synchronizeExam, pauseForNavigation, pauseExam, resumePausedExam, chooseAnswer, advance, submitSection, toggleFlag, parseKey, formatTime, escapeHTML as e } from './core.js';
import { confirmAction,dismissActionDialogs } from './dialog.js';
import { loadAnswerSets,applyAnswerSet,clearAnswerMetadata,regradeAnswerSet } from './answer-sets.js';
import { load, save, storageAvailable, rememberResult, savedResults } from './storage.js';
import { openPDF, preparePDF, hasPage, mountPDFViewer, clearPages } from './pdf.js';
import { mountZoomInput } from './pdf-controls.js';
import { toolsMarkup, mountTools } from './tools.js';
import { reportMarkup, totals, copyContent, csvContent } from './report.js';
const app=document.querySelector('#app');
const subjectNames=['언어이해','자료해석','창의수리','언어추리','수열추리'];
const defaultSections=()=>subjectNames.map(name=>({name,start:1,end:1,count:20,minutes:15,key:null}));
let exam=load('current'), examMode='full', fullSections=defaultSections(), singleSubject=subjectNames[0], breakMode='free', timeMode='timed', config={title:'',mode:'full',sections:fullSections};
let pdfInfo=null, fileName='', prepared=false, pageNumber=1, zoom=100, view='setup', busy=false, lastAction=0;
let pdfViewer=null, pdfPosition=exam?.pdfPosition||{page:1,fraction:0,left:0};
let library=[], selectedKey='', manualTitle='', timer=null, resultFilter='all', answerSetError='';
try { library=await loadAnswerSets(); } catch(err) { answerSetError=err.message; }
const lockName='skct-room-v1-active';
let releaseLock=null, locked=false, helpResume=null;
async function acquireLock(){
  if(!navigator.locks) { locked=true; return; }
  await new Promise(resolve=>navigator.locks.request(lockName,{ifAvailable:true}, async lock=>{
    if(!lock){locked=false;resolve();return;}
    locked=true;resolve();await new Promise(r=>{releaseLock=r;});
  }));
}
await acquireLock();
if(!locked){app.innerHTML='<section class="panel empty-state"><h1>다른 창에서 시험장이 열려 있습니다.</h1><p>응시 기록 충돌을 막기 위해 한 창에서만 사용할 수 있습니다. 다른 창을 닫은 뒤 새로고침해 주세요.</p></section>';document.querySelectorAll('nav button').forEach(b=>b.disabled=true);}
else { if(exam && synchronizeExam(exam))persist(); if(exam?.phase==='finished'){view='result';rememberResult(exam);renderResult();}else renderSetup(); }
function notify(text){const t=document.querySelector('#toast');t.textContent=text;t.hidden=false;clearTimeout(t._timeout);t._timeout=setTimeout(()=>t.hidden=true,4200);}
function persist(){if(!locked)return;if(exam&&pdfViewer)exam.pdfPosition=pdfViewer.position();const current=load('current');if(exam && !(current && current.id!==exam.id && ['ready','running','paused','between','preparing'].includes(current.phase)))save('current',exam); document.querySelector('#storage-warning').hidden=storageAvailable();}
function nav(){document.querySelectorAll('nav button').forEach(b=>b.disabled=b.id!=='nav-help'&&view==='exam'&&exam?.phase==='preparing');document.body.classList.toggle('exam-active',view==='exam');document.querySelector('#nav-setup').classList.toggle('active',['setup','exam'].includes(view));document.querySelector('#nav-history').classList.toggle('active',['history','result'].includes(view));}
function currentConfig(){return {title:library.find(k=>k.id===(app.querySelector('#key-select')?.value??selectedKey))?.title??app.querySelector('#exam-title')?.value??config.title,mode:examMode,timeMode,breakMode,pdfRange:{start:Number(app.querySelector('#range-start').value),end:Number(app.querySelector('#range-end').value)},sections:config.sections.map(clearAnswerMetadata)};}
function applyLibrary(c){if(!selectedKey)return c;const key=library.find(k=>k.id===selectedKey);if(!key)throw new Error('선택한 정답 세트를 찾을 수 없습니다.');return applyAnswerSet(c,key);}
function subjectRow(s,i){return `<div class="subject-overview"><span>${String(i+1).padStart(2,'0')}</span><strong>${e(s.name)}</strong><small>20문제 · ${timeMode==='practice'?'시간 제한 없음':'15분'}</small></div>`;}
function examRange(){return exam.pdfRange || {start:Math.min(...exam.sections.map(s=>s.start)),end:Math.max(...exam.sections.map(s=>s.end))};}
function renderSetup(){
  if(!locked)return;if(pdfViewer){pdfPosition=pdfViewer.position();pdfViewer.destroy();pdfViewer=null;}window.scrollTo(0,0);
  const stored=load('current');if(stored && ['ready','running','paused','between','preparing'].includes(stored.phase))exam=stored;
  view='setup';nav();clearInterval(timer);
  const recover=exam && ['ready','running','paused','between','preparing'].includes(exam.phase);
  app.className='setup-page';
  app.innerHTML=`<div class="hero"><div><span class="eyebrow">A LITTLE PRACTICE. A BETTER PACE.</span><h1>실전처럼 풀고,<br><span>나의 페이스를 찾으세요.</span></h1><p>내 PDF로 시작하는 모의 시험.<br>한 문제씩 확정하고, 풀이 시간을 남겨 보세요.</p></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="pace-card"><span>YOUR NEXT PACE</span><strong>15:00</strong><div class="mini-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><small>20 questions · one step at a time</small></div><span class="floating-tag">✓ 준비되면 시작</span></div></div>
  ${recover?`<section class="resume-banner"><div><strong>이어서 볼 수 있는 시험이 있습니다.</strong><p>${e(exam.title)} · ${e(exam.sections[exam.sectionIndex].name)}${exam.phase==='running'?(exam.timeMode==='practice'?' · 풀이시간을 기록 중입니다.':' · 제한시간이 계속 흐르고 있습니다.'):exam.phase==='paused'?(exam.pausedPhase==='preparing'?' · 준비 카운트다운 일시정지 중':' · 일시정지 중'):exam.phase==='preparing'?' · 준비 카운트다운이 계속 흐르고 있습니다.':''}</p></div><button id="resume-exam" class="primary">이어보기</button></section>`:''}
  <form id="setup-form"><div class="setup-grid"><div class="setup-main"><section class="panel"><div class="section-title"><h2><span class="step-dot">1</span> 채점 방식</h2><span class="pill">정답 세트 또는 직접 입력</span></div><label class="wide-label">사용할 시험 정답 세트<select id="key-select"><option value="">시험 종료 후 직접 정답 입력</option>${library.map(k=>`<option value="${e(k.id)}" ${selectedKey===k.id?'selected':''}>${e(k.title)} · ${k.sections.length}개 과목</option>`).join('')}</select></label><label id="manual-title-field" class="wide-label" ${selectedKey?'hidden':''}>시험 이름<input id="exam-title" maxlength="120" placeholder="예: 자유 문제집 · 언어이해 연습" value="${e(manualTitle)}" ${selectedKey?'':'required'}></label><p id="selected-exam-title" class="subtle" ${selectedKey?'':'hidden'}>시험 이름 · ${e(library.find(k=>k.id===selectedKey)?.title||'')}</p><p class="subtle">선택한 정답 세트는 시험 중 표시되지 않습니다. ${library.length?library.length+'개 세트가 준비되어 있습니다.':'아직 등록된 세트가 없습니다. 종료 후 직접 채점할 수 있습니다.'}${answerSetError?e(answerSetError):''}</p><div class="actions"><button id="import-config" type="button" class="secondary small">시험 설정 가져오기</button><button id="export-config" type="button" class="secondary small">시험 설정 내보내기</button><input id="config-file" type="file" accept="application/json,.json" hidden></div><p class="subtle">설정 파일에는 페이지 범위와 선택한 정답표가 들어갈 수 있습니다. PDF는 포함되지 않습니다.</p></section>
  <section class="panel"><div class="section-title"><h2><span class="step-dot">2</span> 내 PDF</h2><span class="subtle">서버 전송 없이 내 기기에서</span></div><label class="upload-area" for="pdf-file"><span class="file-icon">↥</span><strong id="pdf-file-name">${e(fileName || '내 PDF 선택')}</strong><span id="pdf-file-meta">${pdfInfo?`총 ${pdfInfo.count}페이지 · 페이지 범위를 아래에서 지정하세요`:'클릭해서 PDF를 선택하세요 · 최대 500MB'}</span><input id="pdf-file" type="file" accept="application/pdf,.pdf"></label><p class="subtle">문제집은 각자 이용 권한이 있는 파일을 선택해 주세요. 사이트에서 공유되지 않습니다.</p></section>
  <section class="panel"><div class="section-title"><h2><span class="step-dot">3</span> 응시 범위와 영역</h2><span class="pill">${examMode==='full'?'5영역 · 휴식시간 제외':'1영역 집중 연습'}</span></div><div class="exam-mode-picker" role="group" aria-label="응시 방식"><button type="button" data-mode="full" class="${examMode==='full'?'selected':''}"><span>FULL PRACTICE</span><strong>전체 모의고사</strong><small>${timeMode==='practice'?'5영역 · 시간 제한 없음':'5영역 × 15분 · 최대 75분'}</small></button><button type="button" data-mode="single" class="${examMode==='single'?'selected':''}"><span>FOCUS PRACTICE</span><strong>영역별 연습</strong><small>선택한 1영역 · ${timeMode==='practice'?'시간 제한 없음':'15분'}</small></button></div><fieldset class="break-mode-picker"><legend>시간 제한</legend><label><input type="radio" name="time-mode" value="timed" ${timeMode==='timed'?'checked':''}><span><strong>시간 제한 모드</strong><small>영역별 15분 · 시간 종료 시 자동 제출</small></span></label><label><input type="radio" name="time-mode" value="practice" ${timeMode==='practice'?'checked':''}><span><strong>연습 모드</strong><small>시간 제한 없이 풀이 · 문제별 풀이시간 기록과 종료 후 채점</small></span></label></fieldset>${examMode==='full'&&timeMode!=='practice'?`<fieldset class="break-mode-picker"><legend>영역 사이 진행 방식</legend><label><input type="radio" name="break-mode" value="free" ${breakMode==='free'?'checked':''}><span><strong>자유 휴식 모드</strong><small>영역 사이 자유 휴식 → 시작 버튼 → 5초 준비 후 자동 시작</small></span></label><label><input type="radio" name="break-mode" value="timed" ${breakMode==='timed'?'checked':''}><span><strong>실전 진행 모드</strong><small>영역 제출 후 30초 동안 휴식·PDF 위치 이동 → 다음 영역 자동 시작</small></span></label><p class="subtle">첫 영역은 시작 버튼 뒤 5초 준비합니다. 준비·휴식은 응시시간에서 제외됩니다.</p></fieldset>`:''}<p class="subtle">이번에 볼 모의고사의 시작·끝 페이지만 한 번 입력하세요. 책 쪽수가 아닌 PDF 페이지 순서입니다.</p><div class="pdf-range"><label>PDF 시작 페이지<input id="range-start" type="number" min="1" max="10000" value="${config.pdfRange?.start||1}" required></label><span>—</span><label>PDF 끝 페이지<input id="range-end" type="number" min="1" max="10000" value="${config.pdfRange?.end||1}" required></label></div>${examMode==='single'?`<label class="wide-label">연습할 영역<select id="single-subject">${subjectNames.map(name=>`<option value="${name}" ${name===singleSubject?'selected':''}>${name}</option>`).join('')}</select></label>`:''}<div id="subjects">${config.sections.map(subjectRow).join('')}</div><p class="subtle preparation-note">선택 범위만 고화질로 모두 준비합니다. 준비가 끝난 뒤 시험 시간이 시작됩니다.</p></section></div>
  <aside class="setup-aside"><div class="panel start-card"><span class="eyebrow">READY WHEN YOU ARE</span><h2>오늘의 연습을<br>시작해 볼까요?</h2><ul><li><span>✓</span>문제별 풀이 시간 기록</li><li><span>✓</span>확정한 답안은 변경 불가</li><li><span>✓</span>${timeMode==='practice'?'시간 제한 없이 연습':'과목별 제한시간 자동 제출'}</li><li><span>✓</span>메모장 · 그림판 · 계산기</li></ul><div id="prepare-progress" hidden><progress max="100" value="0"></progress><p class="subtle"></p></div><button id="prepare-button" class="primary wide" type="submit">PDF 준비하기 <span>→</span></button><p class="subtle centered">준비 중에는 시험 시간이 흐르지 않습니다.</p><div id="setup-error" class="form-error" role="alert" hidden></div></div><div class="privacy-note"><span>◉</span><p><strong>기록은 내 브라우저에만.</strong><br>결과를 복사하거나 PDF로 저장해<br>원하는 곳에 직접 보관하세요.</p></div></aside></div></form><footer class="page-footer">페이스룸은 개인 연습 도구입니다. SKCT 공식 서비스와 관련이 없습니다.</footer>`;
  document.querySelector('#storage-warning').hidden=storageAvailable();
  app.querySelector('#pdf-file').onchange=async event=>{
    if(busy)return;config=currentConfig();selectedKey=app.querySelector('#key-select').value;
    const file=event.target.files[0];if(!file)return;busy=true;disableSetup(true);showSetupError('');
    try { pdfInfo=await openPDF(file);fileName=file.name;prepared=false;config.pdfRange={start:1,end:pdfInfo.count};app.querySelector('#range-start').value='1';app.querySelector('#range-end').value=String(pdfInfo.count);app.querySelector('#pdf-file-name').textContent=fileName;app.querySelector('#pdf-file-meta').textContent=`총 ${pdfInfo.count}페이지 · 준비 전 페이지 범위를 설정하세요`; }
    catch(err){pdfInfo=null;prepared=false;fileName='';showSetupError(err.message);}
    finally{busy=false;disableSetup(false);}
  };
  app.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{config=currentConfig();selectedKey=app.querySelector('#key-select').value;if(examMode==='full')fullSections=config.sections;else fullSections=fullSections.map(s=>s.name===singleSubject?config.sections[0]:s);examMode=b.dataset.mode;config={title:config.title,pdfRange:config.pdfRange,mode:examMode,sections:examMode==='full'?fullSections:[fullSections.find(s=>s.name===singleSubject)]};renderSetup();});
  app.querySelector('#single-subject')?.addEventListener('change',event=>{const current=currentConfig();fullSections=fullSections.map(s=>s.name===singleSubject?current.sections[0]:s);singleSubject=event.target.value;config={title:current.title,pdfRange:current.pdfRange,mode:'single',sections:[fullSections.find(s=>s.name===singleSubject)]};renderSetup();});
  app.querySelectorAll('[name="time-mode"]').forEach(input=>input.onchange=()=>{config=currentConfig();timeMode=input.value;renderSetup();});
  app.querySelectorAll('[name="break-mode"]').forEach(input=>input.onchange=()=>breakMode=input.value);
  app.querySelector('#exam-title').oninput=event=>manualTitle=event.target.value;
  app.querySelector('#key-select').onchange=event=>{
    selectedKey=event.target.value;manualTitle=app.querySelector('#exam-title').value;
    app.querySelector('#manual-title-field').hidden=!!selectedKey;
    app.querySelector('#exam-title').required=!selectedKey;
    const title=app.querySelector('#selected-exam-title');title.hidden=!selectedKey;
    title.textContent=`시험 이름 · ${library.find(k=>k.id===selectedKey)?.title||''}`;
  };
  app.querySelector('#setup-form').onsubmit=async event=>{event.preventDefault();if(busy)return;showSetupError('');
    try { config=applyLibrary(validateConfig(currentConfig()));if(!pdfInfo)throw new Error('먼저 내 PDF를 선택해 주세요.');if(exam && ['ready','running','paused','between','preparing'].includes(exam.phase) && !await confirmAction('진행 중인 시험을 종료하고 새 시험을 준비할까요? 현재 시험은 결과 기록에 남깁니다.','새 시험 준비'))return;
      if(exam && ['ready','running','paused','between','preparing'].includes(exam.phase)){finishAbandoned();}
      busy=true;disableSetup(true);app.querySelector('#prepare-progress').hidden=false;
      await preparePDF(config.pdfRange,(n,total)=>{app.querySelector('progress').value=n/total*100;app.querySelector('#prepare-progress p').textContent=`${n} / ${total}페이지 준비 완료`;});
      prepared=true;exam=createExam(config,pdfInfo.hash);persist();pageNumber=examRange().start;pdfPosition={page:pageNumber,fraction:0,left:0};renderExam();
    } catch(err){showSetupError(err.message);}finally{busy=false;if(view==='setup')disableSetup(false);}
  };
  app.querySelector('#resume-exam')?.addEventListener('click',()=>resumeExam());
  app.querySelector('#export-config').onclick=()=>{try{download('시험설정.json',JSON.stringify({version:1,...applyLibrary(validateConfig(currentConfig()))},null,2),'application/json');}catch(err){notify(err.message);}};
  app.querySelector('#import-config').onclick=()=>app.querySelector('#config-file').click();
  app.querySelector('#config-file').onchange=async event=>{if(busy)return;busy=true;disableSetup(true);try{const file=event.target.files[0];if(!file)return;if(file.size>1024*1024)throw new Error('설정 파일은 1MB 이하만 가능합니다.');const input=JSON.parse(await file.text());if(!['full','single'].includes(input.mode))throw new Error('전체/영역별 응시 방식이 포함된 설정 파일을 선택해 주세요.');const imported=validateConfig(input);if(imported.sections.some(s=>!subjectNames.includes(s.name)))throw new Error('설정 파일의 영역 이름을 확인해 주세요.');manualTitle=imported.sections.some(s=>s.key)?'':imported.title;examMode=imported.mode;breakMode=imported.breakMode;timeMode=imported.timeMode;config={...imported,sections:imported.sections.map(s=>({...s,key:null}))};if(examMode==='full')fullSections=config.sections;else{singleSubject=config.sections[0].name;fullSections=fullSections.map(s=>s.name===singleSubject?config.sections[0]:s);}selectedKey='';if(imported.sections.some(s=>s.key)){const importedKey={id:'imported-settings',title:imported.title,sections:imported.sections};library=library.filter(k=>k.id!=='imported-settings');library.push(importedKey);selectedKey=importedKey.id;}renderSetup();notify('시험 설정을 불러왔습니다. 각자의 PDF를 선택해 주세요.');}catch(err){notify(err.message);}finally{busy=false;if(view==='setup')disableSetup(false);}};
}
function disableSetup(disabled){app.querySelectorAll('#setup-form input, #setup-form button, #setup-form select').forEach(el=>el.disabled=disabled);const resume=app.querySelector('#resume-exam');if(resume)resume.disabled=disabled;app.querySelectorAll('[data-mode]').forEach(b=>b.disabled=disabled);}
function showSetupError(message){const box=app.querySelector('#setup-error');if(box){box.textContent=message;box.hidden=!message;}}
function finishAbandoned(){if(exam.phase==='paused')resumePausedExam(exam);if(exam.phase==='preparing')exam.phase='between';if(exam.phase==='running'){const mode=exam.breakMode;exam.breakMode='free';submitSection(exam);exam.breakMode=mode;}while(exam.phase==='between'){const s=exam.sections[exam.sectionIndex];s.elapsed=0;s.endedAt=Date.now();if(exam.sectionIndex+1<exam.sections.length)exam.sectionIndex++;else exam.phase='finished';}if(['ready','preparing'].includes(exam.phase))exam.phase='finished';exam.abandoned=true;rememberResult(exam);persist();}
async function resumeExam(){
  if(busy)return;
  if(synchronizeExam(exam)){persist();if(exam.phase==='finished'){rememberResult(exam);return renderResult();}}
  if(prepared && pdfInfo?.hash===exam.pdfHash){pageNumber=examRange().start;return renderExam();}
  if(!pdfInfo)return notify('응시했던 PDF를 먼저 선택하고 이어보기를 눌러 주세요.');
  if(pdfInfo.hash!==exam.pdfHash)return notify('응시했던 PDF와 다른 파일입니다. 같은 PDF를 선택해 주세요.');
  busy=true;disableSetup(true);app.querySelector('#prepare-progress').hidden=false;
  try{await preparePDF(examRange(),(n,total)=>{app.querySelector('progress').value=n/total*100;app.querySelector('#prepare-progress p').textContent=`${n} / ${total}페이지 복구 중 · ${exam.phase==='paused'?'일시정지 유지 중':'응시 시간은 계속 흐릅니다'}`;});prepared=true;synchronizeExam(exam);persist();if(exam.phase==='finished'){rememberResult(exam);renderResult();}else{pageNumber=examRange().start;renderExam();}}
  catch(err){showSetupError(err.message);}finally{busy=false;if(view==='setup')disableSetup(false);}
}
function renderExam(){
  if(!locked)return;if(exam.phase==='between')return renderBreak();if(view!=='exam')window.scrollTo(0,0);
  view='exam';nav();clearInterval(timer);resultFilter='all';const s=exam.sections[exam.sectionIndex], running=['running','paused'].includes(exam.phase);
  app.className='exam-page';
  if(pdfViewer){pdfPosition=pdfViewer.position();pdfViewer.destroy();pdfViewer=null;}
  app.innerHTML=`<div class="exam-top"><strong>${e(s.name)} <small>${exam.sectionIndex+1} / ${exam.sections.length}영역</small></strong><span>${e(exam.title)}</span><span class="exam-status">${s.count}문제 · ${exam.timeMode==='practice'?'연습 모드 · 시간 제한 없음':s.minutes+'분'+(exam.mode==='full'?' · 전체 최대 75분':'')}</span></div><div class="exam-layout"><section class="pdf-panel"><div class="pdf-toolbar"><span class="subtle">PDF <strong id="page-label"></strong></span><div class="actions"><button id="prev-page" class="icon-button" aria-label="이전 PDF 페이지">←</button><button id="next-page" class="icon-button" aria-label="다음 PDF 페이지">→</button><label class="zoom-label">배율<input id="pdf-zoom" type="number" min="25" max="300" step="1" list="pdf-zoom-presets" aria-label="PDF 배율 퍼센트" title="25~300% · 입력 후 Enter 또는 다른 곳 클릭"><span>%</span><datalist id="pdf-zoom-presets">${[25,50,75,100,125,150,200,300].map(value=>`<option value="${value}"></option>`).join('')}</datalist></label></div></div><div id="pdf-page" class="pdf-page" tabindex="0" aria-label="PDF 연속 스크롤"></div><div class="pdf-footnote">스크롤·화살표로 페이지 이동 · 답안 번호는 별도로 진행</div></section><section class="panel answer-panel"><div class="timer-label"><span>${exam.timeMode==='practice'?'영역 풀이 시간':'영역 남은 시간'}</span>${running?'<button id="pause-exam" class="pause-button" aria-label="시험 일시정지">Ⅱ 일시정지</button>':'<span class="live-dot"></span>'}</div><div id="remaining-time" class="timer">${formatTime(exam.timeMode==='practice'?0:s.minutes*60000)}</div><div class="timer-track" ${exam.timeMode==='practice'?'hidden':''}><div id="timer-fill"></div></div>${running?`<div class="current-question"><span>현재 문제</span><strong>${String(exam.questionIndex+1).padStart(2,'0')}<small> / ${s.count}</small></strong></div><span class="question-time">이 문제 <b id="question-time">00:00</b> / 권장 00:45</span><div class="answer-options" role="group" aria-label="${exam.questionIndex+1}번 답안 선택">${[1,2,3,4,5].map(a=>`<button data-answer="${a}" aria-pressed="${exam.selection===a}" class="${exam.selection===a?'selected':''}">${a}</button>`).join('')}</div><div class="confidence-flags"><button data-flag="uncertain" aria-pressed="${!!exam.selectionFlags?.uncertain}" class="${exam.selectionFlags?.uncertain?'selected':''}">? 헷갈림</button><button data-flag="guessed" aria-pressed="${!!exam.selectionFlags?.guessed}" class="${exam.selectionFlags?.guessed?'selected':''}">↗ 찍었음</button></div><button id="confirm-answer" class="primary wide" ${exam.selection==null?'disabled':''}>답안 제출</button><button id="skip-answer" class="secondary wide">문제 건너뛰기</button><p class="subtle centered">확정한 답은 변경할 수 없습니다.</p><div class="omr-strip" aria-label="답안 진행 상황">${s.items.map((item,i)=>`<span class="${i===exam.questionIndex?'current':item.answer!=null?'done':item.status!=='unreached'?'skipped':''}">${i+1}</span>`).join('')}</div><button id="submit-section" class="text-button wide">현재 영역 조기 제출</button>`:`<div class="ready-message"><span>✓</span><h2>모든 페이지 준비 완료</h2><p>${exam.mode==='full'?'시작 버튼 뒤 5초 준비 후 시험이 시작됩니다.':(exam.timeMode==='practice'?'시작하면 풀이 시간을 기록합니다.':'시작하면 제한시간이 흐릅니다.')}<br>확정한 답은 변경할 수 없습니다.</p></div><button id="start-section" class="primary wide">${e(s.name)} 시작 →</button>`}</section><aside class="panel tool-panel">${toolsMarkup()}</aside></div>`;
  const range=examRange();
  function updatePage(n){pageNumber=n;app.querySelector('#page-label').textContent=`${n} / ${range.start}–${range.end}`;app.querySelector('#prev-page').disabled=n<=range.start;app.querySelector('#next-page').disabled=n>=range.end;if(pdfViewer)persist();}
  pdfViewer=mountPDFViewer(app.querySelector('#pdf-page'),range,zoom,pdfPosition,updatePage,notify);
  app.querySelector('#prev-page').onclick=()=>pdfViewer.go(pageNumber-1);
  app.querySelector('#next-page').onclick=()=>pdfViewer.go(pageNumber+1);
  mountZoomInput(app.querySelector('#pdf-zoom'),zoom,value=>{zoom=value;pdfViewer.zoom(zoom);},notify);
  app.querySelector('#start-section')?.addEventListener('click',()=>{beginPreparation(exam);persist();renderExam();});
  app.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{const changed=chooseAnswer(exam,Number(b.dataset.answer));persist();if(!changed){afterChange();return;}app.querySelectorAll('[data-answer]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});app.querySelector('#confirm-answer').disabled=false;});
  app.querySelectorAll('[data-flag]').forEach(b=>b.onclick=()=>{if(!toggleFlag(exam,b.dataset.flag)){persist();afterChange();return;}persist();const active=exam.selectionFlags[b.dataset.flag];b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  const expected=exam.questionIndex;
  function proceed(skip){if(Date.now()-lastAction<300)return;lastAction=Date.now();advance(exam,skip,Date.now(),expected);persist();afterChange();}
  app.querySelector('#confirm-answer')?.addEventListener('click',()=>proceed(false));app.querySelector('#skip-answer')?.addEventListener('click',()=>proceed(true));
  app.querySelector('#submit-section')?.addEventListener('click',async()=>{if(await confirmAction('현재 과목을 제출할까요? 선택 중인 답은 제출하고, 남은 문제는 미도달로 기록합니다.','과목 제출')){submitSection(exam);persist();afterChange();}});
  mountTools(app.querySelector('.tool-panel'),exam,persist);if(exam.phase==='preparing')showPreparation();tick();clearInterval(timer);timer=setInterval(tick,200);
  app.querySelector('#pause-exam')?.addEventListener('click',()=>{if(pauseExam(exam)){persist();showPause();}else{persist();afterChange();}});
  if(exam.phase==='paused')showPause();
}
function showPreparation(){
  app.classList.add('exam-preparing');
  app.querySelectorAll('.answer-panel button,.tool-panel button,.tool-panel input,.tool-panel textarea,.tool-panel select').forEach(el=>el.disabled=true);
  app.querySelector('.answer-panel').inert=true;app.querySelector('.tool-panel').inert=true;
  const box=document.createElement('section');box.className='preparation-dialog';box.setAttribute('role','dialog');box.setAttribute('aria-labelledby','preparation-title');
  box.innerHTML=`<span class="eyebrow">GET READY</span><h2 id="preparation-title">${e(exam.sections[exam.sectionIndex].name)} 시작 준비</h2><div class="preparation-time"><b id="preparation-count">${Math.max(0,Math.ceil((exam.preparationDeadline-Date.now())/1000))}</b><span>초 후 자동 시작</span></div><p>다음 영역의 시작 페이지로<br>PDF 위치를 맞춰 주세요.</p><p class="subtle">지금은 PDF만 이동할 수 있습니다.<br>${exam.timeMode==='practice'?'준비 시간이 끝나면 풀이시간 기록이 시작됩니다.':'준비 시간이 끝나면 15분 타이머가 시작됩니다.'}</p>`;
  app.append(box);
}
function showPause(){
  clearInterval(timer);app.classList.add('exam-paused');
  const preparing=exam.pausedPhase==='preparing',remaining=Math.max(0,(preparing?exam.preparationDeadline:exam.deadline)-exam.pausedAt),s=exam.sections[exam.sectionIndex];
  const dialog=document.createElement('dialog');dialog.id='pause-dialog';dialog.className='pause-dialog';dialog.setAttribute('aria-labelledby','pause-title');
  dialog.innerHTML=`<span class="eyebrow">TAKE A PAUSE</span><span class="pause-icon" aria-hidden="true">Ⅱ</span><h2 id="pause-title">일시정지 중</h2><p class="subtle">${preparing?'준비 카운트다운이 멈춰 있습니다.':'과목과 문제 풀이 시간이 멈춰 있습니다.'}</p><div class="pause-info"><strong>${e(s.name)}</strong><span>${preparing?'남은 준비 시간':exam.timeMode==='practice'?'풀이 시간':'남은 시간'}</span><b>${formatTime(!preparing&&exam.timeMode==='practice'?Math.max(0,exam.pausedAt-s.startedAt-(s.pausedMs||0)):Math.ceil(remaining/1000)*1000)}</b></div><button id="resume-paused" class="primary wide"><span aria-hidden="true">▶</span> ${preparing?'준비 재개':'시험 재개'}</button>`;
  dialog.oncancel=event=>event.preventDefault();app.append(dialog);dialog.showModal();
  dialog.querySelector('#resume-paused').onclick=()=>{if(!resumePausedExam(exam))return;persist();dialog.close();dialog.remove();renderExam();};
}
function tick(){if(!exam||view!=='exam')return;if(exam.phase==='preparing'){const counter=app.querySelector('#preparation-count');if(counter)counter.textContent=String(Math.max(0,Math.ceil((exam.preparationDeadline-Date.now())/1000))).padStart(2,'0');}if(synchronizeExam(exam)){persist();afterChange();return;}if(exam.phase!=='running')return;const now=Date.now(),left=Math.max(0,exam.deadline-now),s=exam.sections[exam.sectionIndex];app.querySelector('#remaining-time').textContent=formatTime(exam.timeMode==='practice'?Math.max(0,now-s.startedAt-(s.pausedMs||0)):Math.ceil(left/1000)*1000);app.querySelector('#remaining-time').classList.toggle('urgent',exam.timeMode!=='practice'&&left<60000);app.querySelector('#question-time').textContent=formatTime(now-exam.questionStartedAt);app.querySelector('#timer-fill').style.width=100*left/(s.minutes*60000)+'%';}
function afterChange(){dismissActionDialogs();document.querySelector('#help-dialog').close();if(exam.phase==='finished'){rememberResult(exam);renderResult();}else renderExam();}
function renderBreak(){
  if(!locked)return;if(pdfViewer){pdfPosition=pdfViewer.position();pdfViewer.destroy();pdfViewer=null;}clearInterval(timer);view='exam';nav();window.scrollTo(0,0);const next=exam.sections[exam.sectionIndex],previous=exam.sections[exam.sectionIndex-1];
  app.className='break-page';app.innerHTML=`<div class="break-background" aria-hidden="true"><div class="placeholder-page"></div><div class="placeholder-page"></div></div><dialog id="break-dialog" class="break-dialog" aria-labelledby="break-title"><span class="eyebrow">TAKE A BREATH</span><span class="break-icon">☕</span><h2 id="break-title">${e(previous.name)} 제출 완료</h2><p class="subtle">이전 영역 풀이 ${formatTime(previous.elapsed)}<br>전체 누적 응시 ${formatTime(exam.sections.reduce((sum,s)=>sum+s.elapsed,0))} ${exam.timeMode==='practice'?' · 시간 제한 없음':' / 최대 '+formatTime(exam.sections.reduce((sum,s)=>sum+s.minutes*60000,0))}</p><div class="next-subject"><span>다음 영역</span><strong>${e(next.name)}</strong><small>${next.count}문제 · ${exam.timeMode==='practice'?'시간 제한 없음':next.minutes+'분'}</small></div><p class="subtle">지금은 문제와 시간이 멈춰 있습니다.<br>충분히 쉬고 시작하세요. 휴식은 응시시간에 포함되지 않습니다.</p><button id="begin-next" class="primary wide">다음 영역 시작 →</button></dialog>`;
  const dialog=app.querySelector('#break-dialog');dialog.oncancel=event=>event.preventDefault();dialog.showModal();
  app.querySelector('#begin-next').onclick=()=>{dialog.close();if(!prepared || !hasPage(examRange().start)){renderSetup();notify('같은 PDF를 선택한 뒤 이어보기로 다음 영역을 준비해 주세요.');return;}beginPreparation(exam);persist();renderExam();};
}
function renderAnswerEntry(){
  if(pdfViewer){pdfViewer.destroy();pdfViewer=null;}
  clearInterval(timer);view='result';nav();window.scrollTo(0,0);app.className='result-page';
  app.innerHTML=`<section class="panel empty-state"><h1>시험 제출 완료</h1><p>정답을 입력하면 채점 결과와 문제별 풀이 시간을 확인할 수 있습니다.</p></section><dialog id="answer-entry-dialog" aria-labelledby="answer-entry-title"><button class="close-dialog secondary" id="close-answer-entry" aria-label="정답 입력 닫기">✕</button><span class="eyebrow">READY TO REVIEW</span><h2 id="answer-entry-title">정답을 입력해 주세요</h2><p class="subtle">${e(exam.title)}<br>1~5 숫자를 공백이나 쉼표로 구분해 붙여넣으세요.</p><form id="answer-entry-form"><div class="key-fields ${exam.sections.length===1?'single-key':''}">${exam.sections.map((s,i)=>`<label>${e(s.name)} · ${s.count}문제<textarea data-entry="${i}" rows="2" maxlength="2000" required placeholder="1 3 2 5 …" aria-label="${e(s.name)} 정답 입력">${s.key?s.key.join(' '):''}</textarea></label>`).join('')}</div><p id="answer-entry-error" class="form-error" role="alert" hidden></p><button type="submit" class="primary wide">채점하고 결과 보기 →</button></form></dialog>`;
  const dialog=app.querySelector('#answer-entry-dialog');
  app.querySelector('#close-answer-entry').onclick=()=>dialog.close();
  dialog.onclose=()=>{if(exam.sections.some(s=>!s.key))renderHistory();};
  app.querySelector('#answer-entry-form').oninput=()=>{dialog.querySelector('#answer-entry-error').hidden=true;};
  app.querySelector('#answer-entry-form').onsubmit=event=>{
    event.preventDefault();const fields=[...dialog.querySelectorAll('[data-entry]')],keys=[];
    for(let i=0;i<fields.length;i++){
      try{keys.push(parseKey(fields[i].value,exam.sections[i].count));}
      catch(err){const error=dialog.querySelector('#answer-entry-error');error.textContent=`${exam.sections[i].name}: ${err.message}`;error.hidden=false;fields[i].focus();return;}
    }
    exam.sections.forEach((s,i)=>s.key=keys[i]);persist();rememberResult(exam);dialog.onclose=null;dialog.close();renderResult();
  };
  dialog.showModal();[...dialog.querySelectorAll('[data-entry]')].find((field,i)=>!exam.sections[i].key)?.focus();
}
function renderResult(){if(exam.sections.some(s=>!s.key))return renderAnswerEntry();if(pdfViewer){pdfViewer.destroy();pdfViewer=null;}window.scrollTo(0,0);view='result';nav();clearInterval(timer);app.className='result-page';app.innerHTML=reportMarkup(exam,library);app.querySelector('#reflection').value=exam.reflection||'';app.querySelector('#reflection').oninput=event=>{exam.reflection=event.target.value;persist();rememberResult(exam);app.querySelector('.reflection .print-only').textContent=exam.reflection||'작성한 메모가 없습니다.';};
  const resultKey=app.querySelector('#result-key-select'),regradeButton=app.querySelector('#regrade-set');
  resultKey.onchange=()=>{regradeButton.disabled=!resultKey.value;};
  regradeButton.onclick=()=>{try{const set=library.find(k=>k.id===resultKey.value);if(!set)throw new Error('정답 세트를 선택하세요.');exam=regradeAnswerSet(exam,set);persist();rememberResult(exam);renderResult();notify('선택한 정답 세트로 재채점했습니다.');}catch(err){notify(err.message);}};
  app.querySelector('#grade-form').onsubmit=event=>{event.preventDefault();try{const keys=[...app.querySelectorAll('[data-grade]')].map((input,i)=>input.value.trim()?parseKey(input.value,exam.sections[i].count):null);exam.sections.forEach((s,i)=>s.key=keys[i]);persist();rememberResult(exam);renderResult();notify('채점 결과를 갱신했습니다.');}catch(err){notify(err.message);}};

  app.querySelector('#copy-result').onclick=async()=>{const {text,html}=copyContent(exam);try{if(globalThis.ClipboardItem&&navigator.clipboard.write){await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);}else await navigator.clipboard.writeText(text);notify('결과를 복사했습니다. 노션 등에 붙여넣으세요.');}catch{const d=document.createElement('dialog');d.innerHTML='<h2>결과 직접 복사</h2><p>아래 내용을 전체 선택해 복사하세요.</p><textarea rows="15" aria-label="복사할 결과"></textarea><button class="primary">닫기</button>';document.body.append(d);d.querySelector('textarea').value=text;d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();d.querySelector('textarea').select();}};
  app.querySelector('#download-csv').onclick=()=>download(exam.title+'-결과.csv',csvContent(exam),'text/csv;charset=utf-8');
  app.querySelector('#print-result').onclick=()=>{applyFilter('all');const closed=[...app.querySelectorAll('.type-analysis details')].filter(d=>!d.open);closed.forEach(d=>d.open=true);window.addEventListener('afterprint',()=>closed.forEach(d=>d.open=false),{once:true});window.print();};
  app.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>applyFilter(b.dataset.filter));applyFilter(resultFilter);
}
function applyFilter(filter){resultFilter=filter;let shown=0;app.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));app.querySelectorAll('.question-card').forEach(card=>{const hide=filter!=='all'&&card.dataset[filter]!=='true';card.hidden=hide;shown+=!hide;});app.querySelector('#filter-empty').hidden=shown>0;}
function renderHistory(){if(pdfViewer){pdfPosition=pdfViewer.position();pdfViewer.destroy();pdfViewer=null;}window.scrollTo(0,0);view='history';nav();clearInterval(timer);const results=savedResults();app.className='history-page';app.innerHTML=`<div class="result-heading"><div><span class="eyebrow">MY PRACTICE LOG</span><h1>내 응시 기록</h1><p class="subtle">이 브라우저에서 남긴 연습을 다시 확인하세요.</p></div><button id="new-exam" class="primary">새 시험 준비 →</button></div>${results.length?`<div class="history-list">${results.map(r=>{const t=totals(r);return `<button class="history-card" data-result="${e(r.id)}"><span class="history-icon">↗</span><span><strong>${e(r.title)}</strong><small>${new Date(r.createdAt).toLocaleString('ko-KR')} · ${r.sections.length}개 과목 ${r.abandoned?'· 중단한 시험':''}</small></span><span class="history-score">${t.graded?t.correct+' / '+t.graded:'미채점'}<small>${formatTime(t.elapsed)}</small></span></button>`;}).join('')}</div>`:'<section class="panel empty-state"><span class="empty-icon">◷</span><h2>첫 연습을 기다리고 있어요.</h2><p>시험을 마치면 이곳에서 결과를 다시 볼 수 있습니다.</p></section>'}<p class="subtle">기록은 서버에 저장되지 않습니다. 중요한 결과는 복사하거나 PDF로 보관하세요.</p>`;app.querySelector('#new-exam').onclick=renderSetup;app.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{exam=results.find(r=>r.id===b.dataset.result);resultFilter='all';renderResult();});}

function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
document.querySelector('#nav-setup').onclick=()=>{if(busy)return;if(view==='exam'&&['running','paused','preparing'].includes(exam.phase))return notify('응시 중에는 시험 화면을 유지합니다. 과목을 제출한 뒤 이동할 수 있습니다.');renderSetup();};
document.querySelector('#nav-history').onclick=()=>{if(busy)return;if(['running','paused','preparing'].includes(exam?.phase))return notify('응시 중에는 기록 화면으로 이동할 수 없습니다.');renderHistory();};
function openHelp(){
  const dialog=document.querySelector('#help-dialog');if(dialog.open)return;
  helpResume=null;
  if(locked&&exam&&['running','preparing'].includes(exam.phase)){
    pauseForNavigation(exam);clearInterval(timer);persist();
    if(exam.phase==='paused')helpResume={exam,pausedAt:exam.pausedAt};
    else if(view==='exam')afterChange();
  }
  dialog.showModal();document.documentElement.classList.add('help-open');document.body.classList.add('help-open');
}
function closeHelp(){
  document.documentElement.classList.remove('help-open');document.body.classList.remove('help-open');
  const resume=helpResume;helpResume=null;
  if(locked&&resume?.exam===exam&&exam?.phase==='paused'&&exam.pausedAt===resume.pausedAt&&resumePausedExam(exam)){
    persist();if(view==='exam')renderExam();
  }
}
document.querySelector('#nav-help').onclick=openHelp;
document.querySelector('#help-dialog .close-dialog').onclick=()=>document.querySelector('#help-dialog').close();
document.querySelector('#help-dialog').addEventListener('close',closeHelp);
document.querySelector('.brand').onclick=event=>{event.preventDefault();if(locked&&!busy&&!['running','paused','preparing'].includes(exam?.phase))renderSetup();};
document.addEventListener('visibilitychange',()=>{if(locked&&exam&&synchronizeExam(exam)){persist();if(view==='exam')afterChange();}});
function pauseOnLeave(){
  helpResume=null;
  if(!locked||!exam)return;
  if(pauseForNavigation(exam))clearInterval(timer);
  persist();
}
window.addEventListener('beforeunload',pauseOnLeave);
window.addEventListener('pagehide',()=>{pauseOnLeave();locked=false;releaseLock?.();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
