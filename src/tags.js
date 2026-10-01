import {resultOf,formatTime,escapeHTML as e} from './core.js';
export const tagNote='채점한 도달 문항 기준이며 건너뜀·미응답도 포함합니다. 3문항 미만은 표본 부족입니다. 강점 후보는 표시 없는 정답률 80% 이상·평균 기준시간 이내, 보완 유형은 정답률 50% 미만입니다. 여러 태그가 있는 문항은 각각 집계하며 두 표시는 중복될 수 있습니다. 해설 기반 유형은 추정 분류입니다.';
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
      const label=g.attempts<3?'표본 부족':rate<.5?'보완할 유형':g.unmarked/g.attempts>=.8&&average<=target?'강점 후보':average>target?'시간 관리':g.guessedCount||g.uncertainCount?'재확인':'연습 중';
      return {...g,rate,average,label};
    });
  });
}
export const tagHeaders=['영역','유형','판단','채점한 도달 문항','정답률','표시 없는 정답','찍어서 정답','헷갈려서 정답','평균 시간 / 기준','미도달','헷갈림 전체 / 비율','찍었음 전체 / 비율'];
export function tagRows(exam){return tagSummary(exam).map(g=>[g.area,g.tag,g.label,String(g.attempts),g.rate==null?'—':Math.round(g.rate*100)+'%',String(g.unmarked),String(g.guessed),String(g.uncertain),`${g.attempts?formatTime(g.average):'—'} / ${formatTime(g.target)}`,String(g.unreached),`${g.uncertainCount}개 / ${g.attempts?Math.round(g.uncertainCount/g.attempts*100)+'%':'—'}`,`${g.guessedCount}개 / ${g.attempts?Math.round(g.guessedCount/g.attempts*100)+'%':'—'}`]);}
export function tagTable(exam){return `<div class="table-scroll"><table><thead><tr>${tagHeaders.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${tagRows(exam).map(row=>`<tr>${row.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
export function tagMarkup(exam){
  const groups=tagSummary(exam);if(!groups.length)return '';
  const categories=[['보완할 유형','정확도 보완 필요','accuracy'],['시간 관리','시간 관리 보완 필요','time'],['재확인','헷갈림·찍었음 재확인','review'],['강점 후보','강점 후보','strength'],['연습 중','연습 중','practice'],['표본 부족','표본 부족','sample']];
  const percent=(n,total)=>total?Math.round(n/total*100)+'%':'—';
  const card=g=>`<article class="type-card"><h4>${e(g.tag)}</h4><div class="type-rate"><strong>${g.rate==null?'—':Math.round(g.rate*100)+'%'}</strong><span>정답률</span><small>${g.correct} / ${g.attempts}문제</small></div><p class="type-time">평균 <b>${g.attempts?formatTime(g.average):'—'}</b> / 기준 ${formatTime(g.target)}${g.attempts&&g.average>g.target?` <span>+${Math.ceil((g.average-g.target)/1000)}초</span>`:''}</p><div class="type-flags"><span class="flag-uncertain">헷갈림 ${g.uncertainCount}개 · ${percent(g.uncertainCount,g.attempts)}</span><span class="flag-guessed">찍었음 ${g.guessedCount}개 · ${percent(g.guessedCount,g.attempts)}</span></div><p class="type-foot">표시 없는 정답 ${g.unmarked}개${g.unreached?` · 미도달 ${g.unreached}개`:''}</p></article>`;
  return `<section class="panel type-analysis"><div class="section-title"><h2>유형별 강점·보완점</h2><span class="pill">개인 기록 기준</span></div><p class="subtle">영역별로, 먼저 보완할 유형부터 확인하세요. 헷갈림·찍었음은 오답의 표시도 포함합니다.</p>${[...new Set(groups.map(g=>g.area))].map(area=>`<section class="type-area"><h3>${e(area)}</h3>${categories.map(([label,title,kind])=>{const items=groups.filter(g=>g.area===area&&g.label===label);if(!items.length)return '';const content=`<div class="type-grid">${items.map(card).join('')}</div>`;return kind==='sample'?`<details class="type-category type-sample"><summary>표본 부족 · ${items.length}개 유형</summary>${content}</details>`:`<div class="type-category type-${kind}"><h4 class="type-category-title">${title} <small>${items.length}개 유형</small></h4>${content}</div>`;}).join('')}</section>`).join('')}<details class="type-rules"><summary>분류 기준 자세히 보기</summary><p class="subtle">${e(tagNote)} 정답률과 표시 비율은 채점한 도달 문항을 분모로 사용합니다. 정확도 보완과 시간 보완이 겹치면 정확도 그룹에 한 번만 표시합니다.</p></details></section>`;
}

export function tagCopy(exam){
 const groups=tagSummary(exam);if(!groups.length)return {text:'',html:''};
 const labels=[['보완할 유형','정확도 보완 필요'],['시간 관리','시간 관리 보완 필요'],['재확인','헷갈림·찍었음 재확인'],['강점 후보','강점 후보'],['연습 중','연습 중'],['표본 부족','표본 부족']];
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
