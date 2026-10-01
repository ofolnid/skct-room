export const VERSION = 1;
export function validateConfig(input) {
  if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120) throw new Error('시험 이름을 1~120자로 입력해 주세요.');
  if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > 8) throw new Error('과목은 1~8개까지 설정할 수 있습니다.');
  const sections = input.sections.map((s, i) => {
    const start = Number(s.start), end = Number(s.end), count = Number(s.count), minutes = Number(s.minutes);
    if (!s.name || typeof s.name !== 'string' || s.name.length > 40) throw new Error(`${i + 1}번째 과목 이름을 입력해 주세요.`);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 10000) throw new Error(`${s.name}: PDF 시작·끝 페이지를 확인해 주세요.`);
    if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isFinite(minutes) || minutes < 0.1 || minutes > 180) throw new Error(`${s.name}: 문항 수는 1~100개, 시간은 0.1~180분입니다.`);
    const key = s.key == null ? null : parseKey(s.key, count);
    return { name: s.name.trim(), start, end, count, minutes, key };
  });
  return { title: input.title.trim(), sections };
}
export function parseKey(input, count) {
  const values = Array.isArray(input) ? input : String(input).trim().split(/[\s,;]+/u);
  if (values.length !== count || values.some(v => !/^[1-5]$/.test(String(v)))) throw new Error(`정답은 1~5 사이 숫자 ${count}개를 공백이나 쉼표로 구분해 입력해 주세요.`);
  return values.map(Number);
}
export function createExam(config, pdfHash, now = Date.now()) {
  config = validateConfig(config);
  return { version: VERSION, id: crypto.randomUUID(), title: config.title, createdAt: now, pdfHash,
    sections: config.sections.map(s => ({ ...s, items: Array.from({length:s.count}, () => ({answer:null, status:'unreached', ms:0})), startedAt:null, endedAt:null, elapsed:0 })),
    phase:'ready', sectionIndex:0, questionIndex:0, questionStartedAt:null, deadline:null, selection:null, memo:'', reflection:'', drawings:[] };
}
export function startSection(state, now = Date.now()) {
  if (!['ready','between'].includes(state.phase)) return false;
  const section = state.sections[state.sectionIndex];
  state.phase = 'running'; state.questionIndex = 0; state.selection = null;
  section.startedAt = now; state.questionStartedAt = now; state.deadline = now + section.minutes * 60000;
  return true;
}
export function chooseAnswer(state, answer, now = Date.now()) {
  if (expire(state, now) || state.phase !== 'running' || !Number.isInteger(answer) || answer < 1 || answer > 5) return false;
  state.selection = answer; return true;
}
function recordCurrent(state, at, skip = false, reason = 'submitted') {
  const section = state.sections[state.sectionIndex];
  section.items[state.questionIndex] = {answer:skip ? null : state.selection, status:skip ? 'skipped' : state.selection == null ? reason : 'answered', ms:Math.max(0, at - state.questionStartedAt)};
}
function closeSection(state, at) {
  const section = state.sections[state.sectionIndex];
  section.endedAt = at; section.elapsed = Math.max(0, at - section.startedAt);
  state.selection = null; state.questionStartedAt = null; state.deadline = null;
  if (state.sectionIndex + 1 < state.sections.length) { state.sectionIndex++; state.phase = 'between'; }
  else state.phase = 'finished';
}
export function advance(state, skip = false, now = Date.now(), expectedIndex = state.questionIndex) {
  if (expire(state, now) || state.phase !== 'running' || state.questionIndex !== expectedIndex) return false;
  if (!skip && state.selection == null) return false;
  recordCurrent(state, now, skip);
  if (state.questionIndex + 1 === state.sections[state.sectionIndex].count) closeSection(state, now);
  else { state.questionIndex++; state.questionStartedAt = now; state.selection = null; }
  return true;
}
export function expire(state, now = Date.now()) {
  if (state.phase !== 'running' || now < state.deadline) return false;
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
  let correct=0, wrong=0, answered=0, skipped=0, unreached=0, unanswered=0, over=0;
  section.items.forEach((item, i) => {
    const r=resultOf(section,i); correct += r==='정답'; wrong += r==='오답'; answered += item.answer != null;
    skipped += item.status==='skipped'; unreached += item.status==='unreached'; unanswered += item.answer==null && item.status!=='unreached';
    over += item.ms > section.minutes*60000/section.count;
  });
  return {correct,wrong,answered,skipped,unreached,unanswered,over,total:section.count};
}
export function formatTime(ms) {
  const seconds = Math.max(0, Math.floor(ms/1000));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
