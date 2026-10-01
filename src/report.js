import {tagMarkup,tagCopy,tagRows,tagHeaders,tagNote} from './tags.js';
import { resultOf, sectionSummary, formatTime, escapeHTML as e } from './core.js';
export function totals(exam) {
  return exam.sections.reduce((out,s)=>{const sum=sectionSummary(s);for(const k of Object.keys(sum))out[k]=(out[k]||0)+sum[k];out.elapsed+=s.elapsed;out.graded+=s.key?s.count:0;return out;},{elapsed:0,graded:0});
}
export function timeChart(section) {
  const target=section.minutes*60000/section.count;
  const max=Math.max(target*1.5,...section.items.map(i=>i.ms));
  const barWidth=600/section.count;
  const y=ms=>140-ms/max*120;
  return `<svg class="time-chart" viewBox="0 0 660 180" role="img" aria-label="${e(section.name)} 문제별 풀이 시간. 기준 ${formatTime(target)}"><line x1="40" x2="640" y1="140" y2="140" stroke="#dde5e1"/><line x1="40" x2="640" y1="${y(target)}" y2="${y(target)}" stroke="#c99b48" stroke-dasharray="5 5"/><text x="640" y="${y(target)-5}" text-anchor="end" class="chart-label">기준 ${formatTime(target)}</text>${section.items.map((item,i)=>{const r=resultOf(section,i), color=r==='정답'?'#27876d':r==='오답'?'#d66c62':item.answer==null?'#b5bdb7':'#728eb6';return `<rect x="${40+i*barWidth+barWidth*.18}" y="${y(item.ms)}" width="${Math.max(2,barWidth*.64)}" height="${Math.max(item.status==='unreached'?0:2,140-y(item.ms))}" rx="3" fill="${color}"><title>${i+1}번 · ${r} · ${formatTime(item.ms)}</title></rect>${section.count<=30?`<text x="${40+i*barWidth+barWidth/2}" y="160" text-anchor="middle" class="chart-label">${i+1}</text>`:''}`;}).join('')}<text x="40" y="178" class="chart-label">문제 번호</text></svg>`;
}
function referenceMarkup(exam) {
  const sections=exam.sections.filter(s=>s.difficulty?.some(v=>v!=null) || s.correctRate?.some(v=>v!=null));
  if(!sections.length)return '';
  return `<section class="panel"><div class="section-title"><h2>해설집 참고 정보와 내 결과</h2><span class="pill">등록된 문항만 분석</span></div>${sections.map(s=>{
    const easyWrong=s.items.filter((item,i)=>s.difficulty?.[i]==='쉬움' && resultOf(s,i)==='오답').length;
    const groups=['쉬움','보통','어려움'].map(d=>{const indexes=s.items.map((_,i)=>i).filter(i=>s.difficulty?.[i]===d),correct=indexes.filter(i=>resultOf(s,i)==='정답').length;return indexes.length?`<div class="difficulty-row"><span>${d}</span><div class="difficulty-track"><i style="width:${s.key?correct/indexes.length*100:0}%"></i></div><span>${s.key?Math.round(correct/indexes.length*100)+'%':'미채점'} (${correct}/${indexes.length})</span></div>`:'';}).join('');
    return `<div class="reference-section"><h3>${e(s.name)}</h3><p class="subtle">${e(s.source || '정답 세트에 입력한 참고 정보')} · 난이도·정답률은 사이트 응시자 통계가 아닙니다.</p>${groups?`<div class="difficulty-summary"><strong>난이도별 내 정답률</strong>${groups}<p class="subtle">쉬움으로 등록된 문제 중 오답 ${easyWrong}개</p></div>`:''}${s.correctRate?.some(v=>v!=null)?`<p class="subtle">문항별 참고 정답률은 아래 상세 결과에 표시됩니다. 참고값으로 난이도를 자동 판정하지 않습니다.</p>`:''}</div>`;
  }).join('')}</section>`;
}
export function reportMarkup(exam) {
  const t=totals(exam), allGraded=t.graded===t.total, rate=t.graded?Math.round(t.correct/t.graded*100):null;
  const timed=exam.sections.flatMap(s=>s.items).filter(i=>i.status!=='unreached');
  const average=timed.length?timed.reduce((sum,i)=>sum+i.ms,0)/timed.length:0;
  const overWrong=exam.sections.flatMap(s=>s.items.map((item,i)=>({item,section:s,index:i}))).filter(v=>resultOf(v.section,v.index)==='오답' && v.item.ms>v.section.minutes*60000/v.section.count);
  return `<div class="result-heading"><div><span class="eyebrow">YOUR EXAM REPORT</span><h1>${e(exam.title)}</h1><p class="subtle">${new Date(exam.createdAt).toLocaleString('ko-KR')} · ${exam.sections.length}개 과목 · 총 ${t.total}문제</p></div><div class="actions no-print"><button id="copy-result" class="secondary">결과 복사</button><button id="download-csv" class="secondary">CSV</button><button id="print-result" class="primary">PDF로 저장 ↗</button></div></div>
  <div class="summary-grid"><div class="stat"><span>정답</span><strong>${t.graded?t.correct:'—'}<small> / ${t.graded || t.total}</small></strong><p>${t.graded?`표시 없는 정답 ${t.unmarkedCorrect} · 찍어서 정답 ${t.guessedCorrect}`:'정답표 입력 후 확인'}</p></div><div class="stat"><span>정답률</span><strong>${rate==null?'—':rate+'%'} </strong><p>${allGraded?'전체 문항 기준':'채점된 과목 기준'}</p></div><div class="stat"><span>총 풀이 시간</span><strong>${formatTime(t.elapsed)}</strong><p>문제 평균 ${formatTime(average)}</p></div><div class="stat"><span>미응답 / 미도달</span><strong>${t.unanswered}<small> / ${t.unreached}</small></strong><p>건너뜀 ${t.skipped}개 포함</p></div></div>
  <section class="panel"><div class="section-title"><h2>과목별 결과</h2><span class="subtle">나의 페이스를 한눈에</span></div><div class="table-scroll"><table><thead><tr><th>과목</th><th>정답 / 전체</th><th>정답률</th><th>풀이 시간 / 제한</th><th>시간 초과 문제</th></tr></thead><tbody>${exam.sections.map(s=>{const v=sectionSummary(s);return `<tr><td><strong>${e(s.name)}</strong></td><td>${s.key?v.correct:'미채점'} / ${s.count}</td><td>${s.key?Math.round(v.correct/s.count*100)+'%':'—'}</td><td>${formatTime(s.elapsed)} / ${formatTime(s.minutes*60000)}</td><td>${v.over}개</td></tr>`;}).join('')}</tbody></table></div></section>
  <section class="panel no-print" id="grading-panel"><div class="section-title"><h2>${allGraded?'정답표 확인 · 수정':'정답을 입력해 채점하세요'}</h2><span class="pill">해설 없이 결과만</span></div><details ${allGraded?'':'open'}><summary>${allGraded?'정답표 펼치기':'과목별 정답 입력'}</summary><form id="grade-form"><div class="key-fields">${exam.sections.map((s,i)=>`<label>${e(s.name)} · ${s.count}문제<textarea data-grade="${i}" rows="2" placeholder="1 3 2 5 …" aria-label="${e(s.name)} 정답표">${s.key?s.key.join(' '):''}</textarea></label>`).join('')}</div><p class="subtle">1~5 숫자를 공백이나 쉼표로 구분하세요. 빈 과목은 미채점으로 유지됩니다.</p><div class="actions"><button class="primary" type="submit">채점하기</button></div></form></details></section>
  <section class="panel"><div class="section-title"><h2>다음 시험을 위한 힌트</h2><span class="subtle">개인 기록 기준</span></div><div class="insight-grid"><div class="insight warm"><strong>시간을 많이 쓴 오답 ${overWrong.length}개</strong><p>${overWrong.length?overWrong.slice(0,8).map(v=>`${e(v.section.name)} ${v.index+1}번`).join(' · '):t.graded?'기준시간을 넘긴 오답이 없습니다.':'채점하면 시간과 정오답을 함께 확인할 수 있습니다.'}</p></div><div class="insight mint"><strong>미도달 ${t.unreached}개 · 건너뜀 ${t.skipped}개</strong><p>과목의 제한시간을 문항 수로 나눈 값이 기준시간입니다. 공식 난이도별 권장시간은 아닙니다.</p></div></div></section>
  <section class="panel"><div class="section-title"><h2>맞았어도 다시 볼 문제</h2><span class="subtle">응시 중 남긴 표시 기준</span></div><div class="insight-grid"><div class="insight warm"><strong>찍어서 맞힌 문제 ${t.guessedCorrect}개</strong><p>찍었음 표시가 있는 정답입니다. 채점 점수에는 포함되지만 이해해서 맞힌 것으로 구분하지 않습니다.</p></div><div class="insight mint"><strong>헷갈렸지만 맞힌 문제 ${t.uncertainCorrect}개</strong><p>헷갈림 표시가 있는 정답입니다. 두 표시가 함께 있으면 양쪽에 포함됩니다. 표시 없는 정답은 ${t.unmarkedCorrect}개입니다.</p></div></div></section>${tagMarkup(exam)}${referenceMarkup(exam)}<section class="panel"><div class="section-title"><h2>문제별 풀이 시간</h2><span class="subtle">점선 = 과목별 평균 배분 기준</span></div>${exam.sections.map(s=>`<div class="chart-section"><h3>${e(s.name)}</h3>${timeChart(s)}</div>`).join('')}<div class="legend"><span class="correct">● 정답</span><span class="wrong">● 오답</span><span>● 미채점·미응답</span></div></section>
  <section class="panel"><div class="section-title"><h2>문제별 상세 결과</h2><div class="filters no-print"><button class="active" data-filter="all">전체</button><button data-filter="wrong">오답</button><button data-filter="over">시간 초과</button><button data-filter="empty">미응답·미도달</button><button data-filter="uncertain">헷갈림</button><button data-filter="guessed">찍었음</button></div></div>${exam.sections.map(s=>`<div class="detail-section"><h3>${e(s.name)} <small>${s.count}문제 · 기준 ${formatTime(s.minutes*60000/s.count)}</small></h3><div class="question-grid">${s.items.map((item,i)=>{const r=resultOf(s,i), target=s.minutes*60000/s.count;return `<article class="question-card ${r==='정답'?'is-correct':r==='오답'?'is-wrong':'is-empty'}" data-wrong="${r==='오답'}" data-over="${item.ms>target}" data-empty="${item.answer==null}" data-uncertain="${!!item.uncertain}" data-guessed="${!!item.guessed}"><div class="question-top"><strong>${String(i+1).padStart(2,'0')}번</strong><div class="result-flags">${item.uncertain?'<span class="flag-uncertain">? 헷갈림</span>':''}${item.guessed?'<span class="flag-guessed">↗ 찍었음</span>':''}</div><span class="result-tag">${r==='정답'?'✓ ':r==='오답'?'✕ ':''}${r}</span></div><p class="question-types">${s.tags?.[i]?.length?s.tags[i].map(e).join(" · "):''}</p><p class="answer-comparison">내 답 <b>${item.answer??'—'}</b> <span>→</span> 정답 <b>${s.key?.[i]??'—'}</b></p><div class="time-comparison"><strong>${item.status==='unreached'?'—':formatTime(item.ms)}</strong><span> / ${formatTime(target)}</span></div><p class="subtle">${item.status==='unreached'?'도달하지 못한 문제':item.ms>target?`기준보다 ${Math.ceil((item.ms-target)/1000)}초 초과`:'기준 시간 이내'}</p>${s.difficulty?.[i]!=null||s.correctRate?.[i]!=null?`<p class="reference-meta">${e(s.difficulty?.[i]||'난이도 미등록')}${s.correctRate?.[i]!=null?` · 참고 정답률 ${s.correctRate[i]}%`:''}</p>`:''}</article>`;}).join('')}</div></div>`).join('')}<p id="filter-empty" class="empty-state" hidden>이 조건에 해당하는 문제가 없습니다.</p></section>
  <section class="panel reflection"><h2>이번 회차 메모</h2><textarea id="reflection" class="no-print" maxlength="10000" placeholder="시간 배분, 헷갈린 유형, 다음 시험에서 바꿀 점을 적어 보세요."></textarea><p class="print-only">${e(exam.reflection || '작성한 메모가 없습니다.').replace(/\n/g,'<br>')}</p></section><p class="report-footnote">개인 연습 기록 · SKCT 공식 서비스와 관련이 없습니다. 결과에 문제집 내용은 포함되지 않습니다.</p>`;
}
export function resultHeaders(exam) {
  const headers=['과목','문제','결과','내 답','정답','풀이 시간','기준 시간','헷갈림','찍었음'];
  if(exam.sections.some(s=>s.difficulty||s.correctRate))headers.push('참고 난이도','참고 정답률');
  if(exam.sections.some(s=>s.tags))headers.push('문항 유형');
  return headers;
}
export function resultRows(exam) {
  const reference=exam.sections.some(s=>s.difficulty||s.correctRate);
  return exam.sections.flatMap(s=>s.items.map((item,i)=>{
    const row=[s.name,String(i+1),resultOf(s,i),String(item.answer??'—'),String(s.key?.[i]??'—'),item.status==='unreached'?'—':formatTime(item.ms),formatTime(s.minutes*60000/s.count),item.uncertain?'O':'—',item.guessed?'O':'—'];
    if(reference)row.push(s.difficulty?.[i]??'—',s.correctRate?.[i]!=null?s.correctRate[i]+'%':'—');if(exam.sections.some(s=>s.tags))row.push((s.tags?.[i]||[]).join(' · ')||'—');return row;
  }));
}
export function copyContent(exam) {
  const t=totals(exam), headers=resultHeaders(exam);
  const rows=resultRows(exam), title=exam.title;
  const typeCopy=tagCopy(exam),typeText=typeCopy.text;
  const text=`${title}\n응시일: ${new Date(exam.createdAt).toLocaleString('ko-KR')}\n정답 ${t.graded?t.correct:'미채점'} / ${t.graded||t.total} · 총 풀이 ${formatTime(t.elapsed)}\n\n${[headers,...rows].map(r=>r.join('\t')).join('\n')}${typeText}\n\n회차 메모\n${exam.reflection||'—'}\n\n기준 시간: 과목 제한시간 ÷ 문항 수`;
  const html=`<h1>${e(title)}</h1><p>응시일: ${e(new Date(exam.createdAt).toLocaleString('ko-KR'))} · 총 풀이 ${formatTime(t.elapsed)}</p><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${typeCopy.html}<h2>회차 메모</h2><p>${e(exam.reflection||'—').replace(/\n/g,'<br>')}</p><p>기준 시간 = 과목 제한시간 ÷ 문항 수</p>`;
  return {text,html};
}
export function csvContent(exam) {
  const safe=v=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\uFEFF'+[['시험 이름',exam.title],['응시일',new Date(exam.createdAt).toISOString()],[],resultHeaders(exam),...resultRows(exam),[],...(tagRows(exam).length?[['유형별 강점·보완점'],[tagNote],tagHeaders,...tagRows(exam),[]]:[]),['회차 메모',exam.reflection||'']].map(r=>r.map(safe).join(',')).join('\r\n');
}
