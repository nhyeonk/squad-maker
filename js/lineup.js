/* 스쿼드 메이커 · lineup.js
 * 라인업 동작: 배치·자리 바꾸기·끌어서 놓기, 참가자 추가, 랜덤 나누기, 팀 추가/삭제, 인원 변경, 경기 시작
 */
/* ================= lineup logic ================= */
function remap(team,f){
  const old=team.slots;const gk=old[0]?old[0].pid:null;
  const rest=old.slice(1).map(s=>s.pid).filter(Boolean);
  const ns=buildSlots(f);ns[0].pid=gk;
  for(let i=1;i<ns.length&&rest.length;i++) ns[i].pid=rest.shift();
  team.formation=f;team.slots=ns;
}
function getP(pl){const t=T();return pl.kind==='slot'?t.slots[pl.idx].pid:(subsOf(t)[pl.idx]||null)}
function setP(pl,pid){const t=T();if(pl.kind==='slot'){t.slots[pl.idx].pid=pid;return}
  const sb=subsOf(t);if(pl.idx<sb.length)sb[pl.idx]=pid;else if(pid)sb.push(pid)}
function tidy(){for(const k of keys()){const t=cur.teams[k];t.subs=subsOf(t).filter(Boolean)}}
function removeEverywhere(pid){for(const k of keys()){const t=cur.teams[k];for(const s of t.slots)if(s.pid===pid)s.pid=null;t.subs=subsOf(t).map(p=>p===pid?null:p)}}
function assignTo(pl,pid){removeEverywhere(pid);setP(pl,pid);tidy()}
function assign(pid,idx){assignTo({kind:'slot',idx},pid)}
function swapP(a,b){const pa=getP(a),pb=getP(b);setP(a,pb);setP(b,pa);tidy()}
function unassign(pl){setP(pl,null);tidy()}
const isPlace=x=>x&&(x.kind==='slot'||x.kind==='sub');
const samePlace=(a,b)=>a&&b&&a.kind===b.kind&&a.idx===b.idx;
function tap(src){
  let changed=false;
  if(src.kind==='bench'){
    if(isPlace(sel)){assignTo(sel,src.pid);sel=null;changed=true}
    else if(sel&&sel.kind==='bench'&&sel.pid===src.pid) sel=null;
    else sel=src;
  }else{
    if(sel&&sel.kind==='bench'){assignTo(src,sel.pid);sel=null;changed=true}
    else if(isPlace(sel)){if(!samePlace(sel,src)&&(getP(sel)||getP(src))){swapP(sel,src);changed=true}sel=null}
    else sel=src;
  }
  changed?commit():renderAll();
}

/* drag */
let drag=null;
function startDrag(e,src,el){
  if(e.button>0) return;
  if(e.pointerType==='mouse') e.preventDefault();
  drag={src,el,sx:e.clientX,sy:e.clientY,moved:false,ghost:null,over:null};
  document.addEventListener('pointermove',onMove,{passive:false});
  document.addEventListener('pointerup',onUp);
  document.addEventListener('pointercancel',cleanup);
}
function srcName(src){if(src.kind==='bench')return pname(src.pid);const p=getP(src);if(p)return pname(p);return src.kind==='slot'?posOf(T().slots[src.idx]).code:'후보'}
function targetAt(x,y){
  const el=document.elementFromPoint(x,y);if(!el) return null;
  const sl=el.closest('[data-slot]');if(sl) return {kind:'slot',idx:+sl.dataset.slot,el:sl};
  const sb=el.closest('[data-sub]');if(sb) return {kind:'sub',idx:+sb.dataset.sub,el:sb};
  const sbx=el.closest('#subs');if(sbx) return {kind:'sub',idx:subsOf(T()).length,el:sbx.querySelector('.sbs.empty')};
  const bn=el.closest('#bench');if(bn) return {kind:'bench',el:bn};
  if(el.closest('#pitch')) return {kind:'pitch',el:null};
  return null;
}
function onMove(e){
  if(!drag) return;
  if(!drag.moved){
    if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<6) return;
    if(isPlace(drag.src)&&!getP(drag.src)&&drag.src.kind==='sub'){cleanup();return}
    drag.moved=true;
    const g=document.createElement('div');g.className='ghost';g.textContent=srcName(drag.src);document.body.appendChild(g);drag.ghost=g;
    drag.el.classList.add('dragging');
  }
  e.preventDefault();
  drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';
  const t=targetAt(e.clientX,e.clientY);
  if(isPlace(drag.src)){
    let html=esc(srcName(drag.src));
    if(drag.src.kind==='slot'&&t&&(t.kind==='pitch'||samePlace(t,drag.src))){
      const r=$('#pitch').getBoundingClientRect();
      const P=posOf({x:clamp((e.clientX-r.left)/r.width*100,5,95),y:clamp((e.clientY-r.top)/r.height*100,4,96)});
      html+=`<span class="gp" style="background:${POSCOL[P.cat]}">→ ${P.code}</span>`;
    }else if(t&&t.kind==='sub'&&!samePlace(t,drag.src)) html+=`<span class="gp" style="background:#fff">→ 후보</span>`;
    if(drag.ghost.innerHTML!==html) drag.ghost.innerHTML=html;
  }
  const tel=t&&t.el&&!samePlace(t,drag.src)?t.el:null;
  if(drag.over!==tel){if(drag.over)drag.over.classList.remove('over');if(tel)tel.classList.add('over');drag.over=tel}
}
function cleanup(){
  document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerup',onUp);document.removeEventListener('pointercancel',cleanup);
  if(drag){if(drag.ghost)drag.ghost.remove();if(drag.over)drag.over.classList.remove('over');drag.el.classList.remove('dragging')}
  drag=null;
}
function onUp(e){
  if(!drag) return;
  const d=drag;cleanup();
  if(!d.moved){tap(d.src);return}
  const t=targetAt(e.clientX,e.clientY);if(!t) return;
  const src=d.src;
  if(src.kind==='bench'){if(isPlace(t)) assignTo(t,src.pid); else return}
  else{
    if(isPlace(t)&&!samePlace(t,src)) swapP(src,t);
    else if(t.kind==='bench') unassign(src);
    else if(src.kind==='slot'){
      const r=$('#pitch').getBoundingClientRect();const s=T().slots[src.idx];
      s.x=clamp((e.clientX-r.left)/r.width*100,5,95);s.y=clamp((e.clientY-r.top)/r.height*100,4,96);
    }else return;
  }
  sel=null;commit();
}

/* ================= events: lineup ================= */
$('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;if(view==='matches'&&b.classList.contains('on'))openMatch=null;sel=null;renderAll();window.scrollTo(0,0)});
$('#tokens').addEventListener('pointerdown',e=>{const s=e.target.closest('[data-slot]');if(s)startDrag(e,{kind:'slot',idx:+s.dataset.slot},s)});
$('#subs').addEventListener('pointerdown',e=>{const s=e.target.closest('[data-sub]');if(s)startDrag(e,{kind:'sub',idx:+s.dataset.sub},s)});
$('#benchList').addEventListener('pointerdown',e=>{if(e.target.closest('[data-del]'))return;const c=e.target.closest('[data-pid]');if(c)startDrag(e,{kind:'bench',pid:c.dataset.pid},c)});
$('#benchList').addEventListener('click',e=>{
  const tk=e.target.closest('[data-taken]');
  if(tk){const w=whereIs(tk.dataset.taken);if(w)toast(`${pname(tk.dataset.taken)}: 이미 ${cur.teams[w.k].name} 선수예요 (${w.code})`);return}
  const d=e.target.closest('[data-del]');if(!d)return;
  cur.attendees=cur.attendees.filter(id=>id!==d.dataset.del);if(sel&&sel.pid===d.dataset.del)sel=null;commit()});
$('#bench').addEventListener('click',e=>{if(e.target.closest('[data-pid],[data-taken]'))return;if(isPlace(sel)&&getP(sel)){unassign(sel);sel=null;commit()}});
$('#pastList').addEventListener('click',e=>{
  const h=e.target.closest('[data-hidepast]');
  if(h){const {mid}=pastList();if(!cur.pastHidden||cur.pastHidden.mid!==mid)cur.pastHidden={mid,ids:[]};cur.pastHidden.ids.push(h.dataset.hidepast);commit();return}
  const b=e.target.closest('[data-addpast]');if(!b)return;if(!cur.attendees.includes(b.dataset.addpast))cur.attendees.push(b.dataset.addpast);commit()});
$('#pastAll').addEventListener('click',()=>{const {ids}=pastList();for(const id of ids)if(!cur.attendees.includes(id))cur.attendees.push(id);commit();if(ids.length)toast(`${ids.length}명 추가했어요`)});
$('#pitch').addEventListener('click',e=>{if(!e.target.closest('[data-slot]')&&sel){sel=null;renderAll()}});
$('#hint').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;
  if(b.dataset.act==='out'&&isPlace(sel)){unassign(sel);sel=null;commit()}else{sel=null;renderAll()}});
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-team]');if(b){cur.active=b.dataset.team;sel=null;commit()}});
$('#formation').addEventListener('change',e=>{if(!e.target.value)return;remap(T(),e.target.value);sel=null;commit()});
$('#resetPos').addEventListener('click',()=>{remap(T(),FORMATIONS[cur.size].includes(T().formation)?T().formation:FORMATIONS[cur.size][0]);sel=null;commit();toast('포메이션 기본 위치로 되돌렸어요')});
$('#refIn').addEventListener('input',e=>{cur.referee=e.target.value.trim();putCurrent()});
$('#teamName').addEventListener('input',e=>{T().name=e.target.value.trim()||(cur.active+'팀');commit()});

function addNames(){
  const raw=$('#nameInput').value;
  const names=raw.split(/[,\n\t·/]+/).map(s=>s.replace(/^\s*\d+[.)]\s*/,'').trim()).filter(Boolean);
  if(!names.length) return;
  $('#nameInput').value='';
  addNameList(names);
}
function addNameList(names){
  const byName=new Map(Object.entries(roster).map(([id,player])=>[player.name,id]));
  let added=0,dup=0;
  for(const n of names){
    const nm=n.slice(0,20);let id=byName.get(nm);
    if(!id){id=uid();roster[id]={name:nm,createdAt:Date.now()};byName.set(nm,id)}
    if(cur.attendees.includes(id)){dup++;continue}
    cur.attendees.push(id);added++;
  }
  if(!commit()) return;
  if(dup&&!added) toast('이미 오늘 명단에 있어요');else if(added>1) toast(`${added}명 추가했어요`);
}
$('#addBtn').addEventListener('click',addNames);
$('#nameInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();addNames()}});

$('#fillRandom').addEventListener('click',()=>{
  const b=shuffle(bench());let n=0;
  for(const s of T().slots){if(!s.pid&&b.length){s.pid=b.shift();n++}}
  sel=null;commit();toast(n?`${n}명 랜덤 배치했어요`:(bench().length?'빈자리가 없어요':'대기 중인 선수가 없어요'));
});
$('#splitRandom').addEventListener('click',()=>{
  const att=cur.attendees.filter(id=>roster[id]);
  if(!att.length){toast('먼저 참가자를 추가하세요');return}
  const doIt=()=>{
    const ks=keys();
    for(const k of ks){for(const s of cur.teams[k].slots)s.pid=null;cur.teams[k].subs=[]}
    const order=sl=>[...sl.slice(1),sl[0]];
    const qs=ks.map(k=>order(cur.teams[k].slots));let turn=0;
    for(const p of shuffle(att)){let tries=0;while(tries<qs.length&&!qs[turn%qs.length].length){turn++;tries++}
      const q=qs[turn%qs.length];
      if(!q.length){subsOf(cur.teams[ks[turn%ks.length]]).push(p);turn++;continue}
      q.shift().pid=p;turn++}
    sel=null;commit();toast(ks.length>1?`${ks.length}팀으로 랜덤 배정했어요`:'랜덤으로 채웠어요');
  };
  if(keys().some(k=>cur.teams[k].slots.some(sl=>sl.pid)||subsOf(cur.teams[k]).length)) confirmBox('랜덤 나누기','지금 배치된 선수를 모두 빼고 새로 나눌까요?','나누기',doIt); else doIt();
});
$('#clearTeam').addEventListener('click',()=>{for(const s of T().slots)s.pid=null;T().subs=[];sel=null;commit()});
$('#copyText').addEventListener('click',()=>{
  const text=lineupText();
  const fallback=()=>{openModal('명단 텍스트','<p>아래 내용을 길게 눌러 복사하세요.</p><textarea id="cpTa" readonly>'+esc(text)+'</textarea>',[{label:'닫기',primary:true}]);setTimeout(()=>{const t=$('#cpTa');t&&t.select()},50)};
  try{navigator.clipboard.writeText(text).then(()=>toast('단톡방에 붙여넣을 명단을 복사했어요'),fallback)}catch(e){fallback()}
});
$('#resetAll').addEventListener('click',()=>confirmBox('라인업 새로 짜기','오늘 참가자와 배치를 비울까요?','새로 짜기',()=>{
  for(const team of Object.values(cur.teams)){
    for(const slot of team.slots) slot.pid=null;
    team.subs=[];
  }
  cur.attendees=[];
  cur.referee='';
  delete cur.pastHidden;
  sel=null;
  commit();
}));
function lineupText(){
  const out=[];if(cur.title&&cur.title.trim()) out.push(cur.title.trim(),'');
  for(const k of keys()){
    const tm=cur.teams[k];out.push(`[${tm.name}] ${cur.size}인 ${fname(tm)}`);
    for(const lb of ['GK','DF','MF','FW']){const ns=tm.slots.filter(s=>s.pid&&posOf(s).cat===lb).sort((a,b)=>a.x-b.x).map(s=>lb==='GK'?pname(s.pid):`${pname(s.pid)}(${posOf(s).code})`);if(ns.length) out.push(`${lb}: ${ns.join(', ')}`)}
    if(subsOf(tm).length) out.push(`SUB: ${subsOf(tm).map(pname).join(', ')}`);
    const empty=tm.slots.filter(s=>!s.pid).length;if(empty) out.push(`(빈자리 ${empty})`);out.push('');
  }
  if(cur.referee) out.push(`심판: ${cur.referee}`);
  const b=bench();if(b.length) out.push(`대기: ${b.map(pname).join(', ')}`);
  return out.join('\n').trim();
}

/* start match */
$('#startMatch').addEventListener('click',()=>{
  const pick=k=>{const t=cur.teams[k];return {name:t.name,color:t.color,formation:t.formation,players:[...t.slots.filter(s=>s.pid).map(s=>s.pid),...subsOf(t)],
    pos:Object.fromEntries([...t.slots.filter(s=>s.pid).map(s=>[s.pid,posOf(s).cat]),...subsOf(t).map(p=>[p,'SUB'])])}};
  const go=(ka,kb)=>{
    const A=pick(ka),B=pick(kb);
    if(!A.players.length&&!B.players.length){toast('먼저 두 팀에 선수를 배치하세요');return false}
    const id=uid();
    matches[id]={date:today(),title:cur.title||'',size:cur.size,createdAt:Date.now(),finished:false,teams:{A,B},referee:cur.referee||'',goals:[]};
    putMatch(id);view='matches';openMatch=id;sel=null;renderAll();window.scrollTo(0,0);
    toast(`${A.name} vs ${B.name} 경기 기록을 시작했어요`);
  };
  if(cur.teamCount<2) return;
  if(cur.teamCount===2){go('A','B');return}
  let chosen=[];
  const body=()=>`<p>이번 경기에 붙을 두 팀을 고르세요.</p><div class="picks">${keys().map(k=>{const t=cur.teams[k];const n=t.slots.filter(s=>s.pid).length;
    return `<button class="pick ${chosen.includes(k)?'on':''}" data-pk="${k}"><span class="dot" style="background:${t.color};margin-right:6px;vertical-align:-1px"></span>${esc(t.name)}<span class="opt-cnt">${n}명</span></button>`}).join('')}</div>
    <p class="sub" style="margin-top:-6px">${chosen.length===2?`${esc(cur.teams[chosen[0]].name)} vs ${esc(cur.teams[chosen[1]].name)}`:'두 팀을 눌러 주세요'}</p>`;
  openModal('경기 시작',body(),[{label:'취소'},{label:'경기 시작',primary:true,fn:()=>{if(chosen.length!==2){toast('두 팀을 골라 주세요');return false}return go(chosen[0],chosen[1])}}]);
  modalClick=e=>{const b=e.target.closest('[data-pk]');if(!b)return;const k=b.dataset.pk;
    if(chosen.includes(k))chosen=chosen.filter(x=>x!==k);else{chosen.push(k);if(chosen.length>2)chosen.shift()}
    $('#mBody').innerHTML=body()};
});
$('#delTeam').addEventListener('click',()=>{
  if(cur.teamCount<2) return;
  const k0=cur.active,t=cur.teams[k0];const n=t.slots.filter(s=>s.pid).length;
  confirmBox('팀 삭제',`${t.name}을(를) 삭제할까요?${n?` 배치된 ${n}명은 대기 명단으로 돌아가요.`:''}`,'삭제',()=>{
    const ks=keys();const i=ks.indexOf(k0);
    for(let j=i;j<ks.length-1;j++)cur.teams[ks[j]]=cur.teams[ks[j+1]];
    delete cur.teams[ks[ks.length-1]];
    cur.teamCount--;cur.active=ks[Math.min(i,cur.teamCount-1)];ensureTeams();sel=null;commit();toast(`${t.name}을(를) 삭제했어요`);
  },true);
});
$('#addTeam').addEventListener('click',()=>{
  if(cur.teamCount>=MAXT) return;
  const k=TK[cur.teamCount];const name=k+'팀';
  cur.teams[k]=newTeam(name,COLORS[cur.teamCount],cur.size);cur.teamCount++;cur.active=k;sel=null;commit();
  toast(`${name}을(를) 추가했어요`);
});
$('#otherBox').addEventListener('click',e=>{const b=e.target.closest('[data-goteam]');if(!b)return;cur.active=b.dataset.goteam;sel=null;commit();
  const t=$('#tabs');if(t&&t.getBoundingClientRect().top<0)t.scrollIntoView({behavior:'smooth',block:'start'})});
