// 여러 화면에서 쓰는 작은 조각들
import { P } from "../state.js";

/** 선수의 첫 번째 선호 포지션 배지 */
export const posBadge = (pid) => {
  const r = (P(pid)?.pos || [])[0];
  return `<span class="pb ${r || "none"}">${r || "?"}</span>`;
};

export const dot = (color) => `<span class="dot" style="background:${color}"></span>`;
