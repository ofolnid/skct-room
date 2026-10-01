import { parseKey,validateMetadata,validateTags } from './core.js';
export function validateAnswerSet(input) {
  if(!input || typeof input.id!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id) || typeof input.title!=='string' || !input.title.trim() || input.title.length>120)throw new Error('정답 세트 ID와 시험 이름을 확인하세요.');
  if(!Array.isArray(input.sections) || input.sections.length<1 || input.sections.length>8)throw new Error('정답 세트의 과목 수를 확인하세요.');
  if(new Set(input.sections.map(s=>s?.name?.trim())).size!==input.sections.length)throw new Error('정답 세트의 영역 이름이 중복되었습니다.');
  return {id:input.id,title:input.title.trim(),sections:input.sections.map(s=>{
    if(!s || typeof s.name!=='string' || !s.name.trim() || s.name.length>40 || !Number.isInteger(s.count) || s.count<1 || s.count>100)throw new Error('정답 세트의 과목 이름·문항 수를 확인하세요.');
    return {name:s.name.trim(),count:s.count,key:parseKey(s.key,s.count),difficulty:s.difficulty==null?null:validateMetadata(s.difficulty,s.count,'difficulty'),correctRate:s.correctRate==null?null:validateMetadata(s.correctRate,s.count,'correctRate'),tags:s.tags==null?null:validateTags(s.tags,s.count),source:typeof s.source==='string'?s.source.slice(0,200):''};
  })};
}
export function applyAnswerSet(config,set) {
  const matched=config.sections.map(s=>set.sections.find(k=>k.name===s.name.trim() && k.count===s.count));
  if(matched.some(s=>!s))throw new Error('정답 세트의 영역 이름·문항 수와 시험 설정이 다릅니다.');
  return {...config,sections:config.sections.map((s,i)=>({...s,key:matched[i].key,difficulty:matched[i].difficulty,correctRate:matched[i].correctRate,tags:matched[i].tags,source:matched[i].source}))};
}
export async function loadAnswerSets() {
  const response=await fetch(new URL('./answer-sets.json',import.meta.url));
  if(!response.ok)throw new Error('배포된 정답 세트 파일을 읽지 못했습니다.');
  const data=await response.json();if(!Array.isArray(data) || data.length>200)throw new Error('정답 세트 파일 형식이 올바르지 않습니다.');
  const sets=data.map(validateAnswerSet);if(new Set(sets.map(s=>s.id)).size!==sets.length)throw new Error('정답 세트 ID가 중복되었습니다.');return sets;
}

export function clearAnswerMetadata(section) {
  return {...section,key:null,tags:null,difficulty:null,correctRate:null,source:''};
}

export function regradeAnswerSet(exam,set) {
  if(exam.phase!=='finished')throw new Error('시험 종료 후 정답 세트를 변경할 수 있습니다.');
  return {...applyAnswerSet(exam,set),title:set.title};
}
