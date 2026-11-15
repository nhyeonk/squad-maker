// 라인업 탭 화면
import { S, P, lineup, MIN_LINEUP_TEAMS, MAX_LINEUP_TEAMS } from "../state.js";
import { FORMATIONS, FUTSAL_MAX } from "../formations.js";
import { currentSlots, teamPlayers, poolList, locate } from "../lineup.js";
import { TIERS, matchesPlayerName, playerTier } from "../players.js";
import { pitchPosition, PITCH_ZONES } from "../pitch-zones.js";
import { esc } from "../utils.js";
import { attendanceCounts, computeStats } from "../stats.js";
import { posBadge, dot, playerName } from "./common.js";

const isSel = (pid) => S.ui.sel === pid;

function pitchLines(futsal) {
  const points = (pairs) => pairs.map(([u, v]) => {
    const { x, y } = pitchPosition(u, v);
    return `${x.toFixed(3)},${y.toFixed(3)}`;
  }).join(" ");
  const line = (pairs) => `<polyline class="pitch-mark" points="${points(pairs)}"/>`;
  const arc = (cx, cy, rx, ry, start, end) => Array.from({ length: 25 }, (_, i) => {
    const angle = start + (end - start) * i / 24;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
  const center = pitchPosition(50, 50);
  const areas = futsal
    ? line(arc(50, 2, 28, 14, 0, Math.PI)) + line(arc(50, 98, 28, 14, Math.PI, Math.PI * 2))
    : line([[20, 2], [20, 18], [80, 18], [80, 2]]) + line([[36, 2], [36, 8], [64, 8], [64, 2]]) +
      line([[20, 98], [20, 82], [80, 82], [80, 98]]) + line([[36, 98], [36, 92], [64, 92], [64, 98]]);
  return `<svg class="pitch-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs><pattern id="pitch-grass" width="100" height="14" patternUnits="userSpaceOnUse" y="12">
      <rect class="pitch-grass-a" width="100" height="7"/><rect class="pitch-grass-b" y="7" width="100" height="7"/>
    </pattern></defs>
    <polygon points="${points([[0, 0], [100, 0], [100, 100], [0, 100]])}" fill="url(#pitch-grass)"/>
    ${line([[4, 2], [96, 2], [96, 98], [4, 98], [4, 2]])}${line([[4, 50], [96, 50]])}
    ${line(arc(50, 50, 13, 9, 0, Math.PI * 2))}${areas}
    <ellipse class="pitch-spot" cx="${center.x}" cy="${center.y}" rx=".5" ry=".35"/>
    <polygon class="pitch-goalkeeper-area" points="${PITCH_ZONES.GK.points}"/>
  </svg>`;
}

/** 동그라미 오른쪽 위 숫자: 출전 / 골 / 공격포인트 / 끄기 */
export const BADGES = [
  ["apps", "출전"],
  ["goals", "골"],
  ["ap", "공격P"],
  ["none", "숫자 끄기"],
];
function badgeValue(st, pid) {
  const s = st[pid];
  if (!s) return 0;
  return { apps: s.apps, goals: s.goals, ap: s.goals + s.ast }[S.ui.badge] || 0;
}

function pitch(l, T, slots) {
  const sel = S.ui.sel;
  const st = S.ui.badge === "none" ? {} : computeStats().st;
  const slotHtml = slots
    .map((s, i) => {
      const pid = T.slots[i];
      const p = pid && P(pid);
      const n = p ? badgeValue(st, pid) : 0;
      return `<button class="slot ${p ? "filled" : ""} ${p && isSel(pid) ? "sel" : ""} ${sel && !p ? "target" : ""}"
        style="--slot-x:${s.x}%;--slot-y:${s.y}%;--tc:${T.color}" data-act="slot" data-v="${i}" data-drag="${i}">
        <span class="cir role-${s.role}">${p ? `<span class="rl">${esc(s.label)}</span>${n ? `<span class="nb">${n}</span>` : ""}` : esc(s.label)}</span>
        ${p ? `<span class="nm">${playerName(pid)}</span>` : ""}</button>`;
    })
    .join("");
  const futsal = l.size <= FUTSAL_MAX;
  return `<div class="pitch ${futsal ? "futsal" : ""} ${sel && S.canEdit ? "picking" : ""}" id="pitch" data-act="pitch">
    <span class="tag">${esc(T.name)} · ${l.size}인 ${esc(l.formation)}</span>${pitchLines(futsal)}
    <svg class="pitch-zones" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" hidden><polygon data-position-zone=""/></svg>
    ${slotHtml}</div>`;
}

function side(l, T) {
  const bench = T.bench
    .filter(P)
    .map((pid) => `<button class="bchip ${isSel(pid) ? "sel" : ""}" data-act="pl" data-v="${pid}" data-pdrag="${pid}">${playerName(pid)}</button>`)
    .join("");
  return `<div class="side">
    <div class="sidebox"><b><span class="pb GK">심</span>심판</b><div style="font-size:11px;opacity:.7;margin-bottom:5px">모든 팀 공통</div>
      <input data-chg="referee" value="${esc(l.referee || "")}" placeholder="이름" ${S.canEdit ? "" : "disabled"}></div>
    <div class="sidebox" data-drop="bench"><b>후보 <span style="opacity:.6">${T.bench.length}</span></b>${bench}
      ${S.canEdit ? `<button class="drop" data-act="tobench">${S.ui.sel ? "여기로 ↓" : "+ 후보"}</button>` : ""}</div>
  </div>`;
}

function attendeesCard(l) {
  const counts = attendanceCounts();
  const players = Object.values(S.players);
  const query = S.ui.lineupMemberQuery || "";
  const attendeeIds = new Set(l.attendees.filter(P));
  const notHere = players.filter((p) => !attendeeIds.has(p.id));
  const regulars = notHere.filter((p) => p.regular).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const others = notHere
    .filter((p) => !p.regular)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name, "ko"));
  const chip = (p) =>
    `<button class="chip ghost" data-act="attend" data-v="${esc(p.id)}">+ ${playerName(p.id)}${counts[p.id] ? ` <span style="font-size:11px;color:var(--mute)">${counts[p.id]}</span>` : ""}</button>`;
  return `<section class="card lineup-setup">
    <h3>오늘 참가자 <span class="badge">${attendeeIds.size}명</span></h3>
    <form class="row" data-act="addnames"><input class="in" name="n" aria-label="참가자 이름" placeholder="이름 입력 (여러 명은 쉼표로)" autocomplete="off"><button class="btn ghost">추가</button></form>
    <div class="lineup-quick-actions">
      <button class="btn kakao sm" data-act="ocr">📷 카톡 투표 캡처</button>
      ${regulars.length ? `<button class="btn ghost sm" data-act="attendregulars">⭐ 고정 ${regulars.length}명 추가</button>` : ""}
    </div>
    <details class="others lineup-members" data-act-toggle="lineupMembersOpen" ${S.ui.lineupMembersOpen ? "open" : ""}>
      <summary>기존 선수에서 추가 <span>${notHere.length}명</span></summary>
      ${notHere.length ? `<input class="in lineup-member-search" type="search" data-lineup-member-search aria-label="기존 선수 검색" aria-controls="lineup-member-results" aria-describedby="lineup-member-search-hint" placeholder="선수 검색" value="${esc(query)}" autocomplete="off">
      <p class="hint" id="lineup-member-search-hint"${query.trim() ? " hidden" : ""}>초성으로도 검색할 수 있어요. 김민수 → <strong>ㄱㅁㅅ</strong></p>
      <div id="lineup-member-results">
      ${regulars.length ? `<div class="lineup-member-group"><strong>고정 참여</strong><div class="chips">${regulars.map(chip).join("")}</div></div>` : ""}
      ${others.length ? `<div class="lineup-member-group"><strong>지난 참가자 · 많이 온 순</strong><div class="chips">${others.map(chip).join("")}</div></div>` : ""}
      <p class="hint" data-lineup-no-results role="status" hidden>검색 결과가 없어요.</p></div>`
      : `<p class="hint">${players.length ? "등록된 선수는 모두 참가자에 들어 있어요." : "아직 등록된 선수가 없어요."}</p>`}
      <button class="btn ghost sm" data-act="roster">고정 참여 명단 관리</button>
    </details>
    <button class="btn pri block lineup-split" data-act="split" ${attendeeIds.size ? "" : "disabled"}>⚖️ ${l.teams.length}팀 밸런스 나누기</button>
  </section>`;
}

/** 검색하는 동안 입력창을 유지하고 안내와 결과만 갱신해요. */
export function filterLineupMembers(search) {
  const panel = search.closest("details");
  const query = search.value.trim();
  panel.querySelector("#lineup-member-search-hint").hidden = Boolean(query);
  const results = panel.querySelector("#lineup-member-results");
  let hasMatch = false;
  for (const group of results.querySelectorAll(".lineup-member-group")) {
    let groupHasMatch = false;
    for (const chip of group.querySelectorAll('[data-act="attend"]')) {
      chip.hidden = !matchesPlayerName(P(chip.dataset.v)?.name || "", query);
      groupHasMatch ||= !chip.hidden;
    }
    group.hidden = !groupHasMatch;
    hasMatch ||= groupHasMatch;
  }
  results.querySelector("[data-lineup-no-results]").hidden = hasMatch;
}

function poolCard(l) {
  const pool = poolList();
  return `<div class="card" data-drop="pool">
    <h3>대기 명단 <span class="badge">${pool.length}명</span></h3>
    ${pool.length
      ? `<div class="chips">${pool.map((id) => `<button class="chip ${isSel(id) ? "sel" : ""}" data-act="pl" data-v="${id}" data-pdrag="${id}">${posBadge(id)} ${playerName(id)}<span class="x" data-act="unattend" data-v="${id}" data-edit>×</span></button>`).join("")}</div>`
      : `<div class="empty">${l.attendees.length ? "모두 팀에 배치됐어요." : "먼저 위에서 참가자 이름을 추가하세요."}</div>`}
    <div class="grid2" style="margin-top:12px" data-edit>
      <button class="btn" data-act="fill">빈자리 채우기</button>
      <button class="btn" data-act="clearteam">이 팀 비우기</button>
      <button class="btn" data-act="resetall">전체 초기화</button>
    </div>
    <p class="hint" data-edit>선수를 <b>끌어서</b> 경기장·후보·팀 명단으로 옮길 수 있어요. 폰에서는 살짝 길게 눌렀다가 끌어요. 밸런스 나누기는 <b>티어와 선호 포지션</b>을 고려해요. 티어 미지정 선수는 B와 같은 비중으로 계산해요.</p>
  </div>`;
}

function teamsCard(l, t) {
  const sel = S.ui.sel;
  const selLoc = sel && locate(sel);
  const tierRank = (id) => TIERS[playerTier(P(id))]?.weight ?? 0;
  const cards = l.teams
    .map((x, i) => {
      const ids = teamPlayers(x).filter(P).sort((a, b) => tierRank(b) - tierRank(a));
      const active = i === t;
      const canDrop = sel && selLoc && !(selLoc.kind !== "pool" && selLoc.team === i);
      const action = canDrop
        ? `<button class="btn sm pri" data-act="toteam" data-v="${i}">여기로 이동</button>`
        : "";
      const status = active ? `<span class="team-viewing">보는 중</span>` : "";
      const chips = ids.length
        ? ids
            .map((id) => {
              const lc = locate(id);
              const role = lc?.kind === "slot" ? currentSlots(i)[lc.slot]?.label : "후보";
              return `<button class="chip ${isSel(id) ? "sel" : ""}" data-act="pl" data-v="${id}" data-pdrag="${id}">${playerName(id)} <span style="font-size:10.5px;color:var(--sub)">${esc(role)}</span></button>`;
            })
            .join("")
        : `<span class="hint" style="margin:0">아직 배치된 선수가 없어요.</span>`;
      return `<div class="tcard ${active ? "on" : ""} ${canDrop ? "drop" : ""}" data-drop="team:${i}" data-act="team" data-v="${i}">
        <div class="th">
          <button type="button" class="team-card-title" aria-label="${esc(x.name)} 보기" aria-pressed="${active}">${dot(x.color)}<span class="team-card-name" title="${esc(x.name)}">${esc(x.name)}</span><span class="badge">${ids.length}명</span></button>
          ${status || action ? `<div class="team-card-actions">${status}${action}</div>` : ""}
        </div>
        <div class="chips">${chips}</div></div>`;
    })
    .join("");
  return `<div class="card">
    <h3>팀 명단</h3>
    <div class="row" data-edit><input class="in" data-chg="teamname" value="${esc(l.teams[t].name)}" placeholder="팀 이름" aria-label="현재 팀 이름"></div>
    <div class="grid2" style="margin-top:8px" data-edit>
      <button class="btn" data-act="addteam" ${l.teams.length >= MAX_LINEUP_TEAMS ? "disabled" : ""}>+ 팀 추가</button>
      <button class="btn danger" data-act="delteam" ${l.teams.length <= MIN_LINEUP_TEAMS ? "disabled" : ""}>현재 팀 삭제</button>
    </div>
    ${cards}
    <p class="hint" data-edit>선수를 누르고 <b>여기로 이동</b>을 누르거나, 다른 팀 선수를 눌러 서로 맞바꿀 수 있어요.</p>
  </div>`;
}

export function viewLineup() {
  const l = lineup();
  if (S.ui.team >= l.teams.length) S.ui.team = 0;
  const t = S.ui.team;
  const T = l.teams[t];
  const slots = currentSlots();
  const dis = S.canEdit ? "" : "disabled";

  const tabs = l.teams
    .map((x, i) => {
      const placed = Object.values(x.slots).filter(P).length;
      const total = teamPlayers(x).filter(P).length;
      return `<button class="${i === t ? "on" : ""}" data-act="team" data-v="${i}" aria-pressed="${i === t}">
        <span class="teamtab-title">${dot(x.color)}<span class="team-card-name" title="${esc(x.name)}">${esc(x.name)}</span></span>
        <small>배치 ${placed}/${slots.length} · 총 ${total}명</small></button>`;
    })
    .join("");
  const sizes = Object.keys(FORMATIONS).map(Number);

  return `<div class="layout${S.canEdit ? "" : " lineup-readonly"}">
  ${S.canEdit ? attendeesCard(l) : ""}
  <section class="card lineup-pitch" id="lineup-result" aria-label="경기장">
    <div class="teamtabs">${tabs}</div>
    <div class="ctrls">
      <label class="lb">인원</label>
      <select class="in" data-chg="size" ${dis}>${sizes.map((n) => `<option value="${n}" ${n === l.size ? "selected" : ""}>${n} vs ${n}${n === 5 ? " (풋살)" : ""}</option>`).join("")}</select>
      <label class="lb">포메이션</label>
      <select class="in" data-chg="formation" ${dis}>${FORMATIONS[l.size].map((f) => `<option ${f === l.formation ? "selected" : ""}>${f}</option>`).join("")}</select>
      <select class="in" data-chg="badge" title="동그라미 숫자">${BADGES.map(([k, t]) => `<option value="${k}" ${S.ui.badge === k ? "selected" : ""}>${k === "none" ? t : "숫자: " + t}</option>`).join("")}</select>
      <button class="iconbtn" data-act="autoplace" title="선호 포지션대로 다시 배치" data-edit><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/></svg></button>
    </div>
    <div class="pitchwrap">${pitch(l, T, slots)}${side(l, T)}</div>
    <div class="legend"><span><i style="border-color:var(--fw)"></i>FW</span><span><i style="border-color:var(--mf)"></i>MF</span><span><i style="border-color:var(--df)"></i>DF</span><span><i style="border-color:var(--gk)"></i>GK</span></div>
    <p class="hint" data-edit>선수를 <b>끌면 초록색으로 표시되는 구역</b>이 새 포지션이에요. 그 자리에 선수가 있으면 서로 바뀌어요. 골키퍼 자리는 고정이고, 선수를 선택한 뒤 GK 자리를 눌러 교체할 수 있어요.</p>
    <div style="display:grid;gap:8px;margin-top:12px">
      <div class="grid2"><button class="btn" data-act="img">🖼️ 스쿼드 이미지 저장</button><button class="btn" data-act="copytext">📋 명단 텍스트 복사</button></div>
      <button class="btn block" data-act="laundry">🧺 빨래 당번 뽑기 (룰렛 · 사다리)</button>
      <button class="btn pri block" data-act="startmatch" data-edit>⚽ 이 라인업으로 경기 기록 시작</button>
    </div>
  </section>
  <aside class="lineup-lists">${poolCard(l)}${teamsCard(l, t)}</aside>
  </div>`;
}

/** 선수를 골랐을 때 화면 아래에 뜨는 바 */
export function viewSelbar() {
  const sel = S.ui.sel;
  if (!sel || S.ui.tab !== "lineup" || !P(sel)) return "";
  const loc = locate(sel);
  const onPitch = loc?.kind === "slot" && loc.team === S.ui.team;
  const label = onPitch ? currentSlots()[loc.slot]?.label : "";
  return `<div class="selbar"><span><b>${playerName(sel)}</b> ${onPitch ? esc(label) : "선택됨"}</span>
    ${onPitch && S.canEdit ? `<button class="btn sm" data-act="posopen" data-v="${loc.slot}">포지션</button>` : ""}
    <button class="btn sm" data-act="info" data-v="${sel}">정보</button>
    ${loc?.kind !== "pool" ? `<button class="btn sm" data-act="topool">대기로</button>` : ""}
    <button class="btn sm" data-act="unsel">취소</button></div>`;
}
