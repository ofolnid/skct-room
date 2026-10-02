import {resultOf,formatTime,escapeHTML as e} from './core.js';
export const tagNote='채점한 도달 문항 기준이며 건너뜀·미응답도 포함합니다. 2문항 미만은 표본 부족입니다. 강점 후보는 표시 없는 정답률 80% 이상·평균 기준시간 이내, 보완 유형은 정답률 50% 미만입니다. 여러 태그가 있는 문항은 각각 집계하며 두 표시는 중복될 수 있습니다. 해설 기반 유형은 추정 분류입니다.';
export function tagSummary(exam) {
  return exam.sections.flatMap(section=>{
    const groups=new Map(),target=section.minutes*60000/section.count;
    section.items.forEach((item,index)=>{
      for(const tag of section.tags?.[index]||[]) {
        if(!groups.has(tag))groups.set(tag,{area:section.name,tag,total:0,attempts:0,correct:0,unmarked:0,guessed:0,uncertain:0,guessedCount:0,uncertainCount:0,unreached:0,ms:0,target});
        const g=groups.get(tag);g.total++;
        if(item.status==='unreached'){g.unreached++;continue;}
        if(!section.key)continue;
        g.attempts++;g.ms+=item.ms;g.guessedCount+=!!item.guessed;g.uncertainCount+=!!item.uncertain;
        if(resultOf(section,index)==='정답'){g.correct++;g.unmarked+=!item.guessed&&!item.uncertain;g.guessed+=!!item.guessed;g.uncertain+=!!item.uncertain;}
      }
    });
    return [...groups.values()].map(g=>{
      const rate=g.attempts?g.correct/g.attempts:null,average=g.attempts?g.ms/g.attempts:0;
      const label=g.attempts<2?'표본 부족':rate<.5?'보완할 유형':g.unmarked/g.attempts>=.8&&average<=target?'강점 후보':average>target?'시간 관리':g.guessedCount||g.uncertainCount?'재확인':'보통';
      return {...g,rate,average,label};
    });
  });
}
export const tagHeaders=['영역','유형','판단','채점한 도달 문항','정답률','표시 없는 정답','찍어서 정답','헷갈려서 정답','평균 시간 / 기준','미도달','헷갈림 전체 / 비율','찍었음 전체 / 비율'];
export function tagRows(exam){return tagSummary(exam).map(g=>[g.area,g.tag,g.label,String(g.attempts),g.rate==null?'—':Math.round(g.rate*100)+'%',String(g.unmarked),String(g.guessed),String(g.uncertain),`${g.attempts?formatTime(g.average):'—'} / ${formatTime(g.target)}`,String(g.unreached),`${g.uncertainCount}개 / ${g.attempts?Math.round(g.uncertainCount/g.attempts*100)+'%':'—'}`,`${g.guessedCount}개 / ${g.attempts?Math.round(g.guessedCount/g.attempts*100)+'%':'—'}`]);}
export function tagTable(exam){return `<div class="table-scroll"><table><thead><tr>${tagHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${tagRows(exam).map(row=>`<tr>${row.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
export function tagMarkup(exam){
  const groups=tagSummary(exam);if(!groups.length)return '';
  const categories=[['강점 후보','강점 후보','strength'],['보완할 유형','정확도 보완 필요','accuracy'],['시간 관리','시간 단축 필요','time'],['재확인','헷갈림·찍었음 재확인','review'],['보통','보통','practice'],['표본 부족','표본 부족','sample']];
  const percent=(n,total)=>total?Math.round(n/total*100)+'%':'—';
  const row=g=>`<article class="type-row"><div class="type-name"><h5>${e(g.tag)}</h5><small>표시 없는 정답 ${g.unmarked}개${g.unreached?` · 미도달 ${g.unreached}개`:''}</small></div><div class="type-row-rate" data-label="정답률"><div class="type-rate-line"><span class="type-rate-track" aria-hidden="true"><i style="width:${g.rate==null?0:Math.round(g.rate*100)}%"></i></span><strong>${g.rate==null?'—':Math.round(g.rate*100)+'%'}</strong></div><small>${g.correct} / ${g.attempts}문제</small></div><div class="type-row-time" data-label="평균 / 기준"><b>${g.attempts?formatTime(g.average):'—'}</b><span> / ${formatTime(g.target)}</span>${g.attempts&&g.average>g.target?`<small class="type-time-over">+${Math.ceil((g.average-g.target)/1000)}초</small>`:g.attempts?'<small>기준 시간 이내</small>':'<small>시간 기록 없음</small>'}</div><div class="type-row-flag ${g.uncertainCount?'flag-uncertain':'type-zero'}" data-label="헷갈림"><span>${g.uncertainCount}개 · ${percent(g.uncertainCount,g.attempts)}</span></div><div class="type-row-flag ${g.guessedCount?'flag-guessed':'type-zero'}" data-label="찍었음"><span>${g.guessedCount}개 · ${percent(g.guessedCount,g.attempts)}</span></div></article>`;
  return `<section class="panel type-analysis"><div class="section-title"><h2>유형별 강점·보완점</h2><span class="pill">개인 기록 기준</span></div><p class="subtle">영역별로 강점 후보를 먼저, 보완할 유형을 이어서 확인하세요. 헷갈림·찍었음은 오답의 표시도 포함합니다.</p>${[...new Set(groups.map(g=>g.area))].map(area=>`<section class="type-area"><h3>${e(area)}</h3><div class="type-table-heading" aria-hidden="true"><span>분류</span><div class="type-columns"><span>유형</span><span>정답률</span><span>평균 / 기준</span><span>헷갈림</span><span>찍었음</span></div></div>${categories.map(([label,title,kind])=>{const items=groups.filter(g=>g.area===area&&g.label===label);if(!items.length)return '';const content=`<div class="type-list">${items.map(row).join('')}</div>`;return kind==='sample'?`<details class="type-category type-sample"><summary>표본 부족 · ${items.length}개 유형</summary>${content}</details>`:`<div class="type-category type-${kind}"><h4 class="type-category-title">${title} <small>${items.length}개 유형</small></h4>${content}</div>`;}).join('')}</section>`).join('')}<details class="type-rules"><summary>분류 기준 자세히 보기</summary><p class="subtle">${e(tagNote)} 정답률과 표시 비율은 채점한 도달 문항을 분모로 사용합니다. 정확도 보완과 시간 보완이 겹치면 정확도 그룹에 한 번만 표시합니다.</p></details></section>`;
}

export function tagCopy(exam){
 const groups=tagSummary(exam);if(!groups.length)return {text:'',html:''};
 const labels=[['강점 후보','강점 후보'],['보완할 유형','정확도 보완 필요'],['시간 관리','시간 단축 필요'],['재확인','헷갈림·찍었음 재확인'],['보통','보통'],['표본 부족','표본 부족']];
 const blocks=[];
 for(const area of new Set(groups.map(g=>g.area))){
   blocks.push({heading:area,level:3});
   for(const [label,title] of labels){
     const items=groups.filter(g=>g.area===area&&g.label===label);if(!items.length)continue;blocks.push({heading:title,level:4});
     for(const g of items){const pct=n=>g.attempts?Math.round(n/g.attempts*100)+'%':'—';blocks.push({line:`${g.tag} · 정답률 ${g.rate==null?'—':pct(g.correct)} (${g.correct}/${g.attempts}문제) · 헷갈림 전체 ${g.uncertainCount}개 (${pct(g.uncertainCount)}) · 찍었음 전체 ${g.guessedCount}개 (${pct(g.guessedCount)}) · 평균 ${g.attempts?formatTime(g.average):'—'} / 기준 ${formatTime(g.target)} · 미도달 ${g.unreached}개`});}
   }
 }
 return {text:'\n\n유형별 강점·보완점\n'+tagNote+'\n'+blocks.map(b=>b.heading?'\n'+b.heading:b.line).join('\n'),html:'<h2>유형별 강점·보완점</h2><p>'+e(tagNote)+'</p>'+blocks.map(b=>b.heading?`<h${b.level}>${e(b.heading)}</h${b.level}>`:`<p>${e(b.line)}</p>`).join('')};
}
