/* 스쿼드 메이커 · utils.js
 * 상수·도우미: 포메이션, 포지션 판정, 날짜·글자 도우미
 */
/* ================= constants & helpers ================= */
const MIN=3,MAX=11;
const FORMATIONS={
  3:['1-1','2'], 4:['2-1','1-2','1-1-1'], 5:['2-2','1-2-1','3-1','2-1-1'],
  6:['2-2-1','3-1-1','2-1-2','1-2-2'], 7:['3-2-1','2-3-1','3-1-2','2-1-2-1'],
  8:['3-3-1','3-2-2','2-3-2','3-1-3'], 9:['3-3-2','4-3-1','3-4-1','3-2-3'],
  10:['4-3-2','3-4-2','4-4-1','3-3-3'], 11:['4-4-2','4-3-3','4-2-3-1','4-1-4-1','3-5-2','3-4-3','5-3-2']
};
const COLORS=['#e5484d','#3e63dd','#f5a524','#1f9d55','#8e4ec6','#1c1e1b','#12a594','#d6409f'];
const LKEY='squadmaker.v2';
const BALL='<svg class="ball" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5l3.8 2.7-1.4 4.4H9.6l-1.4-4.4z" fill="currentColor"/></svg>';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=o=>JSON.parse(JSON.stringify(o));
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function textOn(hex){const n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return (r*299+g*587+b*114)/1000>160?'#1c1e1b':'#fff'}
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtDate(ymd){if(!ymd)return '';const d=new Date(ymd+'T00:00:00');if(isNaN(d))return ymd;return `${d.getMonth()+1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`}

const POSCOL={GK:'#ffc531',DF:'#3d8bff',MF:'#2ecc71',FW:'#ff4d4f'};
function posOf(s){
  const x=s.x,y=s.y;const side=(l,c,r,lt=42,rt=58)=>x<lt?l:x>rt?r:c;
  if(y>=84) return {code:'GK',cat:'GK'};
  if(y>=77&&x>=36&&x<=64) return {code:'SW',cat:'DF'};
  if(y>=62){if(x<22)return {code:'LB',cat:'DF'};if(x>78)return {code:'RB',cat:'DF'};return {code:side('LCB','CB','RCB'),cat:'DF'}}
  if(y>=52){if(x<22)return {code:'LWB',cat:'DF'};if(x>78)return {code:'RWB',cat:'DF'};return {code:side('LDM','CDM','RDM'),cat:'MF'}}
  if(y>=36){if(x<22)return {code:'LM',cat:'MF'};if(x>78)return {code:'RM',cat:'MF'};return {code:side('LCM','CM','RCM'),cat:'MF'}}
  if(y>=27){if(x<22)return {code:'LM',cat:'MF'};if(x>78)return {code:'RM',cat:'MF'};return {code:side('LAM','CAM','RAM'),cat:'MF'}}
  if(y>=18){if(x<30)return {code:'LW',cat:'FW'};if(x>70)return {code:'RW',cat:'FW'};return {code:side('LF','CF','RF'),cat:'FW'}}
  if(x<30)return {code:'LW',cat:'FW'};if(x>70)return {code:'RW',cat:'FW'};return {code:side('LS','ST','RS',44,56),cat:'FW'};
}
function buildSlots(f){
  const lines=f.split('-').map(Number),L=lines.length;
  const slots=[{x:50,y:90,label:'GK',pid:null}];
  const bottom=72, top=L===1?45:14;
  lines.forEach((n,li)=>{
    const y=L===1?top:bottom-li*(bottom-top)/(L-1);
    const label=li===0?'DF':(li===L-1?'FW':'MF');
    for(let i=0;i<n;i++) slots.push({x:(i+1)/(n+1)*100,y,label,pid:null});
  });
  return slots;
}
function newTeam(name,color,size){const f=FORMATIONS[size][0];return {name,color,formation:f,slots:buildSlots(f)}}
const TK=['A','B','C','D','E','F','G','H'];const MAXT=8;
function freshCurrent(){return {v:2,started:false,size:11,title:'',active:'A',teamCount:2,attendees:[],referee:'',teams:{A:newTeam('A팀',COLORS[0],11),B:newTeam('B팀',COLORS[1],11)}}}
