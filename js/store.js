/* 스쿼드 메이커 · store.js
 * 데이터·저장: 상태, 이 기기 저장(localStorage), 저장 대기열, 계산용 함수
 */
/* ================= data ================= */
let roster={};    // pid -> {name, createdAt}
let matches={};   // id -> match
let cur=freshCurrent();
let mode='local', readOnly=false, loaded=false;
let view='lineup', openMatch=null, statSort='g', openStat=null;
let sel=null;

/* ---- 저장 ----
 * 지금은 이 기기(localStorage)에만 저장해요.
 * 나중에 Firebase 같은 서버를 붙일 때는 아래 putCurrent·putPlayer·putMatch 같은 저장 함수 안만 바꾸면 돼요.
 */
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify({roster,matches,cur}))}catch(e){toast('저장 공간이 부족해서 저장하지 못했어요')}}
function loadLocal(){try{const s=JSON.parse(localStorage.getItem(LKEY));if(s){roster=s.roster||{};matches=s.matches||{};if(s.cur&&s.cur.teams)cur=s.cur}}catch(e){}}
function putCurrent(){saveLocal()}
function putPlayer(pid){saveLocal()}
function delPlayerDoc(pid){saveLocal()}
function putMatch(id,delay){saveLocal()}
function delMatchDoc(id){saveLocal()}
function commit(){putCurrent();renderAll()}

/* ================= derived ================= */
const T=()=>cur.teams[cur.active];
const keys=()=>TK.slice(0,cur.teamCount||2);
function ensureTeams(){keys().forEach((k,i)=>{if(!cur.teams[k])cur.teams[k]=newTeam(k+'팀',COLORS[i],cur.size);const t=cur.teams[k];t.color=COLORS[i];if(/^[A-H]팀$/.test(t.name))t.name=k+'팀'});for(const k of keys()){if(!Array.isArray(cur.teams[k].subs))cur.teams[k].subs=[];if(cur.teams[k].slots.length!==cur.size)remap(cur.teams[k],FORMATIONS[cur.size][0])}if(!keys().includes(cur.active))cur.active='A'}
const pname=id=>roster[id]?roster[id].name:'(삭제됨)';
const subsOf=t=>Array.isArray(t.subs)?t.subs:(t.subs=[]);
function assignedIds(){const s=new Set();for(const k of keys()){for(const sl of cur.teams[k].slots)if(sl.pid)s.add(sl.pid);for(const p of subsOf(cur.teams[k]))s.add(p)}return s}
function whereIs(pid){for(const k of keys()){const s=cur.teams[k].slots.find(s=>s.pid===pid);if(s)return {k,code:posOf(s).code};if(subsOf(cur.teams[k]).includes(pid))return {k,code:'SUB'}}return null}
function pastList(){
  const last=sortedMatches()[0];if(!last) return {ids:[],m:null};
  const [mid,m]=last;
  const hid=cur.pastHidden&&cur.pastHidden.mid===mid?new Set(cur.pastHidden.ids):new Set();
  const att=new Set(cur.attendees);
  const ids=[...(m.teams.A.players||[]),...(m.teams.B.players||[])].filter((id,i,a)=>a.indexOf(id)===i&&roster[id]&&!att.has(id)&&!hid.has(id));
  return {ids,m,mid};
}
function bench(){const a=assignedIds();return cur.attendees.filter(id=>roster[id]&&!a.has(id))}
function score(m,k){return (m.goals||[]).filter(g=>g.team===k).length}
function sortedMatches(){return Object.entries(matches).sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||'')||(b[1].createdAt||0)-(a[1].createdAt||0))}
let STATS={};
function computeStats(){
  const st={};const E=pid=>st[pid]||(st[pid]={apps:0,w:0,d:0,l:0,g:0,a:0,pc:{},hist:[]});
  for(const [id,m] of sortedMatches()){
    const sa=score(m,'A'),sb=score(m,'B');
    const gm={},am={};
    for(const g of m.goals||[]){if(g.scorer&&!g.og)gm[g.scorer]=(gm[g.scorer]||0)+1;if(g.assist)am[g.assist]=(am[g.assist]||0)+1}
    for(const k of ['A','B']){
      const tm=m.teams&&m.teams[k];if(!tm) continue;
      const my=k==='A'?sa:sb,op=k==='A'?sb:sa,res=my>op?'W':my<op?'L':'D';
      for(const pid of tm.players||[]){
        const s=E(pid);s.apps++;s[res.toLowerCase()]++;
        const pc=tm.pos&&tm.pos[pid];if(pc&&pc!=='SUB')s.pc[pc]=(s.pc[pc]||0)+1;
        s.hist.push({id,date:m.date,title:m.title,team:tm.name,res,my,op,g:gm[pid]||0,a:am[pid]||0,pos:pc||null});
      }
    }
    for(const pid in gm)E(pid).g+=gm[pid];
    for(const pid in am)E(pid).a+=am[pid];
  }
  STATS=st;
}
const goalsOf=pid=>STATS[pid]?STATS[pid].g:0;
