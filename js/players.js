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

/* ---------- 비슷한 이름 찾기 (사진 인식 오타 바로잡기) ---------- */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

/** "박하늘" → "ㅂㅏㄱㅎㅏㄴㅡㄹ" (자모 단위로 비교하면 한 획 틀린 글자도 가깝게 나와요) */
function jamo(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) {
      out += ch;
      continue;
    }
    out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + (JONG[c % 28] === " " ? "" : JONG[c % 28]);
  }
  return out;
}

function editDistance(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** 이름이 같거나 아주 비슷한 기존 선수 (없으면 null) */
export function similarPlayer(name) {
  const exact = findByName(name);
  if (exact) return exact;
  const a = jamo(name);
  let best = null, bestD = Infinity;
  for (const p of Object.values(S.players)) {
    if (p.name.length !== name.length) continue; // 글자 수가 같은 이름끼리만
    const d = editDistance(a, jamo(p.name));
    if (d < bestD) [best, bestD] = [p, d];
  }
  // 자모 2개까지 틀린 건 같은 사람으로 봐요 (예: 방하능 ↔ 박하늘)
  return best && bestD <= Math.max(2, Math.floor(a.length * 0.25)) ? best : null;
}
