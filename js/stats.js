/* 스쿼드 메이커 · stats.js
 * 선수 기록: 누적 통계, 추천 포지션, 여러 명 삭제, 이름 바꾸기
 */
/* ---------- stats ---------- */
const PLBL={GK:'골키퍼',DF:'수비',MF:'미드필더',FW:'공격'};
function recPos(s){const e=Object.entries(s.pc||{});if(!e.length)return null;
  const order=['FW','MF','DF','GK'];e.sort((a,b)=>b[1]-a[1]||order.indexOf(a[0])-order.indexOf(b[0]));return e[0][0]}
let selMode=false,selSet=new Set();
function renderStats(){
  const ids=Object.keys(roster);
  const nm=Object.keys(matches).length;
  const tg=Object.values(matches).reduce((a,m)=>a+(m.goals||[]).length,0);
  if(!ids.length){selMode=false;$('#sBody').innerHTML='<div class="card big-empty"><b style="color:var(--ink)">아직 선수가 없어요</b><br>라인업 탭에서 참가자를 추가하고 경기를 기록하면 여기에 쌓여요.</div>';return}
  for(const id of [...selSet])if(!roster[id])selSet.delete(id);
  const S=id=>STATS[id]||{apps:0,w:0,d:0,l:0,g:0,a:0,pc:{},hist:[]};
  const key={g:s=>[s.g,s.a,-s.apps],a:s=>[s.a,s.g,-s.apps],apps:s=>[s.apps,s.g,s.a],rate:s=>[s.apps?s.w/s.apps:-1,s.apps,s.g]}[statSort];
  ids.sort((x,y)=>{const sx=S(x),sy=S(y);const px=sx.apps>0,py=sy.apps>0;if(px!==py)return py-px;
    const a=key(sx),b=key(sy);for(let i=0;i<a.length;i++)if(a[i]!==b[i])return b[i]-a[i];return pname(x).localeCompare(pname(y),'ko')});
  const hlcol={g:5,a:6,apps:3,rate:4}[statSort];
  let rank=0,prev=null;
  const rows=ids.map((id,i)=>{const s=S(id);const k=JSON.stringify(key(s));if(k!==prev){rank=i+1;prev=k}
    const rp=recPos(s);
    const cells=[s.apps||'-',s.apps?`${s.w}-${s.d}-${s.l}`:'-',s.g||'-',s.a||'-'];
    const first=selMode?`<td class="rk"><input type="checkbox" class="ck" ${selSet.has(id)?'checked':''} tabindex="-1"></td>`:`<td class="rk">${s.apps?rank:''}</td>`;
    const tier=TIERS.includes(roster[id].tier)?roster[id].tier:'';
    let html=`<tr class="row ${!selMode&&openStat===id?'open':''} ${selMode&&selSet.has(id)?'picked':''}" data-st="${id}">${first}<td class="pn">${esc(pname(id))} ${tierBadge(id)}</td>
      <td>${rp?`<span class="rp" style="--pc:${POSCOL[rp]}">${PLBL[rp]}</span>`:'<span class="dim">-</span>'}</td>`+
      cells.map((c,ci)=>`<td class="${ci+3===hlcol&&c!=='-'?'hl':''} ${c==='-'?'dim':''}">${c}</td>`).join('')+'</tr>';
    if(!selMode&&openStat===id){
      const rate=s.apps?Math.round(s.w/s.apps*100):0;
      const pcs=['FW','MF','DF','GK'].filter(c=>s.pc&&s.pc[c]).map(c=>`<span class="rp sm" style="--pc:${POSCOL[c]}">${PLBL[c]} ${s.pc[c]}</span>`).join('');
      html+=`<tr class="exp"><td colspan="7">${pcs?`<div class="pc-row"><span class="muted">뛴 포지션</span>${pcs}</div>`:''}<div class="hist">${s.hist.length?s.hist.map(h=>`<div><span class="res ${h.res}">${{W:'승',D:'무',L:'패'}[h.res]}</span>
        <span>${fmtDate(h.date)}</span><span class="muted">${esc(h.team)} ${h.my}:${h.op}</span>${h.pos?`<span class="rp sm" style="--pc:${h.pos==='SUB'?'#9a968a':POSCOL[h.pos]}">${h.pos==='SUB'?'후보':PLBL[h.pos]}</span>`:''}${h.g?`<b>${h.g}골</b>`:''}${h.a?`<span>${h.a}도움</span>`:''}</div>`).join(''):'<div class="muted">아직 출전 기록이 없어요.</div>'}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="muted" style="font-size:12px;color:var(--muted)">${s.apps?`승률 ${rate}% · 경기당 ${(s.g/s.apps).toFixed(2)}골`:''}</span>
        <span style="flex:1"></span><label class="tier-field">티어 <select data-tier-for="${id}" aria-label="${esc(pname(id))} 티어"><option value="">미지정</option>${TIERS.map(value=>`<option value="${value}" ${tier===value?'selected':''}>${value}</option>`).join('')}</select></label>
        <button class="btn outline" style="font-size:12px;padding:5px 10px" data-rename="${id}">이름 바꾸기</button><button class="btn outline" style="font-size:12px;padding:5px 10px;color:var(--danger)" data-delp="${id}">선수 삭제</button></div></td></tr>`;
    }
    return html}).join('');
  const bar=selMode?`<div class="sel-bar"><b>${selSet.size}명 선택</b><button class="mini-btn" data-sact="all">${selSet.size===ids.length?'전체 해제':'전체 선택'}</button><span style="flex:1"></span>
      <button class="mini-btn" data-sact="cancel">취소</button><button class="btn danger" style="font-size:13px;padding:6px 12px" data-sact="del" ${selSet.size?'':'disabled'}>${selSet.size||''}명 삭제</button></div>`:'';
  $('#sBody').innerHTML=`
    <div class="stat-sum"><div><b>${nm}</b><span>경기</span></div><div><b>${tg}</b><span>골</span></div><div><b>${ids.length}</b><span>선수</span></div></div>
    <div class="stat-tools"><div class="segs">${[['g','득점'],['a','도움'],['apps','출전'],['rate','승률']].map(([k,l])=>`<button class="seg ${statSort===k?'on':''}" data-sort="${k}">${l}</button>`).join('')}</div>
      ${selMode?'':'<button class="mini-btn" data-sact="start">여러 명 삭제</button>'}</div>
    ${bar}
    <div class="tbl-wrap"><table class="stbl"><thead><tr><th>${selMode?'':'#'}</th><th>이름</th><th>추천 포지션</th><th>경기</th><th>승-무-패</th><th>골</th><th>도움</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="sub">${selMode?'지울 선수를 눌러 고르세요. 지난 경기 기록에는 "(삭제됨)"으로 남아요.':'이름을 누르면 경기별 기록이 보여요. 추천 포지션은 경기 기록 시작 때 뛴 포지션을 모아 정해요.'}</p>`;
}


/* ================= events: stats ================= */
function deletePlayers(ids){
  const del=new Set(ids);
  for(const id of ids) delete roster[id];
  cur.attendees=cur.attendees.filter(x=>!del.has(x));
  for(const k of TK)if(cur.teams[k]){for(const sl of cur.teams[k].slots)if(del.has(sl.pid))sl.pid=null;cur.teams[k].subs=subsOf(cur.teams[k]).filter(p=>!del.has(p))}
  if(sel&&del.has(sel.pid))sel=null;
}
$('#sBody').addEventListener('click',e=>{
  if(e.target.closest('.tier-field')) return;
  const s=e.target.closest('[data-sort]');if(s){statSort=s.dataset.sort;renderAll();return}
  const sa=e.target.closest('[data-sact]');
  if(sa){const a=sa.dataset.sact;
    if(a==='start'){selMode=true;selSet=new Set();openStat=null}
    else if(a==='cancel'){selMode=false;selSet.clear()}
    else if(a==='all'){const all=Object.keys(roster);selSet=selSet.size===all.length?new Set():new Set(all)}
    else if(a==='del'&&selSet.size){const ids=[...selSet];
      confirmBox('선수 여러 명 삭제',`${ids.slice(0,5).map(pname).join(', ')}${ids.length>5?` 외 ${ids.length-5}명`:''}을(를) 명단에서 지울까요? 지난 경기 기록에는 "(삭제됨)"으로 남아요.`,`${ids.length}명 삭제`,()=>{
        deletePlayers(ids);selMode=false;selSet.clear();commit();toast(`${ids.length}명을 삭제했어요`)},true);return}
    renderAll();return}
  if(selMode){const r=e.target.closest('[data-st]');if(r){const id=r.dataset.st;selSet.has(id)?selSet.delete(id):selSet.add(id);renderAll()}return}
  const d=e.target.closest('[data-delp]');if(d){const id=d.dataset.delp;
    confirmBox('선수 삭제',`${pname(id)} 선수를 명단에서 지울까요? 지난 경기 기록에는 "(삭제됨)"으로 남아요.`,'삭제',()=>{
      deletePlayers([id]);openStat=null;commit()},true);return}
  const rn=e.target.closest('[data-rename]');if(rn){const id=rn.dataset.rename;
    openModal('이름 바꾸기',`<input id="rnIn" class="name-in" style="width:100%;margin-bottom:8px" maxlength="20" value="${esc(pname(id))}">`,[{label:'취소'},{label:'저장',primary:true,fn:()=>{
      const v=$('#rnIn').value.trim();if(!v){toast('이름을 입력하세요');return false}
      if(Object.keys(roster).some(p=>p!==id&&roster[p].name===v)){toast('같은 이름의 선수가 이미 있어요');return false}
      roster[id].name=v;putPlayer(id);renderAll()}}]);setTimeout(()=>{const i=$('#rnIn');if(i){i.focus();i.select()}},50);return}
  const r=e.target.closest('[data-st]');if(r){openStat=openStat===r.dataset.st?null:r.dataset.st;renderAll()}
});
$('#sBody').addEventListener('change',e=>{
  const id=e.target.dataset.tierFor;
  const value=e.target.value;
  if(!id||!Object.hasOwn(roster,id)||(value&&!TIERS.includes(value))) return;
  const player=roster[id], previous=player.tier;
  if(value) player.tier=value;
  else delete player.tier;
  if(!putPlayer()){
    if(previous) player.tier=previous;
    else delete player.tier;
  }
  renderStats();
  document.querySelector(`[data-tier-for="${id}"]`)?.focus({preventScroll:true});
});
