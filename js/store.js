/* 스쿼드 메이커 · store.js
 * 데이터·저장: 상태, 이 기기 저장(localStorage), 저장 대기열, 계산용 함수
 */
/* ================= data ================= */
const DATA_VERSION=4;
const TIERS=['S','A','B','C','F'];
let groups={};
let defaultGroupId=null, activeGroupId=null;
let roster={};    // 활성 모임의 선수
let matches={};   // 활성 모임의 경기
let cur=freshCurrent();
let readOnly=false, loaded=false;
let view='groups', openMatch=null, statSort='g', openStat=null;
let sel=null;
let lastStored=null;

function activeGroup(){return activeGroupId===null?null:groups[activeGroupId]}
function appData(){return {v:DATA_VERSION,defaultGroupId,groups}}
function writeLocal(data){
  try{
    if(localStorage.getItem(LKEY)!==lastStored){
      toast('다른 탭에서 기록이 바뀌었어요. 새로고침한 뒤 다시 시도하세요.');
      return false;
    }
    const serialized=JSON.stringify(data);
    localStorage.setItem(LKEY,serialized);
    lastStored=serialized;
    return true;
  }catch(e){
    toast('브라우저에 기록을 저장하지 못했어요');
    return false;
  }
}
function saveLocal(){
  const group=activeGroup();
  if(group) group.cur=cur;
  return writeLocal(appData());
}
function loadLocal(){
  try{
    lastStored=localStorage.getItem(LKEY);
    return readAppData(JSON.parse(lastStored));
  }catch(e){return null}
}
function putCurrent(){return saveLocal()}
function putPlayer(){return saveLocal()}
function putMatch(){return saveLocal()}
function delMatchDoc(){return saveLocal()}
function commit(){const saved=putCurrent();renderAll();return saved}

function isRecord(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function recordEntries(records){
  return Object.entries(isRecord(records)?records:{}).filter(([id,value])=>/^[a-z0-9][a-z0-9_-]*$/i.test(id)&&isRecord(value));
}
function normalizeCur(saved, players){
  const lineup=isRecord(saved?.teams?.A)?clone(saved):freshCurrent();
  if(!Number.isInteger(lineup.size)||lineup.size<MIN||lineup.size>MAX) lineup.size=11;
  if(!Number.isInteger(lineup.teamCount)||lineup.teamCount<1||lineup.teamCount>MAXT) lineup.teamCount=2;
  lineup.teams=Object.fromEntries(TK.slice(0,lineup.teamCount).filter(key=>isRecord(lineup.teams[key])).map(key=>[key,lineup.teams[key]]));
  ensureTeams(lineup);

  const assigned=new Set();
  const keepPlayer=id=>{
    if(typeof id!=='string'||!Object.hasOwn(players,id)||assigned.has(id)) return false;
    assigned.add(id);
    return true;
  };
  for(const team of Object.values(lineup.teams)){
    for(const slot of team.slots) if(!keepPlayer(slot.pid)) slot.pid=null;
    team.subs=team.subs.filter(keepPlayer);
  }
  const attendees=Array.isArray(lineup.attendees)?lineup.attendees:[];
  lineup.attendees=[...new Set([...attendees.filter(id=>typeof id==='string'&&Object.hasOwn(players,id)),...assigned])];
  return lineup;
}
function makeGroup(name, data={}){
  const players=Object.fromEntries(recordEntries(data.roster).filter(([,player])=>typeof player.name==='string'));
  const games=Object.fromEntries(recordEntries(data.matches).filter(([,game])=>isRecord(game.teams?.A)&&isRecord(game.teams?.B)));
  const lineup=normalizeCur(data.cur,players);
  lineup.title=name;
  const squads=Array.isArray(data.squads)?data.squads.filter(squad=>isRecord(squad)&&typeof squad.id==='string'&&typeof squad.name==='string'&&isRecord(squad.lineup)):[];
  return {name,roster:players,matches:games,cur:lineup,squads};
}
function readAppData(data){
  if(!isRecord(data)) return null;
  let records;
  if(data.v===DATA_VERSION&&isRecord(data.groups)){
    records=recordEntries(data.groups).map(([id,group])=>[id,makeGroup(String(group.name||'기존 모임'),group)]);
  }else if(isRecord(data.roster)&&isRecord(data.matches)){
    if(data.cur?.v===3&&isRecord(data.cur.groups)){
      const byGroup=(entries,id)=>Object.fromEntries(recordEntries(entries).filter(([,record])=>(record.groupId||'legacy')===id));
      records=recordEntries(data.cur.groups).map(([id,lineup])=>[
        id,makeGroup(String(lineup.title||'기존 모임'),{roster:byGroup(data.roster,id),matches:byGroup(data.matches,id),cur:lineup})
      ]);
    }else if(data.cur?.started||Object.keys(data.roster).length||Object.keys(data.matches).length){
      records=[['legacy',makeGroup(String(data.cur?.title||'').trim()||'기존 모임',data)]];
    }else records=[];
  }else return null;

  const restoredGroups=Object.fromEntries(records);
  const defaultId=Object.hasOwn(restoredGroups,data.defaultGroupId)?data.defaultGroupId:records[0]?.[0]??null;
  return {v:DATA_VERSION,defaultGroupId:defaultId,groups:restoredGroups};
}
function useAppData(data){
  if(!data) return;
  groups=data.groups;
  defaultGroupId=data.defaultGroupId;
  activateGroup(defaultGroupId);
}

/* ================= derived ================= */
const T=()=>cur.teams[cur.active];
const keys=(lineup=cur)=>TK.slice(0,lineup.teamCount||2);
function ensureTeams(lineup=cur){
  const teamKeys=keys(lineup);
  teamKeys.forEach((key,i)=>{
    const formation=FORMATIONS[lineup.size][0];
    const team=lineup.teams[key]||(lineup.teams[key]=newTeam(key+'팀',COLORS[i],lineup.size));
    team.color=COLORS[i];
    if(typeof team.name!=='string'||/^[A-H]팀$/.test(team.name)) team.name=key+'팀';
    if(!Array.isArray(team.subs)) team.subs=[];
    if(!Array.isArray(team.slots)) team.slots=[];
    team.slots=team.slots.filter(slot=>Number.isFinite(slot?.x)&&Number.isFinite(slot?.y));
    if(team.slots.length!==lineup.size) remap(team,formation);
  });
  if(!teamKeys.includes(lineup.active)) lineup.active='A';
}
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
