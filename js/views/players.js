// 선수 기록 탭 화면 (순위표)
import { S, P, pname } from "../state.js";
import { computeStats, recommendedPos } from "../stats.js";
import { POS_KO } from "../formations.js";
import { TIERS, playerTier } from "../players.js";
import { playerName, prefList, tierBadge, tierSelect } from "./common.js";

const SORTS = [
  ["goals", "득점"],
  ["ast", "도움"],
  ["ap", "공격P"],
  ["apps", "출전"],
  ["rate", "승률"],
  ["tier", "티어"],
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
  tier: (s) => TIERS[playerTier(P(s.id))]?.weight ?? 0,
};

function tierTable(filter) {
  const tiers = [...Object.keys(TIERS), ""];
  const counts = Object.fromEntries(tiers.map((tier) => [tier, 0]));
  for (const p of Object.values(S.players)) counts[playerTier(p)]++;
  const buttons = tiers.map((tier) => `<button type="button" data-act="tierfilter" data-v="${tier}" aria-pressed="${filter === tier}">
      ${tierBadge(tier) || `<span class="tier-unset">미지정</span>`}<span>${counts[tier]}명</span>
    </button>`).join("");
  return `<section class="card tier-table" aria-labelledby="tier-table-title">
    <div class="row"><h3 id="tier-table-title">티어 표</h3><button type="button" class="btn sm ghost" data-act="tierfilter" data-v="all" aria-pressed="${filter === "all"}">전체 보기</button></div>
    <div class="tier-table-grid">${buttons}</div>
  </section>`;
}

export function viewPlayers() {
  const { st, games, goals } = computeStats(S.ui.period);
  const key = S.ui.sort;
  const val = sortValue[key];
  const bulk = S.ui.bulk && S.canEdit;
  const filter = bulk ? "all" : S.ui.tierFilter;
  const rows = Object.values(st)
    .filter((s) => P(s.id) && (filter === "all" || playerTier(P(s.id)) === filter))
    .sort((a, b) => val(b) - val(a) || b.goals - a.goals || b.ast - a.ast || pname(a.id).localeCompare(pname(b.id), "ko"));

  const hl = (k, v) => (key === k && v ? "hl" : "");
  const picked = new Set(S.ui.bulkSel || []);
  const tr = rows
    .map((s, i) => {
      const rp = recommendedPos(s.id, s);
      const dec = s.w + s.d + s.l;
      const pl = P(s.id);
      // 선호: 영역을 전부 고르면 FW·MF·DF로 묶고, 일부만 고르면 세부 포지션(ST, CM…)
      const prefs = prefList(pl).map(([t, r]) => `<span class="pb ${r}" style="margin:0 1px">${t}</span>`).join("");
      const first = bulk ? `<span class="ck ${picked.has(s.id) ? "on" : ""}">${picked.has(s.id) ? "✓" : ""}</span>` : i + 1; // 지금 정렬 순서대로 1번부터
      const tier = S.canEdit && !bulk ? tierSelect(pl) : tierBadge(playerTier(pl)) || `<span class="tier-unset">미지정</span>`;
      return `<tr class="click ${bulk && picked.has(s.id) ? "picked" : ""}" data-act="${bulk ? "bulktoggle" : "info"}" data-v="${s.id}">
        <td>${first}</td><td class="nm">${playerName(s.id)}</td>
        <td>${tier}</td>
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
    ${bulk ? "" : tierTable(filter)}
    <div class="row" style="flex-wrap:wrap;margin-bottom:10px">${seg(SORTS, key, "sort")}${seg(PERIODS, S.ui.period, "period")}<span style="flex:1"></span>
      ${bulk ? "" : `<button class="btn sm" data-act="bulkstart" data-admin>여러 명 삭제</button><button class="btn sm pri" data-act="newplayer" data-edit>+ 선수 추가</button>`}</div>
    ${bulk ? `<div class="bulkbar"><span><b>${picked.size}명</b> 선택</span><span class="sp"></span>
      <button class="btn sm ghost" data-act="bulkall">${picked.size === rows.length ? "선택 해제" : "전체 선택"}</button>
      <button class="btn sm ghost" data-act="bulkcancel">취소</button>
      <button class="btn sm red" data-act="bulkdelete" ${picked.size ? "" : "disabled"}>${picked.size}명 삭제</button></div>` : ""}
    ${rows.length
      ? `<div class="tbw"><table class="tb"><thead><tr><th>No</th><th>이름</th><th>티어</th><th>추천 포지션</th><th>선호</th><th>경기</th><th>승-무-패</th><th>승률</th><th>골</th><th>도움</th><th>공격P</th></tr></thead><tbody>${tr}</tbody></table></div>`
      : `<div class="card empty">${filter === "all" ? "아직 선수가 없어요." : "이 티어에 해당하는 선수가 없어요."}</div>`}
    <p class="hint">${S.canEdit ? "티어 칸에서 선수의 티어를 바로 지정할 수 있어요. " : ""}이름을 누르면 선호 포지션과 경기별 기록을 볼 수 있어요. 승패는 '종료'된 경기만 계산해요.</p>`;
}
