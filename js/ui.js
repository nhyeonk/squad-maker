/* 스쿼드 메이커 · ui.js
 * 공통 화면 도우미: 알림(toast), 팝업(modal)
 */
/* ================= ui helpers ================= */
let toastT,modalClick=null;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2200)}
function openModal(title,body,actions){
  $('#mTitle').textContent=title;$('#mBody').innerHTML=body;modalClick=null;
  const box=$('#mActions');box.innerHTML='';
  actions.forEach(a=>{const b=document.createElement('button');b.className='btn'+(a.primary?' primary':'')+(a.danger?' danger':'');b.textContent=a.label;
    b.onclick=()=>{if(a.fn&&a.fn()===false)return;closeModal()};box.appendChild(b)});
  $('#modal').classList.remove('hidden');
}
function closeModal(){$('#modal').classList.add('hidden');modalClick=null}
function confirmBox(title,msg,okLabel,fn,danger){openModal(title,'<p>'+esc(msg)+'</p>',[{label:'취소'},{label:okLabel,primary:!danger,danger:!!danger,fn}])}
function openNameDialog(title,label,value,action,save){
  const submit=()=>{
    const name=$('#itemName').value.trim().slice(0,60);
    if(!name){toast('이름을 입력하세요');return false}
    return save(name);
  };
  openModal(title,`<label class="modal-field">${esc(label)}<input class="name-in" id="itemName" maxlength="60" value="${esc(value)}"></label>`,
    [{label:'취소'},{label:action,primary:true,fn:submit}]);
  const input=$('#itemName');
  input.focus();
  input.select();
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.isComposing&&submit()!==false) closeModal();
  });
}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
$('#mBody').addEventListener('click',e=>{if(modalClick)modalClick(e)});
