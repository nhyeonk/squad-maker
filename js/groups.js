/* 스쿼드 메이커 · 모임 목록과 저장된 선수 명단 */
function activateGroup(id){
  if(drag) cleanup();
  activeGroupId=id;
  const group=activeGroup();
  roster=group?.roster||{};
  matches=group?.matches||{};
  cur=group?.cur||freshCurrent();
  view=group?'lineup':'groups';
  sel=null;
  openMatch=null;
  openStat=null;
  selMode=false;
  selSet.clear();
  $('#nameInput').value='';
}

function renderGroups(){
  const entries=Object.entries(groups);
  $('#groupsBack').classList.toggle('hidden',!activeGroup());
  $('#groupList').innerHTML=entries.length?entries.map(([id,group])=>`
    <div class="saved-row">
      <button class="saved-open" data-open-group="${esc(id)}"><b>${esc(group.name)}</b>
        <small>${Object.keys(group.roster).length}명 · 저장한 스쿼드 ${group.squads.length}개</small>
      </button>
      ${id===defaultGroupId?'<span class="pill">기본 모임</span>':`<button class="mini-btn" data-default-group="${esc(id)}" aria-label="${esc(group.name)} 기본 모임으로 설정">기본 모임으로</button>`}
      <button class="mini-btn" data-rename-group="${esc(id)}" aria-label="${esc(group.name)} 이름 변경">이름 변경</button>
    </div>`).join(''):'<p class="card empty">모임을 만들면 선수와 스쿼드를 저장할 수 있어요.</p>';
}

function editGroup(id){
  const group=id?groups[id]:null;
  openNameDialog(group?'모임 이름 변경':'모임 만들기','모임 이름',group?.name||'',group?'저장':'만들기',name=>{
    if(Object.entries(groups).some(([key,item])=>key!==id&&item.name===name)){
      toast('같은 이름의 모임이 있어요');
      return false;
    }
    if(group){
      const previousName=group.name;
      group.name=group.cur.title=name;
      if(!saveLocal()){
        group.name=group.cur.title=previousName;
        return false;
      }
    }else{
      const key=uid();
      const previousDefault=defaultGroupId;
      groups[key]=makeGroup(name);
      defaultGroupId=defaultGroupId||key;
      if(!saveLocal()){
        delete groups[key];
        defaultGroupId=previousDefault;
        return false;
      }
      activateGroup(key);
    }
    renderAll();
  });
}

$('#groupsBtn').addEventListener('click',()=>{
  view='groups';sel=null;renderAll();window.scrollTo(0,0);
});
$('#groupsBack').addEventListener('click',()=>{
  view='lineup';renderAll();window.scrollTo(0,0);
});
$('#addGroup').addEventListener('click',()=>editGroup(null));
$('#groupList').addEventListener('click',e=>{
  const open=e.target.closest('[data-open-group]');
  const setDefault=e.target.closest('[data-default-group]');
  const rename=e.target.closest('[data-rename-group]');
  if(open){
    activateGroup(open.dataset.openGroup);
    renderAll();
    window.scrollTo(0,0);
  }else if(setDefault){
    const previousDefault=defaultGroupId;
    defaultGroupId=setDefault.dataset.defaultGroup;
    if(!saveLocal()){defaultGroupId=previousDefault;return}
    renderGroups();
    toast('기본 모임으로 설정했어요');
  }else if(rename) editGroup(rename.dataset.renameGroup);
});

$('#choosePlayers').addEventListener('click',()=>{
  const players=Object.keys(roster).sort((a,b)=>pname(a).localeCompare(pname(b),'ko'));
  const attending=new Set(cur.attendees);
  const body=`<div class="section-heading"><button class="mini-btn" data-toggle-roster>전체 선택/해제</button></div>
    <div class="roster-choices">${players.map(id=>`<label class="roster-choice"><input type="checkbox" value="${esc(id)}" ${attending.has(id)?'checked':''}><span>${esc(pname(id))}</span></label>`).join('')}</div>`;
  const checkboxes=()=>[...document.querySelectorAll('#mBody .roster-choice input')];
  openModal('오늘 참가자 선택',body,[{label:'취소'},{label:'적용',primary:true,fn:()=>{
    const chosen=new Set(checkboxes().filter(input=>input.checked).map(input=>input.value));
    for(const id of assignedIds()) if(!chosen.has(id)) removeEverywhere(id);
    tidy();
    cur.attendees=[...chosen];
    sel=null;
    commit();
  }}]);
  modalClick=e=>{
    if(!e.target.closest('[data-toggle-roster]')) return;
    const inputs=checkboxes();
    const check=inputs.some(input=>!input.checked);
    for(const input of inputs) input.checked=check;
  };
});
