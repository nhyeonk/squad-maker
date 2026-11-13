// 선수 추가·찾기·이름 붙여넣기 처리
import { S } from "./state.js";
import { api } from "./store.js";
import { uid } from "./utils.js";

export const findByName = (name) => Object.values(S.players).find((p) => p.name === name.trim());

/** 이름으로 선수를 찾고, 없으면 새로 만들어요 (같은 이름 = 같은 선수) */
export function ensurePlayer(name) {
  name = name.trim().slice(0, 20);
  if (!name) return null;
  let p = findByName(name);
  if (!p) {
    p = { id: uid(), name, pos: [], skill: 3, createdAt: Date.now() };
    api.putPlayer(p);
  }
  return p;
}

/** "김민수, 이준호" / 여러 줄 / 카톡 투표 결과 붙여넣기 → 이름 목록 */
export function parseNames(text) {
  return text
    .split(/[\n,，、·\/]+|\s{2,}|\t/)
    .flatMap((s) => {
      s = s
        .replace(/^\s*\d+[.)]\s*/, "")
        .replace(/[✔✅☑⭕🙋👍\-*•\u{FE0F}\u{200D}\u{2642}\u{2640}]/gu, "")
        .replace(/\(.*?\)/g, "")
        .trim();
      if (!s) return [];
      const parts = s.split(/\s+/);
      // "김민수 이준호" 처럼 공백 하나로 붙은 한글 이름들
      if (parts.length > 1 && parts.every((x) => /^[가-힣]{2,4}$/.test(x))) return parts;
      return [s];
    })
    .filter((s) => s.length && s.length <= 20);
}

/** 선호 포지션이 해당 자리와 얼마나 맞는지 (팀 배치 점수) */
export function fit(pid, role) {
  const p = S.players[pid];
  if (!p) return 0;
  const pos = p.pos || [];
  const i = pos.indexOf(role);
  if (i === 0) return 4;
  if (i === 1) return 2.5;
  if (i >= 2) return 1.2;
  if (role === "GK") return pos.length ? -3 : -1; // 골키퍼는 원하는 사람 우선
  return pos.length ? 0 : 0.5;
}
