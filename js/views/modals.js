// 팝업 창들: 선수 정보, 골 입력, 경기 시작, 출전 선수 추가, 설정
import { S, P, pname, lineup } from "../state.js";
import { POS, POS_KO } from "../formations.js";
import { computeStats, scoreOf } from "../stats.js";
import { teamPlayers } from "../lineup.js";
import { getCfg, groupId } from "../store.js";
import { GROUP_ID } from "../config.js";
import { $, esc, fmtDate, todayStr } from "../utils.js";
import { dot } from "./common.js";

export function openModal(html) {
  $("#modal").innerHTML = `<div class="mask" data-act="maskclose"><div class="modal">${html}</div></div>`;
}
export function closeModal() {
  $("#modal").innerHTML = "";
}
const closeBtn = `<span class="sp"></span><button class="btn sm" data-act="close">닫기</button>`;

/* ---------- 선수 정보 ---------- */
export function openPlayer(pid) {
  const p = P(pid);
  if (!p) return;
  const s = computeStats().st[pid] || {};
  const ed = S.canEdit;
  const dis = ed ? "" : "disabled";

  const hist = Object.values(S.matches)
    .filter((m) => m.teams.some((T) => (T.players || []).includes(pid)))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 30)
    .map((m) => {
      const ti = m.teams.findIndex((T) => (T.players || []).includes(pid));
      const sc = scoreOf(m);
      const r = m.status !== "done" ? "" : sc[ti] > sc[1 - ti] ? "W" : sc[ti] < sc[1 - ti] ? "L" : "D";
      const g = (m.goals || []).filter((x) => x.scorer === pid && !x.og).length;
      const a = (m.goals || []).filter((x) => x.assist === pid).length;
      return `<div class="hist"><span>${fmtDate(m.date)} ${esc(m.title || "")} <span style="color:var(--sub)">${esc(m.teams[ti].name)}</span></span>
        <span>${g ? `⚽${g} ` : ""}${a ? `🅰️${a} ` : ""}${sc[ti]}:${sc[1 - ti]} ${r ? `<span class="wl ${r}">${{ W: "승", D: "무", L: "패" }[r]}</span>` : ""}</span></div>`;
    })
    .join("");

  const posBtns = POS.map((r) => {
    const i = (p.pos || []).indexOf(r);
    return `<button class="${r} ${i >= 0 ? "on" : ""}" data-act="ppos" data-v="${pid}:${r}" ${dis}>${POS_KO[r]}${i >= 0 ? `<i>${i + 1}</i>` : ""}</button>`;
  }).join("");
  const stars = [1, 2, 3, 4, 5].map((n) => `<button class="${n <= (p.skill || 3) ? "on" : ""}" data-act="pskill" data-v="${pid}:${n}" ${dis}>★</button>`).join("");

  openModal(`<h2>${ed ? `<input class="in" id="pnm" value="${esc(p.name)}" style="font-weight:800;font-size:17px">` : esc(p.name)}${closeBtn}</h2>
    <div class="sec"><label>선호 포지션 · 누른 순서가 우선순위예요</label><div class="posbtns">${posBtns}</div></div>
    <div class="sec"><label>실력 (팀 밸런스용)</label><div class="stars">${stars}</div></div>
    <div class="sec"><label>기록</label>
      <div style="font-size:14px;font-weight:700">${s.apps || 0}경기 · ${s.goals || 0}골 · ${s.ast || 0}도움 · ${s.w || 0}승 ${s.d || 0}무 ${s.l || 0}패</div>${hist}</div>
    ${ed ? `<div class="row"><button class="btn pri" data-act="psave" data-v="${pid}" style="flex:1">이름 저장</button><button class="btn danger" data-act="pdel" data-v="${pid}">선수 삭제</button></div>` : ""}`);
}

/* ---------- 골 입력 ---------- */
export function openGoal(ti) {
  S.ui.goalDraft = { team: ti, scorer: null, assist: null, og: false };
  redrawGoal();
}
export function redrawGoal() {
  const m = S.matches[S.ui.matchId];
  const d = S.ui.goalDraft;
  const T = m.teams[d.team], O = m.teams[1 - d.team];
  const list = d.og ? O.players || [] : T.players || [];
  const pick = (act, cur, ids, noneLabel) =>
    `<div class="pick">${ids.map((id) => `<button class="${cur === id ? "on" : ""}" data-act="${act}" data-v="${id}">${esc(pname(id))}</button>`).join("")}
      <button class="${cur === null ? "on" : ""}" data-act="${act}" data-v="">${noneLabel}</button></div>`;

  openModal(`<h2>${dot(T.color)}${esc(T.name)} 골${closeBtn}</h2>
    <div class="sec"><div class="seg"><button class="${!d.og ? "on" : ""}" data-act="gog" data-v="0">일반 골</button><button class="${d.og ? "on" : ""}" data-act="gog" data-v="1">상대 자책골</button></div></div>
    <div class="sec"><label>${d.og ? `자책골 넣은 선수 (${esc(O.name)})` : "득점"}</label>${pick("gsc", d.scorer, list, "모름")}</div>
    ${d.og ? "" : `<div class="sec"><label>도움 (선택)</label>${pick("gas", d.assist, list.filter((id) => id !== d.scorer), "없음")}</div>`}
    <button class="btn pri block" data-act="gsave">골 기록</button>`);
}

/* ---------- 경기 시작 ---------- */
export function openStartMatch() {
  const l = lineup();
  const ready = l.teams.map((T, i) => ({ i, n: teamPlayers(T).filter(P).length })).filter((x) => x.n);
  if (ready.length < 2) return false;
  S.ui.mpick = [ready[0].i, ready[1].i];
  redrawStart();
  return true;
}
export function redrawStart() {
  const l = lineup();
  const todayCount = Object.values(S.matches).filter((m) => m.date === todayStr()).length;
  openModal(`<h2>경기 시작${closeBtn}</h2>
    ${l.teams.length > 2 ? `<div class="sec"><label>어느 두 팀이 붙나요?</label><div class="pick">${l.teams
      .map((T, i) => `<button class="${S.ui.mpick.includes(i) ? "on" : ""}" data-act="mpick" data-v="${i}">${esc(T.name)} (${teamPlayers(T).filter(P).length})</button>`)
      .join("")}</div></div>` : ""}
    <div class="sec"><label>경기 이름 (선택)</label><input class="in" id="mtitle" value="${todayCount + 1}경기"></div>
    <button class="btn pri block" data-act="mcreate">시작</button>`);
}

/* ---------- 경기에 선수 추가 ---------- */
export function openAddMatchPlayer(ti) {
  const m = S.matches[S.ui.matchId];
  const inMatch = new Set(m.teams.flatMap((T) => T.players || []));
  const cands = Object.values(S.players)
    .filter((p) => !inMatch.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  openModal(`<h2>${esc(m.teams[ti].name)}에 선수 추가${closeBtn}</h2>
    <form class="row sec" data-act="maddname" data-v="${ti}"><input class="in" name="n" placeholder="새 이름"><button class="btn pri">추가</button></form>
    <div class="pick">${cands.map((p) => `<button data-act="maddpick" data-v="${ti}:${p.id}">${esc(p.name)}</button>`).join("") || `<span class="hint">추가할 선수가 없어요.</span>`}</div>`);
}

/* ---------- 새 선수 ---------- */
export function openNewPlayer() {
  openModal(`<h2>선수 추가${closeBtn}</h2>
    <form class="row" data-act="newplayer"><input class="in" name="n" placeholder="이름" autofocus><button class="btn pri">추가</button></form>`);
  setTimeout(() => $('form[data-act="newplayer"] input')?.focus(), 50);
}

/* ---------- 설정 ---------- */
export function openSettings() {
  const c = getCfg();
  const backup = `<div class="sec" style="margin-top:16px"><label>백업</label><div class="grid2">
    <button class="btn" data-act="export">백업 파일 저장</button><button class="btn" data-act="import" data-edit>백업 불러오기</button></div></div>`;

  if (S.mode === "remote") {
    const loginBox = S.user
      ? `<button class="btn block" data-act="logout">로그아웃</button>`
      : `<form data-act="login" style="display:grid;gap:8px">
          <input class="in" name="e" type="email" placeholder="이메일" autocomplete="username">
          <input class="in" name="p" type="password" placeholder="비밀번호" autocomplete="current-password">
          <button class="btn pri">로그인</button></form>
        <p class="hint">기록자 계정은 Firebase 콘솔 → Authentication에서 만들어요.</p>`;
    return openModal(`<h2>설정${closeBtn}</h2>
      <div class="sec"><label>친구 초대</label><button class="btn pri block" data-act="share">🔗 공유 링크 복사</button>
        <p class="hint">이 링크를 단톡방에 올리면 누구나 로그인 없이 실시간으로 볼 수 있어요.</p></div>
      <div class="sec"><label>기록자 로그인 ${S.user ? `<span class="badge">${esc(S.user.email)}</span>` : ""}</label>${loginBox}</div>
      ${S.user ? `<div class="sec"><label>이 폰의 예전 기록 올리기</label><button class="btn block" data-act="upload">이 폰에 저장된 기록을 서버로 합치기</button></div>` : ""}
      <div class="sec"><label>그룹 ID</label><code>${esc(groupId())}</code></div>
      <button class="btn danger block" data-act="disconnect">서버 연결 해제 (이 폰만)</button>${backup}`);
  }

  openModal(`<h2>설정${closeBtn}</h2>
    <div class="sec"><label>친구들과 실시간 공유 (Firebase)</label>
      <p class="hint" style="margin:0 0 8px">Firebase 콘솔의 웹 앱 설정(<code>firebaseConfig</code>)을 통째로 붙여넣으세요.</p>
      <textarea class="in" id="cfg" rows="7" placeholder='const firebaseConfig = { apiKey: "...", projectId: "...", ... };'>${esc(c ? JSON.stringify(c.config, null, 2) : "")}</textarea>
      <label class="lb" style="display:block;margin:10px 0 6px">그룹 ID (모임 이름, 영문)</label><input class="in" id="gid" value="${esc(c?.gid || GROUP_ID)}">
      <button class="btn pri block" style="margin-top:10px" data-act="connect">연결하기</button></div>${backup}`);
}
