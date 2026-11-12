/* 스쿼드 메이커 · ocr.js
 * 카톡 투표 캡처 → 참가자 추가 (Tesseract.js로 폰 안에서 글자 인식)
 */
/* ================= 카톡 투표 캡처 (폰 안에서 글자 인식: Tesseract.js) ================= */
const TESS_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let TW=null,ocrProg=null,ocrCancel=false,lastRaw='';
// 인식된 글자 원문 보기 (문제 확인용)
function rawBox(){return `<details style="margin-top:4px"><summary style="cursor:pointer;font-size:13px;color:var(--muted);font-weight:700">인식된 글자 그대로 보기</summary>
  <textarea readonly style="width:100%;height:160px;margin-top:6px;border:1px solid var(--line);border-radius:8px;padding:8px;font-size:12px">${esc(lastRaw||'(읽힌 글자가 없어요)')}</textarea></details>`}
function initShotButton(){ $('#shotBtn').classList.remove('hidden'); $('#shotFile').accept='image/*'; }
function initSample(){ initShotButton(); }   // 예전 app.js가 이 이름으로 불러도 동작하게
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
  // 한국어만 쓰는 게 카톡 캡처에서 더 정확했어요 (영어를 같이 켜면 아이콘을 영어로 잘못 읽어요)
  TW=await Tesseract.createWorker('kor',1,{logger:m=>{if(ocrProg)ocrProg(m)}});
  // 7 = 잘라낸 조각을 한 줄 글자로 읽기 (이름 하나씩 잘라서 읽어요)
  try{await TW.setParameters({tessedit_pageseg_mode:'7'})}catch(e){}
  return TW;
}
/* 캡처 다듬기 + 글자 덩어리 자르기
 * 1) 프로필 사진·아이콘처럼 색이 있는 부분은 지우고 회색 글자만 남겨요 (다크/라이트 모드 자동)
 * 2) 가로·세로로 빈 공간을 찾아 글자 덩어리(이름 하나, 제목 한 줄)를 하나씩 잘라내요
 * 3) 잘라낸 조각을 2배로 키워서 따로따로 읽어요 → 두 줄로 나란한 이름, 손글씨체 글꼴에도 강해요
 */
// 획 굵게: 주변 3×3 칸 중 가장 어두운 값으로 (검은 글자가 1px씩 두꺼워져요)
function thicken(cx,w,h){
  const im=cx.getImageData(0,0,w,h),d=im.data,g=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)g[i]=d[i*4];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let m=255;for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const v=g[yy*w+xx];if(v<m)m=v}}
    const k=(y*w+x)*4;d[k]=d[k+1]=d[k+2]=m;
  }
  cx.putImageData(im,0,0);
}
async function prepImage(file){
  const bmp=await createImageBitmap(file);
  const W=bmp.width,H=bmp.height,U=W/1080;
  const a=document.createElement('canvas');a.width=W;a.height=H;
  const ax=a.getContext('2d',{willReadFrequently:true});ax.drawImage(bmp,0,0);
  const im=ax.getImageData(0,0,W,H),d=im.data;let sum=0;
  for(let k=0;k<d.length;k+=4)sum+=0.299*d[k]+0.587*d[k+1]+0.114*d[k+2];
  const dark=sum/(d.length/4)<110;
  const m=new Uint8Array(W*H);
  for(let k=0,p=0;k<d.length;k+=4,p++){
    const r=d[k],g=d[k+1],b=d[k+2];const lum=0.299*r+0.587*g+0.114*b;const sat=Math.max(r,g,b)-Math.min(r,g,b);
    const on=sat<45&&(dark?lum>130:lum<170);m[p]=on?1:0;const v=on?0:255;d[k]=d[k+1]=d[k+2]=v;d[k+3]=255;
  }
  ax.putImageData(im,0,0);
  // 글자 줄 찾기
  const rowOn=new Uint8Array(H);for(let y=0;y<H;y++){const o=y*W;for(let x=0;x<W;x++)if(m[o+x]){rowOn[y]=1;break}}
  const segs=[];
  for(let y=0;y<H;){
    if(!rowOn[y]){y++;continue}
    const y0=y;while(y<H&&rowOn[y])y++;const y1=y;
    if(y1-y0<12*U||y1-y0>160*U) continue;
    // 줄 안에서 글자 덩어리 나누기 (빈칸이 넓으면 다른 덩어리)
    let cur=null;const parts=[];
    for(let x=0;x<W;x++){
      let on=0;for(let yy=y0;yy<y1;yy++)if(m[yy*W+x]){on=1;break}
      if(!on) continue;
      if(cur&&x-cur[1]>28*U){parts.push(cur);cur=null}
      if(!cur)cur=[x,x];cur[1]=x;
    }
    if(cur)parts.push(cur);
    for(const [x0,x1] of parts)if(x1-x0>=14*U)segs.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0});
  }
  // 조각 이미지 만들기
  // - 글자 높이를 약 100px로 맞춰요 (캡처 크기가 달라도 같은 크기로 읽게)
  // - 획을 살짝 굵게 해요 (손글씨체 글꼴에서 받침이 빠지는 걸 막아요: 재후→재훈)
  const pad=Math.round(10*U);
  return segs.slice(0,90).map(sg=>{
    const sx=Math.max(0,sg.x-pad),sy=Math.max(0,sg.y-pad),sw=Math.min(W-sx,sg.w+pad*2),sh=Math.min(H-sy,sg.h+pad*2);
    const f=Math.min(4,Math.max(1,100/sg.h));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*f));c.height=Math.max(1,Math.round(sh*f));
    const cx=c.getContext('2d',{willReadFrequently:true});cx.fillStyle='#fff';cx.fillRect(0,0,c.width,c.height);
    cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(a,sx,sy,sw,sh,0,0,c.width,c.height);
    thicken(cx,c.width,c.height);
    return c;
  });
}

/* ---- 이름 정리 규칙 ---- */
const OPT_WORDS=['참석','불참','참가','불가능','불가','가능','미정','늦참','지각','조퇴','보류','모름','고민중','고민','갑니다','못가요','가요','안가요'];
const OPT_RE=new RegExp('^('+OPT_WORDS.join('|')+'|yes|no|o|x)(?=\\s|$|\\d|\\()','i');
const DAY_RE=/[월화수목금토일]요일/;
// 이름이 아니라서 걸러낼 화면 문구
const UI_RE=/투표|참여|결과|마감|익명|복수|선택|항목|멤버|공유|닫기|확인|오전|오후|채팅|현황|보기|완료|다시|종료|만든|생성|메시지|검색|알림|사진|카카오|게시판|읽음|전송|답장|더보기|설정|프로필|친구|목록|인원|명단|님이|님의|^나$|^me$/i;
// 한글 자모로 나눠서 비슷한 글자 비교 (손글씨체 오인식 보정용)
const CJ='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function jamo(s){let o='';for(const ch of String(s)){const c=ch.charCodeAt(0)-0xAC00;
  if(c>=0&&c<11172){o+=String.fromCharCode(0x1100+Math.floor(c/588),0x1161+Math.floor(c%588/28))+(c%28?String.fromCharCode(0x11A7+c%28):'')}
  else if(CJ.includes(ch))o+=String.fromCharCode(0x1100+CJ.indexOf(ch));          // 낱자음 ㅎ → 초성 ㅎ
  else if(ch>='ㅏ'&&ch<='ㅣ')o+=String.fromCharCode(0x1161+ch.charCodeAt(0)-0x314F);
  else o+=ch}return o}
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=Array.from({length:n+1},(_,i)=>i);
  for(let i=1;i<=m;i++){const q=[i];for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=q}return p[n]}
function closest(word,list,maxD){let best=null,bd=99,tie=false;const jw=jamo(word);
  for(const c of list){const d=lev(jw,jamo(c));if(d<bd){bd=d;best=c;tie=false}else if(d===bd&&c!==best)tie=true}
  return best&&!tie&&bd<=maxD?best:null}
function cleanLine(t){
  t=String(t||'').replace(/\(.*?\)|\[.*?\]/g,' ');
  t=t.replace(/[^\p{Script=Hangul}A-Za-z0-9\s:/]/gu,' ').replace(/\s+/g,' ').trim();
  return t;
}
// 카톡 이름 보정: '나' 배지 빼기, 띄어 읽힌 한글 이름 붙이기
function tidyName(t){
  t=t.replace(/[:/]/g,' ').replace(/\s+/g,' ').trim();
  t=t.replace(/^나\s+(?=\S)/,'');
  let tk=t.split(' ').filter(w=>w&&!/\d/.test(w));            // 숫자 섞인 조각은 잡음
  if(!tk.length) return '';
  if(tk.every(w=>/^\p{Script=Hangul}+$/u.test(w))){
    const long=tk.filter(w=>w.length>=3);
    if(long.length) return long.sort((x,y)=>y.length-x.length)[0];   // "욱 정재훈" → 정재훈
    const j=tk.join('');return j.length<=5?j:tk.join(' ');            // "남 지 현", "김 남현" → 붙이기
  }
  return tk.join(' ');
}
function headerLabel(t){
  const before=t.split(/[:：]/)[0].replace(/\d+\s*명\s*$/,'').trim();
  const day=before.replace(/\s/g,'').match(/([월화수목금토일])요/);   // '금요및'처럼 끝 글자가 틀려도 요일을 알아봐요
  if(day) return day[1]+'요일';          // 날짜 숫자는 손글씨체에서 잘 틀려서 요일만 써요
  const om=before.match(OPT_RE);if(om) return om[1];
  const w=before.replace(/[^\p{Script=Hangul}A-Za-z]/gu,'');
  const near=w&&w.length<=4?closest(w,OPT_WORDS,2):null;   // 예: '붕찰' → '불참'
  return near||w||'';
}
function isHeader(raw,t){
  if(/[:：].{0,5}명\s*$/.test(raw)) return true;              // "11/20 금요일 : 6명", "불참 : 1명"
  if(/\d+\s*명\s*$/.test(t)&&t.length<=20&&!UI_RE.test(t)) return true; // "참석 9명"
  const om=t.match(OPT_RE);return !!(om&&t.length<=om[0].length+6);
}
/* 한 번 고친 오타 기억하기: { 잘못 읽은 이름: 바른 이름 } */
const FIX_KEY='squadmaker.ocrfix';
function loadFixes(){try{return JSON.parse(localStorage.getItem(FIX_KEY))||{}}catch(e){return {}}}
function saveFix(from,to){if(!from||!to||from===to)return;const m=loadFixes();m[from]=to;try{localStorage.setItem(FIX_KEY,JSON.stringify(m))}catch(e){}}
function parseOCR(lines){
  const rosterNames=Object.values(roster).map(r=>r.name);
  const learned=loadFixes();
  const hasHeader=lines.some(l=>{const raw=String(l.text||'');return isHeader(raw,cleanLine(raw))});
  const opts=[];let curO=null;const low=new Set(),fixed={};
  const getOpt=l=>{let o=opts.find(x=>x.label===l);if(!o){o={label:l,names:[]};opts.push(o)}return o};
  for(const ln of lines){
    const raw=String(ln.text||'').trim();if(!raw) continue;
    const t=cleanLine(raw);if(!t) continue;
    if(isHeader(raw,t)){let lb=headerLabel(t)||`항목 ${opts.length+1}`;if(opts.some(o=>o.label===lb))lb+=` (${opts.filter(o=>o.label.startsWith(lb)).length+1})`;curO=getOpt(lb);continue}
    if(hasHeader&&!curO) continue;                              // 제목·탭 같은 위쪽 글자는 버려요
    if(/\d{1,2}\s*:\s*\d{2}/.test(raw)) continue;              // 시간
    if(UI_RE.test(t)) continue;
    let name=tidyName(t);
    if(name.length<2||name.length>12) continue;
    if(/\d/.test(name)) continue;
    const jm=(name.match(/[\u3131-\u318E]/g)||[]).length;
    if(jm&&jm*2>=name.replace(/\s/g,'').length) continue;       // ㄱㄱ, ㅋㅋ 같은 자음·모음 위주 글자
    const broken=jm>0;                                          // "박ㅎ능"처럼 일부가 깨진 이름
    if(!/[\p{Script=Hangul}A-Za-z]/u.test(name)) continue;
    if(name.split(' ').length>3) continue;
    if(/^[A-Za-z]{1,4}$/.test(name)) continue;                 // 아이콘을 영어로 잘못 읽은 짧은 글자
    if(/\p{Script=Hangul}/u.test(name)&&/[A-Za-z]/.test(name)) continue;  // 한글·영어가 섞인 잡음
    let conf=ln.confidence==null?100:ln.confidence;if(broken)conf=Math.min(conf,40);
    if(learned[name]){fixed[learned[name]]=name;name=learned[name];conf=Math.max(conf,90)}   // 전에 고친 적 있는 오타
    if(!rosterNames.includes(name)&&/^[\p{Script=Hangul}]+$/u.test(name)){
      const near=closest(name,rosterNames.filter(r=>Math.abs(r.length-name.length)<=(broken?1:0)),name.length<=2?1:2);
      if(near){fixed[near]=name;name=near;conf=Math.max(conf,80)}   // 지난 참가자 이름으로 보정
    }
    const o=curO||getOpt('명단');
    if(!o.names.includes(name)){o.names.push(name);if(conf<55)low.add(name)}else if(conf>=55)low.delete(name);
  }
  return {opts:opts.filter(o=>o.names.length),low,fixed};
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
      };
    const w=await getWorker();
    for(const f of files){
      if(ocrCancel) return;
      const crops=await prepImage(f);
      for(let ci=0;ci<crops.length;ci++){
        if(ocrCancel) return;
        setMsg(`글자 읽는 중 (${files.length>1?`${files.indexOf(f)+1}/${files.length}장, `:''}${ci+1}/${crops.length})…`);
        const {data}=await w.recognize(crops[ci]);
        all.push({text:String(data.text||'').replace(/\s*\n\s*/g,' ').trim(),confidence:data.confidence});
      }
    }
  }catch(e){
    if(ocrCancel) return;
    closeModal();TW=null;
    const why=navigator.onLine===false?'처음 한 번은 인터넷이 연결돼 있어야 해요.':(!window.Tesseract?'글자 인식 엔진을 불러오지 못했어요. 인터넷 연결을 확인하거나, 카톡 안 브라우저라면 크롬·사파리로 열어 주세요.':'캡처를 읽는 중에 문제가 생겼어요.');
    openModal('캡처를 읽지 못했어요',`<p>${why}</p><p class="sub">오류 내용: ${esc(String(e&&(e.message||e)).slice(0,200))}</p>`,[{label:'확인',primary:true}]);return;
  }finally{ocrProg=null}
  if(ocrCancel) return;
  lastRaw=all.map(l=>l.text).filter(t=>String(t).trim()).join('\n');
  const {opts,low,fixed}=parseOCR(all);
  if(!opts.some(o=>o.names.length)){
    closeModal();
    openModal('이름을 찾지 못했어요','<p>투표 결과에서 <b>투표한 사람 목록</b>(투표 현황)을 연 상태로 캡처해 주세요. 득표수만 보이는 화면에서는 이름을 알 수 없어요. 글씨가 작으면 화면을 키워서 캡처하면 더 잘 읽혀요.</p>'+rawBox(),[{label:'확인',primary:true}]);
    return;
  }
  showShotResult(opts,'',low,fixed);
}
function showShotResult(opts,title,low=new Set(),fixed={}){
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
      return `<button class="pick ${picked.has(n)?'on':''} ${id&&!inToday?'exist':''}" data-nm="${esc(n)}" ${inToday?'disabled title="이미 오늘 명단에 있어요"':''}>${low.has(n)?'❓':''}${esc(n)}${fixed[n]?`<span class="opt-cnt">← ${esc(fixed[n])}</span>`:''}</button>`}).join(''):'<span class="empty">이 항목은 이름이 보이지 않아요.</span>'}</div>
    <div class="add-row" style="margin:-4px 0 8px"><input id="ocrFix" class="name-in" placeholder="틀리거나 빠진 이름을 바르게 입력" maxlength="20" style="font-weight:500"><button class="btn" data-ocradd="1">넣기</button></div>
    ${rawBox()}
    <p class="sub" style="margin:8px 0 8px">글자 인식이라 틀릴 수 있어요. 틀린 이름은 위 칸에 바른 이름을 적고 넣기를 누르면 비슷한 이름을 찾아 바꿔 주고, 다음부터는 자동으로 고쳐요. ❓는 흐릿하게 읽혀서 기본으로 빠져 있어요. "기존"은 지난 기록이 있는 선수예요.</p>`;
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
    if(e.target.closest('[data-ocradd]')){
      const v=tidyName(cleanLine($('#ocrFix').value)).slice(0,20);if(!v)return;
      // 비슷한 이름이 이미 목록에 있으면 그걸 고친 걸로 봐요 (예: 정재후 → 정재훈) → 모든 항목에서 바꾸고 기억해요
      const allNames=[...new Set(opts.flatMap(o=>o.names))].filter(n=>n!==v&&!Object.values(roster).some(r=>r.name===n));
      const wrong=/^[\p{Script=Hangul}ㄱ-ㅣ]+$/u.test(v)?closest(v,allNames.filter(n=>Math.abs(n.length-v.length)<=1),3):null;
      if(wrong){
        for(const o of opts){const i=o.names.indexOf(wrong);if(i>=0){if(o.names.includes(v))o.names.splice(i,1);else o.names[i]=v}}
        picked.delete(wrong);low.delete(wrong);picked.add(v);
        fixed[v]=wrong;saveFix(wrong,v);toast(`${wrong} → ${v}로 고쳤어요. 다음부터는 자동으로 고쳐요`);
      }else{if(!opts[oi].names.includes(v))opts[oi].names.push(v);low.delete(v);picked.add(v)}
      $('#ocrFix').value='';upd();setTimeout(()=>{const f=$('#ocrFix');f&&f.focus()},0)}
  };
}

// 이 파일이 불러와지면 바로 캡처 버튼을 보여줘요 (app.js가 예전 버전이어도 버튼이 나오게)
try{initShotButton()}catch(e){}
