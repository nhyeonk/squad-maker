// 여러 화면에서 쓰는 작은 조각들
import { P } from "../state.js";
import { PREF_DETAIL, roleOfLabel } from "../formations.js";

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
