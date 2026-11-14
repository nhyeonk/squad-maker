// 라인업 탭 화면
import { S, P, pname, lineup } from "../state.js";
import { FORMATIONS, FUTSAL_MAX } from "../formations.js";
import { currentSlots, teamPlayers, poolList, locate } from "../lineup.js";
import { esc } from "../utils.js";
import { attendanceCounts, computeStats } from "../stats.js";
import { balanceSkill } from "../players.js";
import { posBadge, dot, tierBadge } from "./common.js";

const isSel = (pid) => S.ui.sel === pid;

function pitchLines(futsal) {
  const L = (style) => `<div class="ln" style="${style}"></div>`;
  return futsal
    ? L("left:4%;right:4%;top:3%;bottom:3%") +
        L("left:4%;right:4%;top:50%;height:0;border-width:2px 0 0") +
        L("left:50%;top:50%;width:26%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%)") +
        `<div class="spot"></div>` +
        L("left:22%;right:22%;top:3%;height:13%;border-top:0;border-radius:0 0 50% 50%") +
        L("left:22%;right:22%;bottom:3%;height:13%;border-bottom:0;border-radius:50% 50% 0 0")
    : L("left:3%;right:3%;top:2%;bottom:2%") +
        L("left:3%;right:3%;top:50%;height:0;border-width:2px 0 0") +
        L("left:50%;top:50%;width:26%;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%)") +
        `<div class="spot"></div>` +
        L("left:20%;right:20%;top:2%;height:16%;border-top:0") +
        L("left:36%;right:36%;top:2%;height:6%;border-top:0") +
        L("left:20%;right:20%;bottom:2%;height:16%;border-bottom:0") +
        L("left:36%;right:36%;bottom:2%;height:6%;border-bottom:0");
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
        style="left:${s.x}%;top:${s.y}%;--tc:${T.color}" data-act="slot" data-v="${i}" data-drag="${i}">
        <span class="cir role-${s.role}">${p ? `<span class="rl">${esc(s.label)}</span>${tierBadge(pid)}${n ? `<span class="nb">${n}</span>` : ""}` : esc(s.label)}</span>
        ${p ? `<span class="nm">${esc(p.name)}</span>` : ""}</button>`;
    })
    .join("");
  const futsal = l.size <= FUTSAL_MAX;
  return `<div class="pitch ${futsal ? "futsal" : ""} ${sel && S.canEdit ? "picking" : ""}" id="pitch" data-act="pitch">
    <span class="tag">${esc(T.name)} · ${l.size}인 ${esc(l.formation)}</span>${pitchLines(futsal)}${slotHtml}</div>`;
}

function side(l, T) {
  const bench = T.bench
    .filter(P)
    .map((pid) => `<button class="bchip ${isSel(pid) ? "sel" : ""}" data-act="pl" data-v="${pid}" data-pdrag="${pid}">${tierBadge(pid)} ${esc(pname(pid))}</button>`)
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
  const notHere = Object.values(S.players).filter((p) => !l.attendees.includes(p.id));
  const regulars = notHere.filter((p) => p.regular).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const others = notHere
    .filter((p) => !p.regular)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name, "ko"));
  const chip = (p) =>
    `<button class="chip ghost" data-act="attend" data-v="${p.id}">+ ${esc(p.name)}${counts[p.id] ? ` <span style="font-size:11px;color:var(--mute)">${counts[p.id]}</span>` : ""}</button>`;
  const hasRegular = Object.values(S.players).some((p) => p.regular);

  return `<div class="card" data-edit>
    <h3>오늘 참가자 <span class="badge">${l.attendees.filter(P).length}명</span></h3>
    ${regulars.length ? `<button class="btn pri block" data-act="attendregulars">⭐ 고정 참여 모두 추가 (${regulars.length}명)</button>
      <div class="chips" style="margin:8px 0 4px">${regulars.map(chip).join("")}</div>` : ""}
    ${others.length ? `<details class="others" ${regulars.length ? "" : "open"}><summary>${hasRegular ? "그 외 멤버" : "지난 참가자"} ${others.length}명 · 많이 온 순</summary>
      <div class="chips" style="margin-top:6px">${others.map(chip).join("")}</div></details>` : ""}
    ${!hasRegular && Object.keys(S.players).length ? `<p class="hint">매주 오는 사람은 아래 <b>⭐ 고정 참여 명단</b>에 넣어 두면 한 번에 추가할 수 있어요.</p>` : ""}
    <div style="border-top:1px solid var(--soft);margin:12px 0;"></div>
    <form class="row" data-act="addnames"><input class="in" name="n" placeholder="새 이름 입력 (여러 명은 쉼표로)" autocomplete="off"><button class="btn pri">추가</button></form>
    <button class="btn kakao block" style="margin-top:8px" data-act="ocr">📷 카톡 투표 캡처로 추가</button>
    <button class="btn ghost block" style="margin-top:8px" data-act="roster">⭐ 고정 참여 명단 ${Object.values(S.players).filter((p) => p.regular).length ? `<span class="badge">${Object.values(S.players).filter((p) => p.regular).length}명</span>` : "만들기"}</button>
    <p class="hint">같은 이름은 같은 선수로 기록이 이어져요.</p>
  </div>`;
}

function poolCard(l) {
  const pool = poolList();
  return `<div class="card" data-drop="pool">
    <h3>대기 명단 <span class="badge">${pool.length}명</span></h3>
    ${pool.length
      ? `<div class="chips">${pool.map((id) => `<button class="chip ${isSel(id) ? "sel" : ""}" data-act="pl" data-v="${id}" data-pdrag="${id}">${tierBadge(id)}${posBadge(id)} ${esc(pname(id))}<span class="x" data-act="unattend" data-v="${id}" data-edit>×</span></button>`).join("")}</div>`
      : `<div class="empty">${l.attendees.length ? "모두 팀에 배치됐어요." : "먼저 위에서 참가자 이름을 추가하세요."}</div>`}
    <div class="grid2" style="margin-top:12px" data-edit>
      <button class="btn pri" data-act="split">⚖️ 티어 균형 배정</button>
      <button class="btn" data-act="fill">빈자리 채우기</button>
      <button class="btn" data-act="clearteam">이 팀 비우기</button>
      <button class="btn" data-act="resetall">전체 초기화</button>
    </div>
    <p class="hint" data-edit>선수를 <b>끌어서</b> 경기장·후보·팀 명단으로 옮길 수 있어요. 폰에서는 살짝 길게 눌렀다가 끌어요.</p>
  </div>`;
}

function teamsCard(l, t, slots) {
  const sel = S.ui.sel;
  const selLoc = sel && locate(sel);
  const cards = l.teams
    .map((x, i) => {
      const ids = teamPlayers(x).filter(P);
      const canDrop = sel && selLoc && !(selLoc.kind !== "pool" && selLoc.team === i);
      const avg = ids.length ? (ids.reduce((a, id) => a + balanceSkill(id), 0) / ids.length).toFixed(1) : "-";
      const action = canDrop
        ? `<button class="btn sm pri" data-act="toteam" data-v="${i}">여기로 이동</button>`
        : i === t
          ? `<span style="font-size:12px;color:var(--sub)">보는 중</span>`
          : `<button class="btn sm ghost" data-act="team" data-v="${i}">보기 →</button>`;
      const chips = ids.length
        ? ids
            .map((id) => {
              const lc = locate(id);
              const role = lc?.kind === "slot" ? currentSlots(i)[lc.slot]?.label : "후보";
              return `<button class="chip ${isSel(id) ? "sel" : ""}" data-act="pl" data-v="${id}" data-pdrag="${id}">${tierBadge(id)}${esc(pname(id))} <span style="font-size:10.5px;color:var(--sub)">${esc(role)}</span></button>`;
            })
            .join("")
        : `<span class="hint" style="margin:0">아직 배치된 선수가 없어요.</span>`;
      return `<div class="tcard ${i === t ? "on" : ""} ${canDrop ? "drop" : ""}" data-drop="team:${i}">
        <div class="th">${dot(x.color)}${esc(x.name)} <span class="badge">${ids.length}명</span>
          <span style="font-size:11.5px;color:var(--sub);font-weight:600">평균 ${avg}점</span><span class="sp"></span>${action}</div>
        <div class="chips">${chips}</div></div>`;
    })
    .join("");
  return `<div class="card">
    <h3>팀 명단</h3>
    <div class="row" data-edit><input class="in" data-chg="teamname" value="${esc(l.teams[t].name)}" placeholder="팀 이름"></div>
    <div class="grid2" style="margin-top:8px" data-edit><button class="btn" data-act="addteam">+ 팀 추가</button>
      <button class="btn danger" data-act="delteam" ${l.teams.length <= 2 ? "disabled" : ""}>이 팀 삭제</button></div>
    ${cards}
    <p class="hint" data-edit>팀을 나눈 뒤에도 선수를 누르고 <b>여기로 이동</b>을 누르거나, 다른 팀 선수를 눌러 서로 맞바꿀 수 있어요. 풋살 밀어내기는 팀을 3개 이상 만들어 보세요.</p>
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
    .map((x, i) => `<button class="${i === t ? "on" : ""}" data-act="team" data-v="${i}">${dot(x.color)}${esc(x.name)} <small>${Object.keys(x.slots).length}/${slots.length}</small></button>`)
    .join("");
  const sizes = Object.keys(FORMATIONS).map(Number);

  return `<div class="layout">
  <section class="card" style="padding:12px">
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
    <p class="hint" data-edit>선수를 <b>끌어서</b> 원하는 곳에 놓으면 자리가 옮겨지고, 다른 선수 위에 놓으면 서로 바뀌어요. 경기장 밖 <b>대기 명단·후보·팀 명단</b>으로 끌어내도 돼요. 눌러서 선택한 뒤 빈 잔디를 눌러도 돼요. 포지션 이름은 위치에 맞게 바뀌고, 아래 바의 <b>포지션</b>으로 직접 고를 수도 있어요.</p>
    <div style="display:grid;gap:8px;margin-top:12px">
      <div class="grid2"><button class="btn" data-act="img">🖼️ 스쿼드 이미지 저장</button><button class="btn" data-act="copytext">📋 명단 텍스트 복사</button></div>
      <button class="btn pri block" data-act="startmatch" data-edit>⚽ 이 라인업으로 경기 기록 시작</button>
    </div>
  </section>
  <aside>${attendeesCard(l)}${poolCard(l)}${teamsCard(l, t, slots)}</aside>
  </div>`;
}

/** 선수를 골랐을 때 화면 아래에 뜨는 바 */
export function viewSelbar() {
  const sel = S.ui.sel;
  if (!sel || S.ui.tab !== "lineup" || !P(sel)) return "";
  const loc = locate(sel);
  const onPitch = loc?.kind === "slot" && loc.team === S.ui.team;
  const label = onPitch ? currentSlots()[loc.slot]?.label : "";
  return `<div class="selbar"><span><b>${esc(pname(sel))}</b> ${onPitch ? esc(label) : "선택됨"}</span>
    ${onPitch && S.canEdit ? `<button class="btn sm" data-act="posopen" data-v="${loc.slot}">포지션</button>` : ""}
    <button class="btn sm" data-act="info" data-v="${sel}">정보</button>
    ${loc?.kind !== "pool" ? `<button class="btn sm" data-act="topool">대기로</button>` : ""}
    <button class="btn sm" data-act="unsel">취소</button></div>`;
}
