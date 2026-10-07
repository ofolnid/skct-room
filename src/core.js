export const VERSION = 1;
export function validateConfig(input) {
  if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120) throw new Error('시험 이름을 1~120자로 입력해 주세요.');
  if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > 8) throw new Error('과목은 1~8개까지 설정할 수 있습니다.');
  const range=input.pdfRange || {start:Math.min(...input.sections.map(s=>Number(s.start))),end:Math.max(...input.sections.map(s=>Number(s.end)))};
  const start=Number(range.start), end=Number(range.end);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>10000)throw new Error('PDF 시작·끝 페이지를 확인해 주세요.');
  const sections = input.sections.map((s, i) => {
    const count = Number(s.count), minutes = Number(s.minutes);
    if (!s.name || typeof s.name !== 'string' || s.name.length > 40) throw new Error(`${i + 1}번째 과목 이름을 입력해 주세요.`);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 10000) throw new Error(`${s.name}: PDF 시작·끝 페이지를 확인해 주세요.`);
    if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isFinite(minutes) || minutes < 0.1 || minutes > 180) throw new Error(`${s.name}: 문항 수는 1~100개, 시간은 0.1~180분입니다.`);
    const key = s.key == null ? null : parseKey(s.key, count);
    const difficulty = s.difficulty == null ? null : validateMetadata(s.difficulty,count,'difficulty');
    const correctRate = s.correctRate == null ? null : validateMetadata(s.correctRate,count,'correctRate');
    return { name: s.name.trim(), start, end, count, minutes, key, difficulty, correctRate, tags:s.tags==null?null:validateTags(s.tags,count), source:typeof s.source==='string'?s.source.slice(0,200):'' };
  });
  const mode=input.mode || 'custom';
  if(!['custom','full','single'].includes(mode))throw new Error('응시 방식을 확인해 주세요.');
  if(mode==='full' && sections.length!==5)throw new Error('전체 모의고사는 5개 영역으로 구성합니다.');
  if(mode==='full' && new Set(sections.map(s=>s.name)).size!==5)throw new Error('전체 모의고사의 영역 이름이 중복되었습니다.');
  if(mode==='single' && sections.length!==1)throw new Error('영역별 연습은 한 영역만 선택합니다.');
  if(mode!=='custom' && sections.some(s=>s.minutes!==15 || s.count!==20))throw new Error('영역별 시험은 20문제·15분으로 구성합니다.');
  const timeMode=input.timeMode??'timed';
  if(!['timed','practice'].includes(timeMode))throw new Error('시간 제한 모드를 확인해 주세요.');
  const breakMode=input.breakMode??'free';
  if(!['free','timed'].includes(breakMode))throw new Error('영역 사이 휴식 모드를 확인해 주세요.');
  return { title: input.title.trim(), mode, timeMode, breakMode:mode==='full'&&timeMode!=='practice'?breakMode:'free', pdfRange:{start,end}, sections };
}
export function validateMetadata(values,count,type) {
  if(!Array.isArray(values) || values.length!==count)throw new Error('문항별 참고 정보 개수가 문항 수와 다릅니다.');
  return values.map(v=>{if(v==null)return null;
    if(type==='difficulty' && ['쉬움','보통','어려움'].includes(v))return v;
    if(type==='correctRate' && typeof v==='number' && Number.isFinite(v) && v>=0 && v<=100)return v;
    throw new Error(type==='difficulty'?'난이도는 쉬움·보통·어려움 또는 null로 입력하세요.':'참고 정답률은 0~100 숫자 또는 null로 입력하세요.');
  });
}
export function validateTags(values,count) {
  if(!Array.isArray(values)||values.length!==count)throw new Error('유형 태그 개수가 문항 수와 다릅니다.');
  return values.map(tags=>{
    if(!Array.isArray(tags)||tags.length>4)throw new Error('문항별 유형 태그는 배열로 최대 4개까지 입력하세요.');
    const clean=tags.map(tag=>{if(typeof tag!=='string'||!tag.trim()||tag.trim().length>24)throw new Error('유형 태그는 1~24자 문자열입니다.');return tag.trim();});
    if(new Set(clean).size!==clean.length)throw new Error('문항의 유형 태그가 중복되었습니다.');return clean;
  });
}
export function parseKey(input, count) {
  const values = Array.isArray(input) ? input : String(input).trim().split(/[\s,;]+/u);
  if (values.length !== count || values.some(v => !/^[1-5]$/.test(String(v)))) throw new Error(`정답은 1~5 사이 숫자 ${count}개를 공백이나 쉼표로 구분해 입력해 주세요.`);
  return values.map(Number);
}
export function createExam(config, pdfHash, now = Date.now()) {
  config = validateConfig(config);
  return { version: VERSION, id: crypto.randomUUID(), title: config.title, mode:config.mode, timeMode:config.timeMode, breakMode:config.breakMode, preparationDeadline:null, pdfRange:config.pdfRange, createdAt: now, pdfHash,
    sections: config.sections.map(s => ({ ...s, items: Array.from({length:s.count}, () => ({answer:null, status:'unreached', ms:0})), startedAt:null, endedAt:null, elapsed:0 })),
    phase:'ready', pausedAt:null, sectionIndex:0, questionIndex:0, questionStartedAt:null, deadline:null, selection:null, selectionFlags:{uncertain:false,guessed:false}, memo:'', reflection:'', drawings:[], calculator:{expression:'',result:'0',completed:false,history:[]} };
}
export function resetScratch(state){state.memo='';state.drawings=[];state.calculator={expression:'',result:'0',completed:false,history:[]};}
export function startSection(state, now = Date.now()) {
  if (!['ready','between','preparing'].includes(state.phase)) return false;
  if(state.phase==='preparing'){
    if(now<state.preparationDeadline)return false;
    now=state.preparationDeadline;
  }
  const section = state.sections[state.sectionIndex];
  resetScratch(state);state.phase = 'running'; state.questionIndex = 0; state.selection = null;state.selectionFlags={uncertain:false,guessed:false};
  section.startedAt = now;section.pausedMs=0;state.pausedAt=null;state.preparationDeadline=null; state.questionStartedAt = now; state.deadline = state.timeMode==='practice'?null:now + section.minutes * 60000;
  return true;
}
export function beginPreparation(state,now=Date.now()) {
  if(!['ready','between'].includes(state.phase))return false;
  if(state.mode!=='full')return startSection(state,now);
  state.phase='preparing';state.preparationDeadline=now+5000;resetScratch(state);return true;
}
export function synchronizeExam(state,now=Date.now()) {
  let changed=false;
  // Deadlines are anchored to the scheduled start, including background/reload catch-up.
  for(let i=0;i<state.sections.length*2+1;i++){
    if(state.phase==='preparing'&&now>=state.preparationDeadline){startSection(state,state.preparationDeadline);changed=true;}
    if(!expire(state,now))break;
    changed=true;
  }
  return changed;
}
export function pauseExam(state,now=Date.now()) {
  if(expire(state,now)||state.phase!=='running')return false;
  state.phase='paused';state.pausedPhase='running';state.pausedAt=now;return true;
}
export function resumePausedExam(state,now=Date.now()) {
  if(state.phase!=='paused')return false;
  const duration=Math.max(0,now-state.pausedAt);
  if(state.pausedPhase==='preparing'){
    state.preparationDeadline+=duration;state.phase='preparing';
  }else{
    if(state.deadline!=null)state.deadline+=duration;state.questionStartedAt+=duration;
    state.sections[state.sectionIndex].pausedMs=(state.sections[state.sectionIndex].pausedMs||0)+duration;
    state.phase='running';
  }
  state.pausedAt=null;state.pausedPhase=null;return true;
}
export function toggleFlag(state,flag,now=Date.now()) {
  if(expire(state,now) || state.phase!=='running' || !['uncertain','guessed'].includes(flag))return false;
  state.selectionFlags ??= {uncertain:false,guessed:false};state.selectionFlags[flag]=!state.selectionFlags[flag];return true;
}
export function chooseAnswer(state, answer, now = Date.now()) {
  if (expire(state, now) || state.phase !== 'running' || !Number.isInteger(answer) || answer < 1 || answer > 5) return false;
  state.selection = answer; return true;
}
function recordCurrent(state, at, skip = false, reason = 'submitted') {
  const section = state.sections[state.sectionIndex];
  section.items[state.questionIndex] = {answer:skip ? null : state.selection, status:skip ? 'skipped' : state.selection == null ? reason : 'answered', ms:Math.max(0, at - state.questionStartedAt),uncertain:!!state.selectionFlags?.uncertain,guessed:!!state.selectionFlags?.guessed};
}
function closeSection(state, at) {
  const section = state.sections[state.sectionIndex];
  section.endedAt = at; section.elapsed = Math.max(0, at - section.startedAt - (section.pausedMs||0));
  resetScratch(state);state.selection = null; state.questionStartedAt = null; state.deadline = null;
  if (state.sectionIndex + 1 < state.sections.length) {
    state.sectionIndex++;state.phase='between';
    if(state.mode==='full'&&state.timeMode!=='practice'&&state.breakMode==='timed'){state.phase='preparing';state.preparationDeadline=at+30000;}
  }
  else state.phase = 'finished';
}
export function advance(state, skip = false, now = Date.now(), expectedIndex = state.questionIndex) {
  if (expire(state, now) || state.phase !== 'running' || state.questionIndex !== expectedIndex) return false;
  if (!skip && state.selection == null) return false;
  recordCurrent(state, now, skip);resetScratch(state);
  if (state.questionIndex + 1 === state.sections[state.sectionIndex].count) closeSection(state, now);
  else { state.questionIndex++; state.questionStartedAt = now; state.selection = null;state.selectionFlags={uncertain:false,guessed:false}; }
  return true;
}
export function expire(state, now = Date.now()) {
  if (state.phase !== 'running' || state.timeMode==='practice' || state.deadline==null || now < state.deadline) return false;
  recordCurrent(state, state.deadline, false, 'timeout'); closeSection(state, state.deadline); return true;
}
export function submitSection(state, now = Date.now()) {
  if (expire(state, now)) return true;
  if (state.phase !== 'running') return false;
  recordCurrent(state, now); closeSection(state, now); return true;
}
export function resultOf(section, index) {
  const item = section.items[index];
  if (item.status === 'unreached') return '미도달';
  if (item.answer == null) return item.status === 'skipped' ? '건너뜀' : '미응답';
  if (!section.key) return '미채점';
  return item.answer === section.key[index] ? '정답' : '오답';
}
export function sectionSummary(section) {
  let correct=0, wrong=0, answered=0, skipped=0, unreached=0, unanswered=0, over=0,guessedCorrect=0,uncertainCorrect=0,unmarkedCorrect=0;
  section.items.forEach((item, i) => {
    const r=resultOf(section,i); correct += r==='정답'; wrong += r==='오답'; answered += item.answer != null;
    skipped += item.status==='skipped'; unreached += item.status==='unreached'; unanswered += item.answer==null && item.status!=='unreached';
    over += item.ms > section.minutes*60000/section.count;
    if(r==='정답'){guessedCorrect+=!!item.guessed;uncertainCorrect+=!!item.uncertain;unmarkedCorrect+=!item.guessed&&!item.uncertain;}
  });
  return {correct,wrong,answered,skipped,unreached,unanswered,over,guessedCorrect,uncertainCorrect,unmarkedCorrect,total:section.count};
}
export function formatTime(ms) {
  const seconds = Math.max(0, Math.floor(ms/1000));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function pauseForNavigation(state,now=Date.now()) {
  const changed=synchronizeExam(state,now);
  if(state.phase==='running')return pauseExam(state,now);
  if(state.phase==='preparing'){
    state.pausedPhase='preparing';state.phase='paused';state.pausedAt=now;return true;
  }
  return changed;
}
