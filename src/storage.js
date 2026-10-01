const prefix = 'skct-room-v1:';
let available = true;
export function load(name, fallback=null) {
  try { const raw = localStorage.getItem(prefix + name); return raw ? JSON.parse(raw) : fallback; }
  catch { available=false; return fallback; }
}
export function save(name, value) {
  try { localStorage.setItem(prefix + name, JSON.stringify(value)); return true; }
  catch { available=false; return false; }
}
export function storageAvailable() { return available; }
export function rememberResult(exam) {
  const results=load('results',[]);
  const index=results.findIndex(r => r.id===exam.id);
  if (index<0) results.unshift(exam); else results[index]=exam;
  return save('results',results);
}
export function savedResults() { return load('results',[]); }
