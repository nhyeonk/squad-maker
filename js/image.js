/* 스쿼드 메이커 · image.js
 * 스쿼드 이미지 만들기·저장·공유
 */
/* ================= 스쿼드 이미지 ================= */
function saveBlobFile(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
async function shareFile(blob,name,text){try{const f=new File([blob],name,{type:blob.type});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'스쿼드 메이커',text});return true}}catch(e){if(e&&e.name==='AbortError')return true}return false}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function fitText(ctx,t,max){if(ctx.measureText(t).width<=max)return t;while(t.length>1&&ctx.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…'}
const FONT="'Noto Sans KR',system-ui,sans-serif";
function drawTeam(k){
  const t=cur.teams[k];const W=900,PW=600,PH=Math.round(PW*105/68),HEAD=120,PAD=24,H=HEAD+PH+PAD*2+10;
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#f3f1ea';x.fillRect(0,0,W,H);
  // header
  x.fillStyle=t.color;rr(x,PAD,PAD,10,64,5);x.fill();
  x.fillStyle='#1c1e1b';x.font=`900 38px ${FONT}`;x.textBaseline='alphabetic';x.fillText(fitText(x,t.name,520),PAD+26,PAD+40);
  x.fillStyle='#6c7069';x.font=`700 20px ${FONT}`;
  const sub=[`${cur.size}인 ${fname(t)}`,cur.title||'',fmtDate(today())].filter(Boolean).join(' · ');
  x.fillText(fitText(x,sub,560),PAD+26,PAD+72);
  // pitch
  const px=PAD,py=HEAD;
  x.save();rr(x,px,py,PW,PH,18);x.clip();
  for(let i=0;i<12;i++){x.fillStyle=i%2?'#2a8447':'#2f8f4e';x.fillRect(px,py+i*PH/12,PW,PH/12+1)}
  const sx=PW/68,sy=PH/105;x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=2.5;
  const R=(a,b,w,h)=>x.strokeRect(px+a*sx,py+b*sy,w*sx,h*sy);
  R(2,2,64,101);x.beginPath();x.moveTo(px+2*sx,py+52.5*sy);x.lineTo(px+66*sx,py+52.5*sy);x.stroke();
  x.beginPath();x.arc(px+34*sx,py+52.5*sy,9.15*sx,0,Math.PI*2);x.stroke();
  R(13.85,2,40.3,16.5);R(24.84,2,18.32,5.5);R(13.85,86.5,40.3,16.5);R(24.84,97.5,18.32,5.5);
  x.restore();
  for(const s of t.slots){
    const cx=px+s.x/100*PW,cy=py+s.y/100*PH,P=posOf(s),col=POSCOL[P.cat],r=30;
    x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);
    if(s.pid){x.fillStyle=col;x.fill();x.lineWidth=3;x.strokeStyle='#fff';x.beginPath();x.arc(cx,cy,r-5,0,Math.PI*2);x.stroke();x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.lineWidth=4;x.strokeStyle=col;x.stroke();x.fillStyle=textOn(col)}
    else{x.fillStyle='rgba(10,20,14,.35)';x.fill();x.setLineDash([7,5]);x.lineWidth=3;x.strokeStyle=col;x.stroke();x.setLineDash([]);x.fillStyle=col}
    x.font=`900 ${P.code.length>3?13:15}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillText(P.code,cx,cy+1);
    if(s.pid){
      x.font=`700 19px ${FONT}`;const nm=fitText(x,pname(s.pid),130);const tw=x.measureText(nm).width+20;
      x.fillStyle='rgba(0,0,0,.68)';rr(x,cx-tw/2,cy+r+6,tw,30,7);x.fill();
      x.fillStyle=t.color;x.fillRect(cx-tw/2+4,cy+r+32,tw-8,3);
      x.fillStyle='#fff';x.fillText(nm,cx,cy+r+21);
    }
    x.textAlign='left';x.textBaseline='alphabetic';
  }
  // right column
  const cx0=px+PW+20,cw=W-cx0-PAD;let cy0=py;
  if(cur.referee){
    x.fillStyle='#1c1e1b';rr(x,cx0,cy0,cw,86,14);x.fill();
    x.fillStyle='#ffd84d';x.beginPath();x.arc(cx0+26,cy0+28,13,0,Math.PI*2);x.fill();
    x.fillStyle='#1c1e1b';x.font=`900 14px ${FONT}`;x.textAlign='center';x.fillText('심',cx0+26,cy0+33);x.textAlign='left';
    x.fillStyle='rgba(255,255,255,.75)';x.font=`700 17px ${FONT}`;x.fillText('심판',cx0+48,cy0+34);
    x.fillStyle='#fff';x.font=`900 22px ${FONT}`;x.fillText(fitText(x,cur.referee,cw-30),cx0+16,cy0+70);
    cy0+=100;
  }
  const subs=subsOf(t);
  const sh=56+Math.max(1,subs.length)*44;
  x.fillStyle='#1f2a22';rr(x,cx0,cy0,cw,sh,14);x.fill();
  x.fillStyle='rgba(255,255,255,.8)';x.font=`900 18px ${FONT}`;x.fillText(`후보 ${subs.length}`,cx0+16,cy0+34);
  if(!subs.length){x.fillStyle='rgba(255,255,255,.45)';x.font=`500 16px ${FONT}`;x.fillText('없음',cx0+16,cy0+76)}
  subs.forEach((p,i)=>{const y=cy0+50+i*44;x.fillStyle='rgba(255,255,255,.09)';rr(x,cx0+10,y,cw-20,36,8);x.fill();x.fillStyle=t.color;x.fillRect(cx0+10,y+4,4,28);
    x.fillStyle='#fff';x.font=`700 17px ${FONT}`;x.fillText(fitText(x,pname(p),cw-50),cx0+24,y+24)});
  // legend
  let ly=Math.max(cy0+sh+24,py+PH-130);
  [['FW','공격'],['MF','미드필더'],['DF','수비'],['GK','골키퍼']].forEach(([k2,l],i)=>{const y=ly+i*30;x.beginPath();x.arc(cx0+14,y,9,0,Math.PI*2);x.fillStyle=POSCOL[k2];x.fill();
    x.fillStyle='#6c7069';x.font=`700 16px ${FONT}`;x.fillText(l,cx0+32,y+6)});
  x.fillStyle='#a5a194';x.font=`500 14px ${FONT}`;x.fillText('스쿼드 메이커',cx0,py+PH-4);
  return c;
}
function drawAll(){
  const cs=keys().map(drawTeam);const cols=cs.length>1?2:1,rows=Math.ceil(cs.length/cols);
  const w=cs[0].width,h=cs[0].height,g=0;
  const c=document.createElement('canvas');c.width=w*cols;c.height=h*rows;const x=c.getContext('2d');x.fillStyle='#f3f1ea';x.fillRect(0,0,c.width,c.height);
  cs.forEach((cv,i)=>x.drawImage(cv,(i%cols)*w,Math.floor(i/cols)*h));
  if(cols>1){x.strokeStyle='#e3e0d6';x.lineWidth=2;for(let i=1;i<cols;i++){x.beginPath();x.moveTo(i*w,20);x.lineTo(i*w,c.height-20);x.stroke()}}
  return c;
}
async function openImage(){
  try{await document.fonts.ready}catch(e){}
  let mode=cur.teamCount>1?'all':'one';
  const make=()=>{const c=mode==='all'?drawAll():drawTeam(cur.active);return c};
  let canvas=make();
  const body=()=>`${cur.teamCount>1?`<div class="picks" style="margin-bottom:10px"><button class="pick ${mode==='one'?'on':''}" data-im="one">${esc(T().name)}만</button><button class="pick ${mode==='all'?'on':''}" data-im="all">전체 ${cur.teamCount}팀</button></div>`:''}
    <img class="img-prev" id="imgPrev" src="${canvas.toDataURL('image/png')}" alt="스쿼드 이미지">
    <p class="sub" style="margin:0 0 6px">저장이 안 되면 이미지를 길게 눌러 저장하세요.</p>`;
  const blob=()=>new Promise(r=>canvas.toBlob(r,'image/png'));
  const fn=()=>{const t=mode==='all'?'전체':T().name;return `스쿼드_${t}_${today()}.png`.replace(/[\\/:*?"<>|\s]+/g,'_')};
  const acts=[{label:'닫기'}];
  if(navigator.canShare)acts.push({label:'카톡 등으로 공유',fn:()=>{blob().then(b=>shareFile(b,fn(),'오늘 스쿼드')).then(ok=>{if(!ok)toast('이 기기에서는 공유가 안 돼요. 저장 후 보내 주세요')});return false}});
  if(navigator.clipboard&&window.ClipboardItem)acts.push({label:'이미지 복사',fn:()=>{
    try{navigator.clipboard.write([new ClipboardItem({'image/png':blob()})]).then(()=>toast('이미지를 복사했어요 · 단톡방에 붙여넣으세요'),()=>toast('이 화면에서는 복사가 안 돼요. 저장해서 보내 주세요'))}catch(e){toast('이 화면에서는 복사가 안 돼요')}
    return false}});
  acts.push({label:'이미지 저장',primary:true,fn:()=>{blob().then(b=>{saveBlobFile(b,fn());toast('이미지를 저장했어요')});return false}});
  openModal('스쿼드 이미지',body(),acts);
  modalClick=e=>{const b=e.target.closest('[data-im]');if(!b)return;mode=b.dataset.im;canvas=make();$('#mBody').innerHTML=body()};
}
$('#saveImg').addEventListener('click',openImage);
