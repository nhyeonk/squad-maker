/* 스쿼드 메이커 · setup.js
 * 팀당 인원 변경
 */
function fname(t){return FORMATIONS[cur.size].includes(t.formation)?t.formation:'직접 배치'}
function resizeTeam(t,n){
  const sl=t.slots;let out=0;
  if(n>sl.length){
    const cand=buildSlots(FORMATIONS[n][0]).slice(1);
    const d=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*1.4);
    while(sl.length<n&&cand.length){
      let bi=0,bd=-1;cand.forEach((c,i)=>{const m=Math.min(...sl.map(s=>d(s,c)));if(m>bd){bd=m;bi=i}});
      const c=cand.splice(bi,1)[0];sl.push({x:c.x,y:c.y,label:c.label,pid:null});
    }
  }else{
    while(sl.length>n){
      let i=-1;for(let j=sl.length-1;j>=1;j--)if(!sl[j].pid){i=j;break}
      if(i<0){i=sl.length-1;if(sl[i].pid)out++}
      sl.splice(i,1);
    }
  }
  t.formation='custom';return out;
}
$('#sizeSel').addEventListener('change',e=>{
  const n=+e.target.value;if(n===cur.size)return;
  let out=0;for(const k of TK)if(cur.teams[k])out+=resizeTeam(cur.teams[k],n);
  const up=n>cur.size;cur.size=n;sel=null;commit();
  toast(up?`${n} vs ${n}로 늘렸어요 · 빈자리를 채워 주세요`:`${n} vs ${n}로 줄였어요${out?` · ${out}명은 대기로 갔어요`:''}`);
});
