/* 스쿼드 메이커 · matches.js
 * 경기 기록: 목록·상세 화면, 골·심판·출전 선수 기록
 */
/* ---------- matches ---------- */
function refName(m){const r=m.referee;if(!r)return '';return roster[r]?roster[r].name:String(r)}
function scorerSummary(m,k){
  const c={};let og=0,unk=0;
  for(const g of m.goals||[]){if(g.team!==k)continue;if(g.og)og++;else if(!g.scorer)unk++;else c[g.scorer]=(c[g.scorer]||0)+1}
  const parts=Object.entries(c).map(([p,n])=>esc(pname(p))+(n>1?' '+n:''));
  if(og)parts.push('자책골'+(og>1?' '+og:''));if(unk)parts.push('기타'+(unk>1?' '+unk:''));
  return parts.join(', ');
}
function renderMatches(){
  if(openMatch&&!matches[openMatch]) openMatch=null;
  $('#mList').classList.toggle('hidden',!!openMatch);
  $('#mDetail').classList.toggle('hidden',!openMatch);
  if(openMatch) return renderMatchDetail();
  const list=sortedMatches();
  if(!list.length){$('#mList').innerHTML=`<div class="card big-empty"><b style="color:var(--ink)">아직 기록된 경기가 없어요</b><br>라인업 탭에서 선수를 배치하고 "경기 기록 시작"을 누르세요.</div>`;return}
  $('#mList').innerHTML=`<div class="list-head"><h2>경기 기록 <span class="pill">${list.length}경기</span></h2></div><div class="mlist">`+
    list.map(([id,m])=>{const A=m.teams.A,B=m.teams.B;const sa=score(m,'A'),sb=score(m,'B');
      return `<button class="mcard" data-open="${id}">
        <div class="mc-top"><span>${fmtDate(m.date)}</span>${m.title?`<span>· ${esc(m.title)}</span>`:''}${refName(m)?`<span>· 심판 ${esc(refName(m))}</span>`:''}${!m.finished?'<span class="pill live">진행 중</span>':''}</div>
        <div class="mc-score"><div class="mc-team"><span class="dot" style="background:${A.color}"></span><span>${esc(A.name)}</span></div>
          <div class="mc-num">${sa} : ${sb}</div>
          <div class="mc-team r"><span>${esc(B.name)}</span><span class="dot" style="background:${B.color}"></span></div></div>
        <div class="mc-scorers"><div>${scorerSummary(m,'A')}</div><div>${scorerSummary(m,'B')}</div></div>
      </button>`}).join('')+'</div>';
}
function renderMatchDetail(){
  const m=matches[openMatch];
  if(document.activeElement!==$('#mdDate')) $('#mdDate').value=m.date||'';
  if(document.activeElement!==$('#mdTitle')) $('#mdTitle').value=m.title||'';
  if(document.activeElement!==$('#mdRef')) $('#mdRef').value=refName(m);
  const sa=score(m,'A'),sb=score(m,'B');
  const team=k=>{const tm=m.teams[k];return `<div class="sb-team"><div class="sb-name"><span class="dot" style="background:${tm.color}"></span><span>${esc(tm.name)}</span></div>
    <div class="sb-score">${k==='A'?sa:sb}</div><button class="btn primary" data-goal="${k}">+ 골</button></div>`};
  let ra=0,rb=0;
  const goals=(m.goals||[]).map(g=>{g.team==='A'?ra++:rb++;const tm=m.teams[g.team];
    const who=g.og?'상대 자책골':g.scorer?esc(pname(g.scorer)):'득점자 모름';
    return `<div class="goal-row"><span class="gs">${ra}:${rb}</span><span class="dot" style="background:${tm.color}"></span>
      <span class="who"><b>${who}</b>${g.assist?`<small>도움 ${esc(pname(g.assist))}</small>`:''}</span>
      <button class="x" data-delgoal="${g.id}" aria-label="골 삭제">×</button></div>`}).join('');
  const squad=k=>{const tm=m.teams[k];return `<div><h3><span class="dot" style="background:${tm.color}"></span>${esc(tm.name)} <span class="pill">${(tm.players||[]).length}명</span></h3>
    <div class="chips">${(tm.players||[]).map(p=>`<div class="chip"><span>${esc(pname(p))}</span><button class="x" data-rmp="${k}:${p}" aria-label="빼기">×</button></div>`).join('')}
    <button class="chip add" data-addp="${k}">+ 추가</button></div></div>`};
  $('#mdBody').innerHTML=`
    <div class="card scoreboard">${team('A')}<div class="sb-mid">:${m.finished?'<span class="pill">종료</span>':'<span class="pill live">진행 중</span>'}</div>${team('B')}</div>
    <div class="card"><h2>득점 기록 <span class="pill">${(m.goals||[]).length}골</span></h2>${goals||'<p class="empty">아직 골이 없어요. 위의 "+ 골"을 눌러 기록하세요.</p>'}</div>
    <div class="card"><h2>출전 선수</h2><div class="squads">${squad('A')}${squad('B')}</div><p class="sub">교체로 뛴 사람은 "+ 추가"로 넣어야 출전 기록에 잡혀요.</p></div>
    <div class="md-actions"><button class="btn" data-mact="finish">${m.finished?'다시 진행 중으로':'경기 종료'}</button><button class="btn danger" data-mact="delete">경기 삭제</button></div>`;
}


/* ================= events: matches ================= */
$('#mList').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b){openMatch=b.dataset.open;renderAll();window.scrollTo(0,0)}});
$('#mdBack').addEventListener('click',()=>{openMatch=null;renderAll()});
$('#mdDate').addEventListener('change',e=>{const m=matches[openMatch];if(!m)return;m.date=e.target.value||today();putMatch(openMatch);renderAll()});
$('#mdRef').addEventListener('input',e=>{const m=matches[openMatch];if(!m)return;m.referee=e.target.value.trim();putMatch(openMatch,600)});
$('#mdTitle').addEventListener('input',e=>{const m=matches[openMatch];if(!m)return;m.title=e.target.value;putMatch(openMatch,600)});
$('#mdBody').addEventListener('click',e=>{
  const m=matches[openMatch];if(!m) return;const id=openMatch;
  const g=e.target.closest('[data-goal]');if(g){openGoal(id,g.dataset.goal);return}
  const dg=e.target.closest('[data-delgoal]');if(dg){m.goals=(m.goals||[]).filter(x=>x.id!==dg.dataset.delgoal);putMatch(id);renderAll();toast('골을 지웠어요');return}
  const rp=e.target.closest('[data-rmp]');if(rp){const [k,p]=rp.dataset.rmp.split(':');m.teams[k].players=m.teams[k].players.filter(x=>x!==p);putMatch(id);renderAll();return}
  const ap=e.target.closest('[data-addp]');if(ap){openAddPlayer(id,ap.dataset.addp);return}
  const a=e.target.closest('[data-mact]');
  if(a&&a.dataset.mact==='finish'){m.finished=!m.finished;putMatch(id);renderAll();if(m.finished)toast(`경기 종료 · ${m.teams.A.name} ${score(m,'A')} : ${score(m,'B')} ${m.teams.B.name}`);return}
  if(a&&a.dataset.mact==='delete'){confirmBox('경기 삭제','이 경기의 스코어와 득점 기록이 모두 지워지고, 선수 기록에서도 빠져요.','삭제',()=>{delete matches[id];delMatchDoc(id);openMatch=null;renderAll();toast('경기를 삭제했어요')},true)}
});

function openGoal(id,k){
  const m=matches[id];const tm=m.teams[k];
  const gs={scorer:undefined,assist:null};
  const players=tm.players||[];
  const body=()=>`
    <div class="pick-label">득점</div>
    <div class="picks">${players.map(p=>`<button class="pick ${gs.scorer===p?'on':''}" data-sc="${p}">${esc(pname(p))}</button>`).join('')}
      <button class="pick alt ${gs.scorer==='og'?'on':''}" data-sc="og">상대 자책골</button>
      <button class="pick alt ${gs.scorer==='unk'?'on':''}" data-sc="unk">모름</button></div>
    <div class="pick-label">도움 (선택)</div>
    <div class="picks">${players.filter(p=>p!==gs.scorer).map(p=>`<button class="pick ${gs.assist===p?'on':''}" data-as="${p}">${esc(pname(p))}</button>`).join('')}
      <button class="pick alt ${gs.assist===null?'on':''}" data-as="">없음</button></div>
    ${players.length?'':'<p>이 팀에 출전 선수가 없어요. 경기 화면의 "출전 선수"에서 먼저 추가하세요.</p>'}`;
  openModal('',body(),[{label:'취소'},{label:'골 기록',primary:true,fn:()=>{
    if(gs.scorer===undefined){toast('득점한 선수를 골라 주세요');return false}
    const goal={id:uid(),team:k,scorer:null,assist:gs.assist||null,og:false,ts:Date.now()};
    if(gs.scorer==='og'){goal.og=true;goal.assist=null}else if(gs.scorer!=='unk')goal.scorer=gs.scorer;
    (m.goals=m.goals||[]).push(goal);putMatch(id);renderAll();
    toast(`${tm.name} 골! ${score(m,'A')} : ${score(m,'B')}`);
  }}]);
  $('#mTitle').innerHTML=`<span class="dot" style="background:${tm.color}"></span>${esc(tm.name)} 골 기록`;
  modalClick=e=>{
    const s=e.target.closest('[data-sc]');if(s){gs.scorer=s.dataset.sc;if(gs.assist===gs.scorer)gs.assist=null;if(gs.scorer==='og')gs.assist=null;$('#mBody').innerHTML=body();return}
    const a=e.target.closest('[data-as]');if(a){gs.assist=a.dataset.as||null;$('#mBody').innerHTML=body()}
  };
}
function openAddPlayer(id,k){
  const m=matches[id];const inMatch=new Set([...(m.teams.A.players||[]),...(m.teams.B.players||[])]);
  const att=new Set(cur.attendees);
  const cands=Object.keys(roster).filter(p=>!inMatch.has(p)).sort((a,b)=>(att.has(b)-att.has(a))||pname(a).localeCompare(pname(b),'ko'));
  openModal(`${m.teams[k].name}에 선수 추가`,cands.length?`<div class="picks">${cands.map(p=>`<button class="pick" data-ap="${p}">${esc(pname(p))}</button>`).join('')}</div>`:'<p>추가할 수 있는 선수가 없어요. 라인업 탭에서 참가자를 먼저 추가하세요.</p>',[{label:'닫기'}]);
  modalClick=e=>{const b=e.target.closest('[data-ap]');if(!b)return;m.teams[k].players.push(b.dataset.ap);putMatch(id);closeModal();renderAll()};
}
