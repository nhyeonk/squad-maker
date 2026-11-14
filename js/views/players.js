// 선수 기록 탭 화면 (순위표)
import { S, P, pname } from "../state.js";
import { computeStats, recommendedPos } from "../stats.js";
import { POS_KO, roleOfLabel } from "../formations.js";
import { esc } from "../utils.js";

const SORTS = [
  ["goals", "득점"],
  ["ast", "도움"],
  ["ap", "공격P"],
  ["apps", "출전"],
  ["rate", "승률"],
  ["skill", "실력"],
];
const PERIODS = [
  ["all", "전체"],
  ["year", "올해"],
  ["month", "이번 달"],
];

const winRate = (s) => {
  const n = s.w + s.d + s.l;
  return n ? s.w / n : -1;
};
const sortValue = {
  goals: (s) => s.goals,
  ast: (s) => s.ast,
  ap: (s) => s.goals + s.ast,
  apps: (s) => s.apps,
  rate: winRate,
  skill: (s) => P(s.id)?.skill ?? 3,
};

/** 별점 표시 (0.5 단위): ★★★½ 3.5 */
function starsHtml(v) {
  let h = "";
  for (let n = 1; n <= 5; n++) h += `<i class="${v >= n ? "f" : v >= n - 0.5 ? "h" : ""}">★</i>`;
  return `<span class="ministars" title="${v}점">${h}<b>${v.toFixed(1)}</b></span>`;
}

export function viewPlayers() {
  const { st, games, goals } = computeStats(S.ui.period);
  const key = S.ui.sort;
  const val = sortValue[key];
  const rows = Object.values(st)
    .filter((s) => P(s.id))
    .sort((a, b) => val(b) - val(a) || b.goals - a.goals || b.ast - a.ast || pname(a.id).localeCompare(pname(b.id), "ko"));

  let rank = 0, prev = null;
  const hl = (k, v) => (key === k && v ? "hl" : "");
  const bulk = S.ui.bulk && S.canEdit;
  const picked = new Set(S.ui.bulkSel || []);
  const tr = rows
    .map((s, i) => {
      const v = val(s);
      if (v !== prev) [rank, prev] = [i + 1, v];
      const rp = recommendedPos(s.id, s);
      const dec = s.w + s.d + s.l;
      const pl = P(s.id);
      // 선호: 세부 포지션(ST, CM…)을 고른 게 있으면 그걸, 없으면 공격/미드/수비/GK
      const prefList = (pl.detail || []).length ? pl.detail.map((d) => [d, roleOfLabel(d)]) : (pl.pos || []).map((r) => [r, r]);
      const prefs = prefList.map(([t, r]) => `<span class="pb ${r}" style="margin:0 1px">${t}</span>`).join("");
      const first = bulk ? `<span class="ck ${picked.has(s.id) ? "on" : ""}">${picked.has(s.id) ? "✓" : ""}</span>` : s.apps ? rank : "";
      return `<tr class="click ${bulk && picked.has(s.id) ? "picked" : ""}" data-act="${bulk ? "bulktoggle" : "info"}" data-v="${s.id}">
        <td>${first}</td><td class="nm">${esc(pname(s.id))}</td>
        <td>${starsHtml(P(s.id).skill ?? 3)}</td>
        <td>${rp ? `<span class="pb ${rp}" style="font-size:11px;padding:2px 7px">${POS_KO[rp]}</span>` : "-"}</td>
        <td>${prefs || `<span style="color:var(--mute)">-</span>`}</td>
        <td>${s.apps || "-"}</td><td>${dec ? `${s.w}-${s.d}-${s.l}` : "-"}</td><td>${dec ? Math.round((s.w / dec) * 100) + "%" : "-"}</td>
        <td class="${hl("goals", s.goals)}">${s.goals || "-"}</td>
        <td class="${hl("ast", s.ast)}">${s.ast || "-"}</td>
        <td class="${hl("ap", s.goals + s.ast)}">${s.goals + s.ast || "-"}</td></tr>`;
    })
    .join("");

  const seg = (list, cur, act) =>
    `<div class="seg">${list.map(([k, l]) => `<button class="${cur === k ? "on" : ""}" data-act="${act}" data-v="${k}">${l}</button>`).join("")}</div>`;

  return `<div class="stats">
      <div class="stat"><b>${games}</b><span>경기</span></div>
      <div class="stat"><b>${goals}</b><span>골</span></div>
      <div class="stat"><b>${Object.keys(S.players).length}</b><span>선수</span></div></div>
    <div class="row" style="flex-wrap:wrap;margin-bottom:10px">${seg(SORTS, key, "sort")}${seg(PERIODS, S.ui.period, "period")}<span style="flex:1"></span>
      ${bulk ? "" : `<button class="btn sm" data-act="bulkstart" data-edit>여러 명 삭제</button><button class="btn sm pri" data-act="newplayer" data-edit>+ 선수 추가</button>`}</div>
    ${bulk ? `<div class="bulkbar"><span><b>${picked.size}명</b> 선택</span><span class="sp"></span>
      <button class="btn sm ghost" data-act="bulkall">${picked.size === rows.length ? "선택 해제" : "전체 선택"}</button>
      <button class="btn sm ghost" data-act="bulkcancel">취소</button>
      <button class="btn sm red" data-act="bulkdelete" ${picked.size ? "" : "disabled"}>${picked.size}명 삭제</button></div>` : ""}
    ${rows.length
      ? `<div class="tbw"><table class="tb"><thead><tr><th>#</th><th>이름</th><th>실력</th><th>추천 포지션</th><th>선호</th><th>경기</th><th>승-무-패</th><th>승률</th><th>골</th><th>도움</th><th>공격P</th></tr></thead><tbody>${tr}</tbody></table></div>`
      : `<div class="card empty">아직 선수가 없어요.</div>`}
    <p class="hint">이름을 누르면 선호 포지션·실력을 바꾸고 경기별 기록을 볼 수 있어요. 추천 포지션은 실제 경기에서 많이 뛴 자리예요. 승패는 '종료'된 경기만 계산해요.</p>`;
}
