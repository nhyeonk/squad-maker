/* 스쿼드 메이커 · ocr.js
 * 카톡 투표 캡처 → 참가자 추가 (Tesseract.js로 폰 안에서 글자 인식)
 */
/* ================= 카톡 투표 캡처 (폰 안에서 글자 인식: Tesseract.js) ================= */
const TESS_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let TW=null,ocrProg=null,ocrCancel=false;
function initSample(){ $('#shotBtn').classList.remove('hidden'); $('#shotFile').accept='image/*'; }
$('#shotBtn').addEventListener('click',()=>$('#shotFile').click());
$('#shotFile').addEventListener('change',e=>{const f=[...e.target.files];e.target.value='';if(f.length)readShots(f)});
document.addEventListener('paste',e=>{
  if(view!=='lineup') return;
  const imgs=[...(e.clipboardData?.items||[])].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
  if(imgs.length){e.preventDefault();readShots(imgs)}
});
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('load'));document.head.appendChild(s)})}
async function getWorker(){
  if(TW) return TW;
  if(!window.Tesseract) await loadScript(TESS_URL);
  TW=await Tesseract.createWorker('kor+eng',1,{logger:m=>{if(ocrProg)ocrProg(m)}});
  return TW;
}
async function prepImage(file){
  const bmp=await createImageBitmap(file);
  let sc=bmp.width<900?2:bmp.width<1500?1.5:1;if(bmp.width*sc>2400)sc=2400/bmp.width;
  const c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);
  const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(bmp,0,0,c.width,c.height);
  const im=x.getImageData(0,0,c.width,c.height),d=im.data;let sum=0;
  for(let k=0;k<d.length;k+=4){const v=0.299*d[k]+0.587*d[k+1]+0.114*d[k+2];d[k]=v;sum+=v}
  const dark=sum/(d.length/4)<110;
  for(let k=0;k<d.length;k+=4){let v=d[k];if(dark)v=255-v;v=(v-128)*1.35+128;v=v<0?0:v>255?255:v;d[k]=d[k+1]=d[k+2]=v}
  x.putImageData(im,0,0);return c;
}
/* 인식된 줄 → 투표 항목별 이름 */
const OPT_RE=/^(참석|불참|참가|불가능|불가|가능|미정|늦참|지각|조퇴|보류|모름|고민중|고민|갑니다|못가요|가요|안가요|yes|no|o|x)(?=\s|$|\d|\()/i;
const UI_RE=/투표|참여|결과|마감|익명|복수|선택|항목|공유|닫기|확인|오전|오후|채팅|현황|보기|완료|다시|종료|만든|생성|메시지|검색|알림|사진|카카오|게시판|읽음|전송|답장|더보기|설정|프로필|친구|목록|인원|명단|님이|님의|^나$|^me$/i;
function cleanLine(t){
  t=String(t||'').replace(/\(.*?\)|\[.*?\]/g,' ');
  t=t.replace(/[^\p{Script=Hangul}A-Za-z0-9\s]/gu,' ').replace(/\s+/g,' ').trim();
  if(/^(\p{Script=Hangul}\s){1,5}\p{Script=Hangul}$/u.test(t)) t=t.replace(/\s/g,'');
  return t;
}
function parseOCR(lines){
  const opts=[];let curO=null;const low=new Set();
  const getOpt=l=>{let o=opts.find(x=>x.label===l);if(!o){o={label:l,names:[]};opts.push(o)}return o};
  for(const ln of lines){
    const raw=String(ln.text||'').trim();if(!raw) continue;
    const t=cleanLine(raw);if(!t) continue;
    const om=t.match(OPT_RE);
    const cnt=/(\d+)\s*명\s*$/.test(t);
    if(om&&(t.length<=om[0].length+6)){curO=getOpt(om[1]);continue}
    if(cnt&&t.replace(/\d+\s*명?\s*$/,'').trim().length<=12&&!UI_RE.test(t)){curO=getOpt(t.replace(/\d+\s*명?\s*$/,'').trim()||'항목');continue}
    if(/\d{1,2}\s*:\s*\d{2}/.test(raw)||/\d{4}\s*[.\-년]/.test(raw)) continue;
    if(UI_RE.test(t)) continue;
    let name=t.replace(/\s+\d+$/,'').trim();
    if(name.length<2||name.length>12) continue;
    if(/^\d+$/.test(name.replace(/\s/g,''))) continue;
    if(!/[\p{Script=Hangul}A-Za-z]/u.test(name)) continue;
    if(name.split(' ').length>3) continue;
    if(/^[A-Za-z]{1,2}$/.test(name)) continue;
    const o=curO||getOpt('명단');
    if(!o.names.includes(name)){o.names.push(name);if((ln.confidence||100)<55)low.add(name)}
  }
  return {opts:opts.filter(o=>o.names.length||opts.length===1),low};
}
async function readShots(files){
  files=files.slice(0,6);ocrCancel=false;
  const setMsg=(h)=>{const el=$('#ocrMsg');if(el)el.innerHTML=h};
  openModal('캡처 읽는 중',`<div class="spin"></div><p style="text-align:center" id="ocrMsg">글자 인식 준비 중…</p><p class="sub" style="text-align:center">처음 한 번은 한국어 인식 데이터를 받느라 조금 더 걸려요.</p>`,
    [{label:'취소',fn:()=>{ocrCancel=true;if(TW){TW.terminate().catch(()=>{});TW=null}}}]);
  const all=[];
  try{
    ocrProg=m=>{const p=Math.round((m.progress||0)*100);
      if(/core/.test(m.status))setMsg(`인식 엔진 불러오는 중… ${p}%`);
      else if(/traineddata/.test(m.status))setMsg(`한국어 데이터 받는 중… ${p}%`);
      else if(/recogniz/.test(m.status))setMsg(`글자 읽는 중 (${all.length+1}/${files.length})… ${p}%`)};
    const w=await getWorker();
    for(const f of files){
      if(ocrCancel) return;
      const img=await prepImage(f);
      const {data}=await w.recognize(img);
      all.push(...(data.lines||[]).map(l=>({text:l.text,confidence:l.confidence})));
    }
  }catch(e){
    if(ocrCancel) return;
    closeModal();TW=null;
    toast(navigator.onLine===false?'처음 한 번은 인터넷이 연결돼 있어야 해요':'캡처를 읽지 못했어요. 다시 시도해 주세요');return;
  }finally{ocrProg=null}
  if(ocrCancel) return;
  const {opts,low}=parseOCR(all);
  if(!opts.some(o=>o.names.length)){
    closeModal();
    openModal('이름을 찾지 못했어요','<p>투표 결과에서 <b>투표한 사람 목록</b>(투표 현황)을 연 상태로 캡처해 주세요. 득표수만 보이는 화면에서는 이름을 알 수 없어요. 글씨가 작으면 화면을 키워서 캡처하면 더 잘 읽혀요.</p>',[{label:'확인',primary:true}]);
    return;
  }
  showShotResult(opts,'',low);
}
function showShotResult(opts,title,low=new Set()){
  const yes=/참석|참가|가능|ㅇㅇ|갑니다|가요|콜|yes|o\b/i;
  let oi=Math.max(0,opts.findIndex(o=>o.names.length&&yes.test(o.label)));
  if(!opts[oi].names.length) oi=opts.findIndex(o=>o.names.length);
  const byName={};for(const id in roster)byName[roster[id].name]=id;
  const att=new Set(cur.attendees);
  let picked=new Set();
  const reset=()=>{picked=new Set(opts[oi].names.filter(n=>!(byName[n]&&att.has(byName[n]))&&!low.has(n)))};
  reset();
  const body=()=>`${title?`<p style="margin-bottom:10px"><b style="color:var(--ink)">${esc(title)}</b></p>`:''}
    <div class="pick-label">투표 항목</div>
    <div class="picks">${opts.map((o,i)=>`<button class="pick ${i===oi?'on':''}" data-oi="${i}">${esc(o.label)}<span class="opt-cnt">${o.names.length}</span></button>`).join('')}</div>
    <div class="pick-label">추가할 사람 (눌러서 빼거나 넣기)</div>
    <div class="picks">${opts[oi].names.length?opts[oi].names.map(n=>{const id=byName[n];const inToday=id&&att.has(id);
      return `<button class="pick ${picked.has(n)?'on':''} ${id&&!inToday?'exist':''}" data-nm="${esc(n)}" ${inToday?'disabled title="이미 오늘 명단에 있어요"':''}>${low.has(n)?'❓':''}${esc(n)}</button>`}).join(''):'<span class="empty">이 항목은 이름이 보이지 않아요.</span>'}</div>
    <div class="add-row" style="margin:-4px 0 8px"><input id="ocrFix" class="name-in" placeholder="빠지거나 틀린 이름 직접 입력" maxlength="20" style="font-weight:500"><button class="btn" data-ocradd="1">넣기</button></div>
    <p class="sub" style="margin:0 0 8px">글자 인식이라 틀릴 수 있어요. 틀린 이름은 눌러서 빼고 위 칸에 바르게 적어 넣으세요. ❓는 흐릿하게 읽혀서 기본으로 빠져 있어요. "기존"은 지난 기록이 있는 선수예요.</p>`;
  closeModal();
  openModal('투표 명단',body(),[{label:'취소'},{label:'추가',primary:true,fn:()=>{
    const list=opts[oi].names.filter(n=>picked.has(n));
    if(!list.length){toast('추가할 사람을 골라 주세요');return false}
    addNameList(list);toast(`${list.length}명을 오늘 참가자로 추가했어요`);
  }}]);
  const upd=()=>{$('#mBody').innerHTML=body();const b=$('#mActions .primary');if(b)b.textContent=picked.size?`${picked.size}명 추가`:'추가'};
  upd();
  modalClick=e=>{
    const o=e.target.closest('[data-oi]');if(o){oi=+o.dataset.oi;reset();upd();return}
    const n=e.target.closest('[data-nm]');if(n&&!n.disabled){const v=n.dataset.nm;picked.has(v)?picked.delete(v):picked.add(v);upd();return}
    if(e.target.closest('[data-ocradd]')){const v=cleanLine($('#ocrFix').value).slice(0,20);if(!v)return;if(!opts[oi].names.includes(v))opts[oi].names.push(v);low.delete(v);picked.add(v);upd();setTimeout(()=>{const f=$('#ocrFix');f&&f.focus()},0)}
  };
}
