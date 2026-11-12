/* 스쿼드 메이커 · app.js
 * 앱 설치 안내, 백업 저장/불러오기, 시작(boot) — 반드시 마지막에 불러오기
 */
/* ================= 앱 설치 · 백업 ================= */
let deferredPrompt=null;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;if(!standalone())$('#installBtn').classList.remove('hidden')});
window.addEventListener('appinstalled',()=>{$('#installBtn').classList.add('hidden');toast('앱을 설치했어요')});
if(isIOS&&!standalone())$('#installBtn').classList.remove('hidden');
$('#installBtn').addEventListener('click',async()=>{
  if(deferredPrompt){deferredPrompt.prompt();try{await deferredPrompt.userChoice}catch(e){}deferredPrompt=null;$('#installBtn').classList.add('hidden');return}
  openModal('홈 화면에 앱 추가',isIOS?'<p>1. 사파리 아래쪽 <b>공유 버튼</b>(네모에 위 화살표)을 누르세요.<br>2. <b>홈 화면에 추가</b>를 누르세요.<br>3. 홈 화면의 스쿼드 메이커 아이콘으로 열면 앱처럼 써요.</p><p>카톡 안에서 열었다면 오른쪽 아래 메뉴에서 <b>Safari로 열기</b>를 먼저 눌러 주세요.</p>'
    :'<p>브라우저 메뉴(⋮)에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 누르세요.</p><p>카톡 안에서 열었다면 오른쪽 위 메뉴에서 <b>다른 브라우저로 열기</b>를 먼저 눌러 주세요.</p>',[{label:'확인',primary:true}]);
});
$('#backupOut').addEventListener('click',async()=>{
  const data=JSON.stringify({app:'squadmaker',v:2,savedAt:new Date().toISOString(),roster,matches,cur},null,1);
  const blob=new Blob([data],{type:'application/json'});const name=`스쿼드메이커_백업_${today()}.json`;
  if(!(await shareFile(blob,name,'스쿼드 메이커 백업')))saveBlobFile(blob,name);
});
$('#backupIn').addEventListener('click',()=>$('#backupFile').click());
$('#backupFile').addEventListener('change',e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  f.text().then(t=>{let d;try{d=JSON.parse(t)}catch(err){toast('백업 파일을 읽을 수 없어요');return}
    if(!d||d.app!=='squadmaker'||!d.roster||!d.matches){toast('스쿼드 메이커 백업 파일이 아니에요');return}
    const n=Object.keys(d.matches).length,pn=Object.keys(d.roster).length;
    confirmBox('백업 불러오기',`선수 ${pn}명, 경기 ${n}개가 들어 있어요. 지금 이 폰의 기록을 백업 내용으로 바꿀까요?`,'불러오기',()=>{
      roster=d.roster;matches=d.matches;cur=normalizeCur(d.cur||freshCurrent());sel=null;openMatch=null;saveLocal();renderAll();toast('백업을 불러왔어요')},true);
  });
});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* ================= boot ================= */
function normalizeCur(c){
  if(!c||!c.teams||!c.teams.A||!c.teams.B) return freshCurrent();
  c=clone(c);if(!FORMATIONS[c.size])c.size=11;if(!Array.isArray(c.attendees))c.attendees=[];c.teamCount=Number.isInteger(c.teamCount)&&c.teamCount>=1&&c.teamCount<=MAXT?c.teamCount:2;const save=cur;cur=c;ensureTeams();cur=save;
  return c;
}
function finishLoad(){
  if(loaded) return;loaded=true;
  $('#loading').classList.add('hidden');showBanner();renderAll();
  if(!cur.started) openSetup(true);
}
function boot(){
  loadLocal();cur=normalizeCur(cur);finishLoad();
}
function isTyping(){const a=document.activeElement;return a&&(a.id==='mdTitle'||a.id==='mdRef'||a.id==='rnIn'||a.id==='refIn')}
boot();
initSample();
$('#mBody').addEventListener('keydown',e=>{if(e.target.id==='ocrFix'&&e.key==='Enter'&&!e.isComposing){e.preventDefault();const b=document.querySelector('[data-ocradd]');b&&b.click()}});
