// 경기 기록 탭 화면 (목록 + 상세)
import { S, pname } from "../state.js";
import { scoreOf } from "../stats.js";
import { esc, fmtDate } from "../utils.js";
import { dot } from "./common.js";

const statusChip = (m) => `<span class="status ${m.status === "done" ? "done" : ""}">${m.status === "done" ? "종료" : "진행 중"}</span>`;

function scorersText(m, ti) {
  const count = {};
  (m.goals || [])
    .filter((g) => g.team === ti)
    .forEach((g) => {
      const k = g.og ? (g.scorer ? pname(g.scorer) + "(자책)" : "자책골") : g.scorer ? pname(g.scorer) : "모름";
      count[k] = (count[k] || 0) + 1;
    });
  return Object.entries(count)
    .map(([k, v]) => (v > 1 ? `${esc(k)} ${v}` : esc(k)))
    .join(", ");
}

export function viewMatchList() {
  const ms = Object.values(S.matches).sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0)
  );
  const cards = ms
    .map((m) => {
      const sc = scoreOf(m);
      return `<button class="mcard" data-act="openmatch" data-v="${m.id}">
        <div class="mt">${fmtDate(m.date)}${m.title ? ` · ${esc(m.title)}` : ""}${m.referee ? ` · 심판 ${esc(m.referee)}` : ""}<span style="flex:1"></span>${statusChip(m)}</div>
        <div class="ms"><span style="display:flex;align-items:center;gap:6px">${dot(m.teams[0].color)}${esc(m.teams[0].name)}</span>
          <span class="n">${sc[0]} : ${sc[1]}</span>
          <span style="display:flex;align-items:center;gap:6px;justify-content:flex-end">${esc(m.teams[1].name)}${dot(m.teams[1].color)}</span></div>
        <div class="scr"><span>${scorersText(m, 0)}</span><span style="text-align:right">${scorersText(m, 1)}</span></div>
        ${(m.laundry || []).length ? `<div class="mt" style="margin-top:6px">🧺 ${m.laundry.map((id) => esc(pname(id))).join(", ")}</div>` : ""}</button>`;
    })
    .join("");
  return `<div class="row" style="margin-bottom:12px"><h3 style="margin:0;flex:1;display:flex;gap:7px;align-items:center">경기 기록 <span class="badge">${ms.length}경기</span></h3>
      <button class="btn pri sm" data-act="newmatch" data-edit>+ 새 경기</button></div>
    ${ms.length ? `<div class="mlist">${cards}</div>` : `<div class="card empty">아직 경기가 없어요. 라인업 탭에서 팀을 짠 뒤 <b>경기 기록 시작</b>을 누르세요.</div>`}`;
}

export function viewMatch(m) {
  const sc = scoreOf(m);
  const ed = S.canEdit;
  const dis = ed ? "" : "disabled";
  const goals = (m.goals || []).slice().sort((a, b) => (a.t || 0) - (b.t || 0));

  let a = 0, b = 0;
  const goalRows = goals
    .map((g) => {
      g.team === 0 ? a++ : b++;
      const who = g.og ? `${g.scorer ? esc(pname(g.scorer)) : ""} 자책골` : g.scorer ? esc(pname(g.scorer)) : "득점자 모름";
      return `<div class="g"><span class="gs">${a}:${b}</span>${dot(m.teams[g.team].color)}
        <span class="gn">${who}${g.assist ? `<small>도움 ${esc(pname(g.assist))}</small>` : ""}</span>
        ${ed ? `<button style="font-size:20px;color:var(--mute);padding:0 6px" data-act="delgoal" data-v="${g.id}">×</button>` : ""}</div>`;
    })
    .join("");

  const side = (ti) => {
    const T = m.teams[ti];
    return `<div><div class="tn">${ti ? esc(T.name) + dot(T.color) : dot(T.color) + esc(T.name)}</div><div class="sc">${sc[ti]}</div>
      ${ed ? `<button class="btn pri" data-act="goal" data-v="${ti}">+ 골</button>` : ""}</div>`;
  };

  const roster = (T, ti) => `<div>
    <div class="row" style="margin-bottom:8px;font-weight:800">${dot(T.color)}${esc(T.name)} <span class="badge">${(T.players || []).length}명</span></div>
    <div class="chips">${(T.players || [])
      .map((pid) => {
        const r = T.roles?.[pid];
        return `<span class="chip">${esc(pname(pid))}${r && r !== "SUB" ? ` <span class="pb ${r}">${r}</span>` : ""}${ed ? `<button class="x" data-act="mrmplayer" data-v="${ti}:${pid}">×</button>` : ""}</span>`;
      })
      .join("")}
    ${ed ? `<button class="chip add" data-act="maddplayer" data-v="${ti}">+ 추가</button>` : ""}</div></div>`;

  return `<div class="row" style="margin-bottom:12px;flex-wrap:wrap">
      <button class="btn sm" data-act="backlist">← 목록</button>
      <input class="in" type="date" style="width:auto" value="${esc(m.date)}" data-chg="m.date" ${dis}>
      <input class="in" style="flex:1;min-width:120px" value="${esc(m.title || "")}" placeholder="경기 이름 (예: 1경기)" data-chg="m.title" ${dis}>
      <label class="lb">심판</label><input class="in" style="width:110px" value="${esc(m.referee || "")}" placeholder="이름" data-chg="m.referee" ${dis}>
    </div>
    <div class="card"><div class="score">${side(0)}<div>${statusChip(m)}</div>${side(1)}</div></div>
    <div class="card"><h3>득점 기록 <span class="badge">${goals.length}골</span></h3>
      ${goals.length ? `<div class="glist">${goalRows}</div>` : `<div class="empty">아직 골이 없어요.</div>`}</div>
    <div class="card"><h3>출전 선수</h3><div class="grid2" style="gap:14px">${roster(m.teams[0], 0)}${roster(m.teams[1], 1)}</div>
      <p class="hint" data-edit>교체로 뛴 사람은 "+ 추가"로 넣어야 출전 기록에 잡혀요.</p></div>
    <div class="card lcard"><div class="row"><div style="flex:1"><b>🧺 빨래 당번</b>
        <div class="hint" style="margin-top:4px">${(m.laundry || []).length ? m.laundry.map((id) => `<b style="color:var(--ink)">${esc(pname(id))}</b>`).join(", ") : "진 팀에서 룰렛이나 사다리로 뽑아요."}</div></div>
      <button class="btn" data-act="laundry" data-v="${m.id}">${(m.laundry || []).length ? "다시 뽑기" : "뽑기"}</button></div></div>
    <div class="row" data-edit>
      ${m.status === "done"
        ? `<button class="btn" data-act="mstatus" data-v="live">다시 진행 중으로</button>`
        : `<button class="btn dark" data-act="mstatus" data-v="done">경기 종료</button>`}
      <button class="btn danger" data-act="delmatch">경기 삭제</button></div>`;
}
