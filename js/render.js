// 화면 그리기 (탭 전환, 상단 상태 표시)
import { S } from "./state.js";
import { $ } from "./utils.js";
import { viewLineup, viewSelbar } from "./views/lineup.js";
import { viewMatchList, viewMatch } from "./views/matches.js";
import { viewPlayers } from "./views/players.js";
import { openSettings } from "./views/modals.js";

function renderChrome() {
  const sync = $("#sync");
  if (S.mode === "local") [sync.className, sync.textContent] = ["sync", "이 폰에만 저장"];
  else if (S.canEdit) [sync.className, sync.textContent] = ["sync live", "● 실시간 · 기록자"];
  else [sync.className, sync.textContent] = ["sync ro", "● 실시간 · 보기 전용"];

  document.body.classList.toggle("ro", !S.canEdit);
  // 관리자에게 기록자 신청이 오면 설정 버튼에 빨간 점
  document.querySelector('[data-act="settings"]')?.classList.toggle("has-dot", S.isOwner && (S.requests || []).length > 0);
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.ui.tab));

  $("#banner").innerHTML =
    S.mode === "remote" && !S.canEdit
      ? `<div class="banner"><span class="sp">보기 전용이에요. 기록을 입력하려면 ⚙️ 설정에서 로그인하세요.</span><button class="btn sm ghost" data-act="settings">로그인</button></div>`
      : "";

  $("#foot").innerHTML =
    S.mode === "local"
      ? `기록은 이 폰(브라우저)에만 저장돼요. 친구들과 같이 보려면 ⚙️ 설정에서 서버를 연결하세요.<br>
         <button class="btn sm ghost" data-act="export">백업 파일 저장</button> <button class="btn sm ghost" data-act="import" data-edit>백업 불러오기</button>`
      : `기록이 서버에 저장되고 같은 링크를 연 모두에게 실시간으로 보여요.<br>
         <button class="btn sm ghost" data-act="share">공유 링크 복사</button> <button class="btn sm ghost" data-act="export">백업 파일 저장</button>`;
}

export function render() {
  renderChrome();
  const app = $("#app");
  if (S.mode === "remote" && !S.ready) {
    app.innerHTML = `<div class="card empty">기록을 불러오는 중…</div>`;
    return;
  }
  if (S.ui.tab === "lineup") app.innerHTML = viewLineup();
  else if (S.ui.tab === "matches") {
    const m = S.ui.matchId && S.matches[S.ui.matchId];
    app.innerHTML = m ? viewMatch(m) : viewMatchList();
  } else app.innerHTML = viewPlayers();
  $("#selbar").innerHTML = viewSelbar();
  // 로그인·권한이 바뀌면 열려 있는 설정 창도 새로 그려요
  if (S.ui.settingsOpen && !document.activeElement?.closest?.("#modal input")) openSettings();
}

/** 실시간 업데이트가 와도 입력 중이면 기다렸다가 다시 그려요 (입력 끊김 방지) */
let pending = false;
export function scheduleRender() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest("#app,#modal")) {
    pending = true;
    return;
  }
  render();
}
document.addEventListener("focusout", () =>
  setTimeout(() => {
    if (pending) {
      pending = false;
      scheduleRender();
    }
  }, 50)
);
