/* 스쿼드 메이커 · render.js
 * 화면 그리기: 탭 전환, 라인업 화면(경기장·후보·대기 명단·팀 명단)
 */
/* ================= render ================= */
function renderAll(){
  computeStats();
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.view===view));
  $('#vLineup').classList.toggle('hidden',view!=='lineup');
  $('#vMatches').classList.toggle('hidden',view!=='matches');
  $('#vStats').classList.toggle('hidden',view!=='stats');
  renderLineup();
  if(view==='matches') renderMatches();
  if(view==='stats') renderStats();
  $('#foot').textContent='기록은 이 폰(브라우저)에만 저장돼요. 폰을 바꾸거나 다른 사람에게 넘길 땐 백업 파일을 쓰세요.';
}
function showBanner(){
  const b=$('#banner');
  if(readOnly){b.textContent='보기 전용이에요. 바꾼 내용은 저장되지 않아요.';b.classList.remove('hidden')}
  else b.classList.add('hidden');
}

/* ---------- lineup ---------- */
function renderLineup(){
  const t=T();
  $('#tabs').innerHTML=keys().map(k=>{const tm=cur.teams[k];const c=tm.slots.filter(s=>s.pid).length;const sb=subsOf(tm).length;
    return `<button class="tab ${cur.active===k?'on':''}" data-team="${k}"><span class="dot" style="background:${tm.color}"></span>${esc(tm.name)}<span class="cnt">${c}/${cur.size}${sb?` +${sb}`:''}</span></button>`}).join('');
  const subs=subsOf(t);
  $('#subs').innerHTML=`<div class="subs-h">후보 <span style="opacity:.7">${subs.length}</span></div><div class="subs-list">`+
    subs.map((p,i)=>`<div class="sbs ${sel&&sel.kind==='sub'&&sel.idx===i?'sel':''}" data-sub="${i}" style="--tc:${t.color}"><span class="tag">SUB</span><span class="sn">${esc(pname(p))}</span></div>`).join('')+
    (subs.length<12?`<div class="sbs empty ${sel&&sel.kind==='sub'&&sel.idx===subs.length?'sel':''}" data-sub="${subs.length}">+ 후보</div>`:'')+'</div>';
  $('#sizeSel').innerHTML=Array.from({length:MAX-MIN+1},(_,i)=>MIN+i).map(n=>`<option value="${n}" ${n===cur.size?'selected':''}>${n} vs ${n}</option>`).join('');
  const custom=!FORMATIONS[cur.size].includes(t.formation);
  $('#formation').innerHTML=(custom?'<option value="" selected>직접 배치</option>':'')+FORMATIONS[cur.size].map(f=>`<option value="${f}" ${f===t.formation?'selected':''}>${f}</option>`).join('');
  if(document.activeElement!==$('#teamName')) $('#teamName').value=t.name;
  if(document.activeElement!==$('#refIn')) $('#refIn').value=cur.referee||'';
  $('#pitchTag').textContent=`${t.name} · ${cur.size}인 ${fname(t)}`;

  const fg=textOn(t.color);
  $('#tokens').innerHTML=t.slots.map((s,i)=>{
    const filled=!!s.pid, isSel=sel&&sel.kind==='slot'&&sel.idx===i, g=filled?goalsOf(s.pid):0;
    const P=posOf(s);
    const st=filled?`background:${POSCOL[P.cat]};color:${textOn(POSCOL[P.cat])}`:'';
    return `<div class="slot ${filled?'filled':''} ${isSel?'sel':''}" data-slot="${i}" style="left:${s.x}%;top:${s.y}%;--pc:${POSCOL[P.cat]};--tc:${t.color}">
      <div class="disc" style="${st}">${P.code}${g?`<span class="gb" title="통산 ${g}골">${g}</span>`:''}</div><div class="nm">${filled?esc(pname(s.pid)):''}</div></div>`}).join('');

  const b=bench();
  const att=cur.attendees.filter(id=>roster[id]);
  $('#benchCount').textContent=b.length+'명';
  $('#total').textContent=att.length+'명';
  const taken=att.filter(id=>!b.includes(id));
  const free=b.map(id=>{const g=goalsOf(id);
    return `<div class="chip ${sel&&sel.kind==='bench'&&sel.pid===id?'sel':''}" data-pid="${id}"><span>${esc(pname(id))}</span>${g?`<span class="cg">${BALL}${g}</span>`:''}<button class="x" data-del="${id}" aria-label="오늘 명단에서 빼기">×</button></div>`}).join('');
  const tk=taken.map(id=>{const w=whereIs(id);const tm=cur.teams[w.k];
    return `<div class="chip taken" data-taken="${id}" title="${esc(tm.name)} ${w.code}"><span class="dot" style="background:${tm.color}"></span><span>${esc(pname(id))}</span><span class="tk">${w.code}</span></div>`}).join('');
  $('#benchList').innerHTML=att.length?(free||'<p class="empty" style="width:100%;margin:0 2px 4px">모든 참가자가 배치됐어요.</p>')+tk
    :'<p class="empty">먼저 위에서 참가자 이름을 추가하세요.</p>';

  const past=pastList();
  $('#pastBox').classList.toggle('hidden',!past.ids.length);
  $('#pastLabel').textContent=past.m?`지난 경기 참가자 · ${fmtDate(past.m.date)}`:'지난 경기 참가자';
  $('#pastList').innerHTML=past.ids.map(id=>{const g=goalsOf(id);return `<div class="chip past" data-addpast="${id}" title="눌러서 오늘 명단에 추가"><span>+ ${esc(pname(id))}</span>${g?`<span class="cg">${BALL}${g}</span>`:''}<button class="x" data-hidepast="${id}" aria-label="목록에서 지우기">×</button></div>`}).join('');

  $('#delTeam').disabled=cur.teamCount<2;$('#addTeam').disabled=cur.teamCount>=MAXT;
  $('#teamSub').textContent=cur.teamCount>=MAXT?`팀은 최대 ${MAXT}개까지예요.`:cur.teamCount<2?'경기 기록은 팀이 2개 이상일 때 할 수 있어요.':'팀 색은 순서대로 정해져요. 풋살 밀어내기는 팀을 더 만들고, 경기 시작 때 붙을 두 팀을 골라요.';
  $('#otherBox').innerHTML=keys().map(k=>{const o=cur.teams[k];const fo=o.slots.filter(s=>s.pid);const os=subsOf(o);const isCur=k===cur.active;
    return `<button class="team-roster ${isCur?'cur':''}" data-goteam="${k}" title="${esc(o.name)} 스쿼드 보기"><h2><span class="dot" style="background:${o.color}"></span>${esc(o.name)} 명단 <span class="pill">${fo.length}/${cur.size}${os.length?` +${os.length}`:''}</span><span class="go">${isCur?'보는 중':'보기 →'}</span></h2>
    <div class="other-list">${fo.length||os.length?fo.map(s=>`<span>${posOf(s).code} <b>${esc(pname(s.pid))}</b></span>`).join('')+os.map(p=>`<span>SUB <b>${esc(pname(p))}</b></span>`).join(''):'<span>아직 배치된 선수가 없어요.</span>'}</div></button>`}).join('');
  const sm=$('#startMatch');sm.disabled=cur.teamCount<2;
  sm.textContent=cur.teamCount<2?'경기 기록은 팀이 2개 이상일 때 할 수 있어요':cur.teamCount>2?'경기 기록 시작 (붙을 두 팀 고르기)':'이 라인업으로 경기 기록 시작';
  $('#splitRandom').textContent=cur.teamCount<2?'랜덤 채우기':`${cur.teamCount}팀 랜덤 나누기`;
  renderHint();
}
function renderHint(){
  const t=T();let h='';
  if(sel&&sel.kind==='bench') h=`<span><b>${esc(pname(sel.pid))}</b> 선택됨 · 들어갈 자리를 누르세요</span><button class="mini" data-act="cancel">취소</button>`;
  else if(sel&&sel.kind==='sub'){const p=subsOf(t)[sel.idx];
    h=p?`<span><b>${esc(pname(p))}</b> (후보) 선택됨 · 바꿀 자리를 누르세요</span><button class="mini" data-act="out">대기로 빼기</button><button class="mini" data-act="cancel">취소</button>`
       :`<span>후보 빈자리 선택됨 · 대기 명단에서 선수를 누르세요</span><button class="mini" data-act="cancel">취소</button>`;}
  else if(sel&&sel.kind==='slot'){const s=t.slots[sel.idx];
    const pc=posOf(s).code;
    h=s.pid?`<span><b>${esc(pname(s.pid))}</b> (${pc}) 선택됨 · 바꿀 자리를 누르세요</span><button class="mini" data-act="out">대기로 빼기</button><button class="mini" data-act="cancel">취소</button>`
           :`<span>${pc} 빈자리 선택됨 · 대기 명단에서 선수를 누르세요</span><button class="mini" data-act="cancel">취소</button>`;}
  else h='<span>이름을 끌어다 놓거나, 눌러서 고른 뒤 자리를 누르세요. 선수를 빈 잔디로 끌면 위치가 옮겨지고, 후보 칸에 놓으면 후보가 돼요.</span>';
  $('#hint').innerHTML=h;
}
