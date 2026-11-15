// 여러 화면에서 쓰는 작은 조각들
import { P, pname } from "../state.js";
import { PREF_DETAIL, roleOfLabel } from "../formations.js";
import { TIERS, playerSkill, playerTier } from "../players.js";
import { esc } from "../utils.js";

export function tierBadge(tier) {
  if (!tier) return "";
  const label = `${tier} 티어 (${TIERS[tier].color})`;
  return `<span class="tier tier-${tier.toLowerCase()}" role="img" aria-label="${label}" title="${label}">${tier}</span>`;
}

export const playerName = (pid) =>
  `<span class="player-name">${tierBadge(playerTier(P(pid)))}<span class="player-name-text">${esc(pname(pid))}</span></span>`;

export function tierSelect(p) {
  const current = playerTier(p);
  return `<select class="in tier-select" data-chg="ptier" data-v="${esc(p.id)}" aria-label="${esc(p.name)} 티어">
    <option value="" ${current ? "" : "selected"}>미지정</option>
    ${Object.keys(TIERS).map((tier) => `<option value="${tier}" ${tier === current ? "selected" : ""}>${tier} 티어</option>`).join("")}
  </select>`;
}

const STARS = [1, 2, 3, 4, 5];
const starClass = (skill, star) => skill >= star ? "full" : skill >= star - 0.5 ? "half" : "";

export function skillDisplay(p) {
  const skill = playerSkill(p);
  const stars = STARS.map((n) => `<span class="skill-star ${starClass(skill, n)}">★</span>`).join("");
  return `<span class="skill-display"><span aria-hidden="true">${stars}</span><b>${skill.toFixed(1)}</b></span>`;
}

export function skillEditor(p) {
  const skill = playerSkill(p);
  const id = esc(p.id);
  const stars = STARS.map((n) =>
    `<button type="button" class="skill-star ${starClass(skill, n)}" data-act="pstar" data-v="${id}:${n}" aria-label="별 ${n}">★</button>`
  ).join("");
  return `<button type="button" class="skill-step" data-act="pstep" data-v="${id}:-0.5" aria-label="평점 0.5 내리기" ${skill <= 0 ? "disabled" : ""}>−</button>
    ${stars}
    <button type="button" class="skill-step" data-act="pstep" data-v="${id}:0.5" aria-label="평점 0.5 올리기" ${skill >= 5 ? "disabled" : ""}>+</button>
    <b>${skill.toFixed(1)}</b>`;
}

/** 선수의 첫 번째 선호 포지션 배지 */
export const posBadge = (pid) => {
  const r = (P(pid)?.pos || [])[0];
  return `<span class="pb ${r || "none"}">${r || "?"}</span>`;
};

export const dot = (color) => `<span class="dot" style="background:${color}"></span>`;

/**
 * 선수의 선호 포지션을 보여줄 목록 [[글자, 공격/미드/수비/GK]]
 * 선호 순서대로, 한 영역의 세부 포지션을 전부 골랐거나 하나도 안 골랐으면 영역 이름(FW·MF·DF)으로 묶어요.
 * 예: 공격 1순위(5개 전부) + 미드 2순위(CAM, CM) → FW · CAM · CM
 */
export function prefList(p) {
  const detail = p?.detail || [];
  const out = [];
  (p?.pos || []).forEach((role) => {
    const all = PREF_DETAIL[role] || [];
    const mine = detail.filter((d) => roleOfLabel(d) === role);
    if (!all.length || !mine.length || all.every((d) => mine.includes(d))) out.push([role, role]);
    else mine.forEach((d) => out.push([d, role]));
  });
  return out;
}
