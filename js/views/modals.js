// 팝업 창들: 선수 정보, 골 입력, 경기 시작, 출전 선수 추가, 설정
import { S, P, pname, lineup } from "../state.js";
import { POS, POS_KO, POSITION_GROUPS } from "../formations.js";
import { computeStats, scoreOf } from "../stats.js";
import { teamPlayers, currentSlots } from "../lineup.js";
import { getCfg, groupId } from "../store.js";
import { GROUP_ID } from "../config.js";
import { $, esc, fmtDate, todayStr } from "../utils.js";
import { dot } from "./common.js";

export function openModal(html) {
  S.ui.settingsOpen = false;
  $("#modal").innerHTML = `<div class="mask" data-act="maskclose"><div class="modal">${html}</div></div>`;
}
export function closeModal() {
  $("#modal").innerHTML = "";
  S.ui.settingsOpen = false;
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
    <div class="sec"><button class="btn block ${p.regular ? "pri" : "ghost"}" data-act="pregular" data-v="${pid}" ${dis}>${p.regular ? "⭐ 고정 참여 (눌러서 해제)" : "☆ 고정 참여로 지정"}</button></div>
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
  S.ui.settingsOpen = true;
  const c = getCfg();
  const backup = `<div class="sec" style="margin-top:16px"><label>백업</label><div class="grid2">
    <button class="btn" data-act="export">백업 파일 저장</button><button class="btn" data-act="import" data-edit>백업 불러오기</button></div></div>`;

  if (S.mode === "remote") {
    return openModal(`<h2>설정${closeBtn}</h2>
      <div class="sec"><label>친구 초대</label><button class="btn pri block" data-act="share">🔗 공유 링크 복사</button>
        <p class="hint">이 링크를 단톡방에 올리면 누구나 로그인 없이 실시간으로 볼 수 있어요.</p></div>
      ${accountSection()}
      ${S.isOwner ? recordersSection() : ""}
      ${S.canEdit ? `<div class="sec"><label>이 폰의 예전 기록 올리기</label><button class="btn block" data-act="upload">이 폰에 저장된 기록을 서버로 합치기</button></div>` : ""}
      <div class="sec"><label>그룹 ID</label><code>${esc(groupId())}</code></div>
      <button class="btn danger block" data-act="disconnect">서버 연결 해제 (이 폰만)</button>${backup}`), (S.ui.settingsOpen = true);
  }

  openModal(`<h2>설정${closeBtn}</h2>
    <div class="sec"><label>친구들과 실시간 공유 (Firebase)</label>
      <p class="hint" style="margin:0 0 8px">Firebase 콘솔의 웹 앱 설정(<code>firebaseConfig</code>)을 통째로 붙여넣으세요.</p>
      <textarea class="in" id="cfg" rows="7" placeholder='const firebaseConfig = { apiKey: "...", projectId: "...", ... };'>${esc(c ? JSON.stringify(c.config, null, 2) : "")}</textarea>
      <label class="lb" style="display:block;margin:10px 0 6px">그룹 ID (모임 이름, 영문)</label><input class="in" id="gid" value="${esc(c?.gid || GROUP_ID)}">
      <button class="btn pri block" style="margin-top:10px" data-act="connect">연결하기</button></div>${backup}`);
}

/* ---------- 카톡 캡처 이름 인식 결과 ---------- */
export function openOcr() {
  const o = S.ui.ocr;
  let body;
  if (o.error) {
    body = `<div class="empty">${esc(o.error)}</div><button class="btn block" data-act="ocr">다시 시도</button>`;
  } else if (o.busy) {
    body = `<div class="empty" style="padding:28px 0"><div style="font-size:28px">🔍</div>
      <b>이름 읽는 중… <span id="ocrpct">${Math.round((o.progress || 0) * 100)}%</span></b>
      <p class="hint">처음 한 번은 한글 인식 데이터를 받느라 10초쯤 걸려요.</p></div>`;
  } else {
    const rows = o.rows
      .map((r, i) => {
        const tag = ocrTag(r, i);
        const fixed = r.raw && r.raw !== r.name ? `<div style="font-size:11.5px;color:var(--sub);margin-top:2px">인식: ${esc(r.raw)} → 바로잡음</div>` : "";
        return `<div class="ocr-row ${r.on ? "" : "off"}">
          <button class="ocr-ck ${r.on ? "on" : ""}" data-act="ocrtoggle" data-v="${i}">${r.on ? "✓" : ""}</button>
          <div style="flex:1;min-width:0"><input class="in" data-ocr-i="${i}" value="${esc(r.name)}" placeholder="이름">${fixed}</div>
          ${tag}</div>`;
      })
      .join("");
    const n = o.rows.filter((r) => r.on && r.name.trim()).length;
    body = o.rows.length
      ? `<p class="hint" style="margin:0 0 10px">잘못 읽힌 이름은 눌러서 고치고, 빼고 싶은 사람은 체크를 끄세요.</p>${rows}`
      : `<div class="empty">이름을 찾지 못했어요. 투표자 목록이 잘 보이게 다시 캡처해 보세요.</div>`;
    body += `<div class="grid2" style="margin-top:12px"><button class="btn" data-act="ocradd">+ 이름 직접 추가</button><button class="btn" data-act="ocr">사진 다시 고르기</button></div>
      <button class="btn pri block" style="margin-top:8px" id="ocrapply" data-act="ocrapply" ${n ? "" : "disabled"}>${n}명 ${o.target === "roster" ? "고정 참여 명단에 추가" : "참가자로 추가"}</button>`;
  }
  openModal(`<h2>📷 ${o.target === "roster" ? "캡처로 고정 명단 만들기" : "카톡 투표 캡처"}${closeBtn}</h2>${body}`);
}

export function ocrTag(r, i) {
  if (!r.name) return `<span class="badge" id="ocrtag-${i}" style="visibility:hidden">새 선수</span>`;
  return r.existingId && P(r.existingId)
    ? `<span class="badge" id="ocrtag-${i}">기존 선수</span>`
    : `<span class="badge" id="ocrtag-${i}" style="background:#fff1d6;color:#8a5a00">새 선수</span>`;
}
export function updateOcrCount() {
  const b = document.getElementById("ocrapply");
  if (!b) return;
  const n = S.ui.ocr.rows.filter((r) => r.on && r.name.trim()).length;
  b.disabled = !n;
  b.textContent = `${n}명 ${S.ui.ocr.target === "roster" ? "고정 참여 명단에 추가" : "참가자로 추가"}`;
}

function accountSection() {
  if (!S.user) {
    return `<div class="sec"><label>기록자 로그인</label>
      <button class="btn block ghost" data-act="googlelogin" style="gap:8px"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>구글로 로그인</button>
      <p class="hint">관리자가 내 이메일을 기록자로 추가해 두면, 로그인만 하면 바로 입력할 수 있어요.</p>
</div>`;
  }
  const email = esc(S.user.email || "");
  let status;
  if (!S.recordersLoaded) status = `<p class="hint">권한 확인 중…</p>`;
  else if (S.isOwner) status = `<p class="hint">👑 관리자예요. 아래에서 기록자를 관리하세요.</p>`;
  else if (S.canEdit) status = `<p class="hint">✏️ 기록자예요. 기록을 입력할 수 있어요.</p>`;
  else if (!S.recorders && !S.recordersDenied)
    status = `<p class="hint">아직 관리자가 없어요. firestore.rules에 적은 관리자 이메일이라면 아래 버튼을 누르세요.</p>
      <button class="btn pri block" data-act="claimowner">👑 이 계정을 관리자로 등록</button>`;
  else if (S.myRequest)
    status = `<div class="reqbox"><b>⏳ 기록자 신청 완료</b><span>관리자가 승인하면 바로 입력할 수 있어요.</span>
      <button class="btn sm ghost" data-act="reqcancel">신청 취소</button></div>`;
  else
    status = `<p class="hint">👀 보기 전용이에요. 기록을 입력하고 싶으면 신청하세요. 관리자가 승인하면 바로 입력할 수 있어요.</p>
      <button class="btn pri block" data-act="reqsend">✋ 기록자 신청하기</button>`;
  return `<div class="sec"><label>내 계정 <span class="badge">${email}</span></label>${status}
    <button class="btn block" style="margin-top:8px" data-act="logout">로그아웃</button></div>`;
}

/** "skawlgus6216@gmail.com" → "ska***16@gmail.com" */
export function maskEmail(e = "") {
  const [id, domain] = e.split("@");
  if (!domain) return e;
  const shown = id.length <= 4 ? id.slice(0, 1) + "***" : id.slice(0, 3) + "***" + id.slice(-2);
  return `${shown}@${domain}`;
}

function recordersSection() {
  const list = S.recorders?.emails || [];
  const reqs = S.requests || [];
  const open = S.ui.recordersOpen || reqs.length ? "open" : "";
  const reqHtml = reqs.length
    ? `<div class="reqlist"><div class="reqtitle">✋ 기록자 신청 ${reqs.length}건</div>${reqs
        .map((r) => `<div class="reqrow"><div style="min-width:0"><b>${esc(r.name || "(이름 없음)")}</b><small>${esc(r.email)}</small></div>
          <button class="btn sm pri" data-act="reqok" data-v="${esc(r.uid)}">승인</button><button class="btn sm ghost" data-act="reqno" data-v="${esc(r.uid)}">거절</button></div>`)
        .join("")}</div>`
    : "";
  return `<div class="sec"><details class="recbox" ${open} data-act-toggle="recordersOpen">
    <summary><span>✏️ 기록자 <b>${list.length + 1}명</b> · 관리${reqs.length ? ` <span class="reqdot">신청 ${reqs.length}</span>` : ""}</span><span class="chev">›</span></summary>
    ${reqHtml}
    <div class="reclist">
      <div class="recrow"><span>👑 ${esc(maskEmail(S.recorders.owner))}</span><span class="rectag">관리자</span></div>
      ${list.map((e) => `<div class="recrow"><span title="${esc(e)}">${esc(maskEmail(e))}</span><button class="recdel" data-act="recdel" data-v="${esc(e)}" aria-label="삭제">×</button></div>`).join("")}
    </div>
    <form class="row" data-act="recadd" style="margin-top:10px"><input class="in" name="n" type="email" placeholder="이메일로 직접 추가"><button class="btn pri">추가</button></form>
    <p class="hint">친구가 앱에서 구글로 로그인한 뒤 <b>기록자 신청</b>을 누르면 여기에 떠요.</p>
  </details></div>`;
}

/* ---------- 고정 참여 명단 ---------- */
export function openRoster() {
  const all = Object.values(S.players).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const regs = all.filter((p) => p.regular);
  const others = all.filter((p) => !p.regular);
  const ed = S.canEdit;
  openModal(`<h2>⭐ 고정 참여 명단 <span class="badge">${regs.length}명</span>${closeBtn}</h2>
    <p class="hint" style="margin:0 0 12px">매주 오는 사람을 넣어 두면 라인업 탭에서 <b>고정 참여 모두 추가</b> 한 번으로 참가자가 채워져요.</p>
    ${ed ? `<form class="row" data-act="rosteradd"><input class="in" name="n" placeholder="이름 (여러 명은 쉼표로)" autocomplete="off"><button class="btn pri">추가</button></form>
      <button class="btn kakao block" style="margin-top:8px" data-act="ocr" data-v="roster">📷 카톡 캡처로 명단 만들기</button>` : ""}
    <div class="sec" style="margin-top:14px"><label>고정 참여 ${regs.length}명${ed ? " · 눌러서 빼기" : ""}</label>
      ${regs.length ? `<div class="chips">${regs.map((p) => `<button class="chip sel" data-act="rostertoggle" data-v="${p.id}" ${ed ? "" : "disabled"}>⭐ ${esc(p.name)}${ed ? `<span class="x">×</span>` : ""}</button>`).join("")}</div>`
        : `<div class="empty">아직 비어 있어요. 이름을 넣거나 카톡 캡처로 만들어 보세요.</div>`}</div>
    ${others.length ? `<div class="sec"><label>다른 선수${ed ? " · 눌러서 고정 참여로" : ""}</label>
      <div class="chips">${others.map((p) => `<button class="chip ghost" data-act="rostertoggle" data-v="${p.id}" ${ed ? "" : "disabled"}>+ ${esc(p.name)}</button>`).join("")}</div></div>` : ""}
    <button class="btn block" data-act="close">완료</button>`);
}

/* ---------- 포지션 고르기 ---------- */
export function openPosPicker(slotIdx) {
  const s = currentSlots()[slotIdx];
  const pid = lineup().teams[S.ui.team].slots[slotIdx];
  const group = (role, title) =>
    `<div class="sec"><label>${title}</label><div class="posgrid">${POSITION_GROUPS[role]
      .map((l) => `<button class="pg ${role} ${l === s.label ? "on" : ""}" data-act="posset" data-v="${slotIdx}:${l}">${l}</button>`)
      .join("")}</div></div>`;
  openModal(`<h2>${pid ? esc(pname(pid)) + " · " : ""}포지션${closeBtn}</h2>
    ${group("FW", "공격")}${group("MF", "미드필더")}${group("DF", "수비")}${group("GK", "골키퍼")}
    ${s.moved ? `<button class="btn block" data-act="posreset" data-v="${slotIdx}">포메이션 원래 자리로</button>` : ""}`);
}
