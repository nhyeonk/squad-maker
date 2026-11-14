// 여러 화면에서 쓰는 작은 조각들
import { P } from "../state.js";
import { TIERS, playerTier } from "../players.js";
import { esc } from "../utils.js";

export function tierBadge(pid) {
  const tier = playerTier(P(pid));
  return tier ? `<span class="tier-badge tier-${tier}" title="${tier} 티어">${tier}</span>` : "";
}

export function tierSelect(p, source, id) {
  const current = playerTier(p);
  return `<select class="in tier-select" ${id ? `id="${id}"` : ""} data-chg="ptier" data-pid="${esc(p.id)}" data-source="${source}" aria-label="${esc(p.name)} 티어">
    <option value="">미지정</option>${TIERS.map((tier) => `<option value="${tier}" ${tier === current ? "selected" : ""}>${tier}</option>`).join("")}
  </select>`;
}

/** 선수의 첫 번째 선호 포지션 배지 */
export const posBadge = (pid) => {
  const r = (P(pid)?.pos || [])[0];
  return `<span class="pb ${r || "none"}">${r || "?"}</span>`;
};

export const dot = (color) => `<span class="dot" style="background:${color}"></span>`;
