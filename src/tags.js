import {resultOf,formatTime,escapeHTML as e} from './core.js';
export const tagNote='채점한 도달 문항 기준이며 건너뜀·미응답도 포함합니다. 3문항 미만은 표본 부족입니다. 강점 후보는 표시 없는 정답률 80% 이상·평균 기준시간 이내, 보완 유형은 정답률 50% 미만입니다. 여러 태그가 있는 문항은 각각 집계하며 두 표시는 중복될 수 있습니다. 해설 기반 유형은 추정 분류입니다.';
export function tagSummary(exam) {
  return exam.sections.flatMap(section=>{
    const groups=new Map(),target=section.minutes*60000/section.count;
    section.items.forEach((item,index)=>{
      for(const tag of section.tags?.[index]||[]) {
        if(!groups.has(tag))groups.set(tag,{area:section.name,tag,total:0,attempts:0,correct:0,unmarked:0,guessed:0,uncertain:0,unreached:0,ms:0,target});
        const g=groups.get(tag);g.total++;
        if(item.status==='unreached'){g.unreached++;continue;}
        if(!section.key)continue;
        g.attempts++;g.ms+=item.ms;
        if(resultOf(section,index)==='정답'){g.correct++;g.unmarked+=!item.guessed&&!item.uncertain;g.guessed+=!!item.guessed;g.uncertain+=!!item.uncertain;}
      }
    });
    return [...groups.values()].map(g=>{
      const rate=g.attempts?g.correct/g.attempts:null,average=g.attempts?g.ms/g.attempts:0;
      const label=g.attempts<3?'표본 부족':rate<.5?'보완할 유형':g.unmarked/g.attempts>=.8&&average<=target?'강점 후보':average>target?'시간 관리':g.guessed||g.uncertain?'재확인':'연습 중';
      return {...g,rate,average,label};
    });
  });
}
export const tagHeaders=['영역','유형','판단','채점한 도달 문항','정답률','표시 없는 정답','찍어서 정답','헷갈려서 정답','평균 시간 / 기준','미도달'];
export function tagRows(exam){return tagSummary(exam).map(g=>[g.area,g.tag,g.label,String(g.attempts),g.rate==null?'—':Math.round(g.rate*100)+'%',String(g.unmarked),String(g.guessed),String(g.uncertain),`${g.attempts?formatTime(g.average):'—'} / ${formatTime(g.target)}`,String(g.unreached)]);}
export function tagTable(exam){return `<div class="table-scroll"><table><thead><tr>${tagHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${tagRows(exam).map(row=>`<tr>${row.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
export function tagMarkup(exam){
  if(!tagSummary(exam).length)return '';
  return `<section class="panel"><div class="section-title"><h2>유형별 강점·보완점</h2><span class="pill">개인 기록 기준</span></div><p class="subtle">${e(tagNote)}</p>${tagTable(exam)}</section>`;
}
