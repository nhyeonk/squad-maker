/* 스쿼드 메이커 · 모임별 스쿼드 저장과 불러오기 */
$('#saveSquad').addEventListener('click',()=>{
  const group=activeGroup();
  openNameDialog('스쿼드 저장','스쿼드 이름',today(),'저장',name=>{
    if(group.squads.some(squad=>squad.name===name)){
      toast('같은 이름의 스쿼드가 있어요');
      return false;
    }
    group.squads.unshift({id:uid(),name,savedAt:Date.now(),lineup:clone(cur)});
    if(!saveLocal()){group.squads.shift();return false}
    renderAll();
    toast('스쿼드를 저장했어요');
  });
});

$('#loadSquad').addEventListener('click',()=>{
  const group=activeGroup();
  const rows=group.squads.map(squad=>`
    <div class="saved-row">
      <button class="saved-open" data-apply-squad="${esc(squad.id)}"><b>${esc(squad.name)}</b>
        <small>${Number.isFinite(squad.savedAt)?new Date(squad.savedAt).toLocaleDateString('ko-KR')+' · ':''}${esc(squad.lineup.size)}인제</small>
      </button>
      <button class="mini-btn" data-delete-squad="${esc(squad.id)}" aria-label="${esc(squad.name)} 삭제">삭제</button>
    </div>`).join('');
  openModal('스쿼드 불러오기',`<p>선택한 스쿼드로 현재 라인업을 바꿔요.</p><div class="saved-list">${rows}</div>`,[{label:'닫기'}]);
  modalClick=e=>{
    const apply=e.target.closest('[data-apply-squad]');
    const remove=e.target.closest('[data-delete-squad]');
    if(apply){
      const squad=group.squads.find(item=>item.id===apply.dataset.applySquad);
      if(!squad) return;
      const previous=cur;
      cur=normalizeCur(squad.lineup,roster);
      cur.title=group.name;
      if(!saveLocal()){group.cur=cur=previous;return}
      sel=null;
      closeModal();
      renderAll();
      toast('스쿼드를 불러왔어요');
    }else if(remove){
      const index=group.squads.findIndex(item=>item.id===remove.dataset.deleteSquad);
      if(index<0) return;
      confirmBox('저장한 스쿼드 삭제',`${group.squads[index].name} 스쿼드를 삭제할까요?`,'삭제',()=>{
        const [squad]=group.squads.splice(index,1);
        if(!saveLocal()){group.squads.splice(index,0,squad);return false}
        renderAll();
        toast('저장한 스쿼드를 삭제했어요');
      },true);
    }
  };
});
