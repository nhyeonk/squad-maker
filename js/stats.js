// 경기 기록 → 선수별 통계
import { S, P } from "./state.js";

export const scoreOf = (m) => {
  const s = [0, 0];
  (m.goals || []).forEach((g) => s[g.team]++);
  return s;
};

function inPeriod(m, period) {
  if (period === "all") return true;
  const d = new Date(m.date + "T00:00:00");
  const now = new Date();
  if (period === "year") return d.getFullYear() === now.getFullYear();
  if (period === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

/** 승/무/패는 '종료'된 경기만 계산해요 */
export function computeStats(period = "all") {
  const st = {};
  const g = (id) => (st[id] ||= { id, apps: 0, w: 0, d: 0, l: 0, goals: 0, ast: 0, og: 0, roles: {} });
  Object.values(S.players).forEach((p) => g(p.id));

  const ms = Object.values(S.matches).filter((m) => inPeriod(m, period));
  ms.forEach((m) => {
    const sc = scoreOf(m);
    m.teams.forEach((T, ti) =>
      (T.players || []).forEach((pid) => {
        const s = g(pid);
        s.apps++;
        const r = T.roles?.[pid];
        if (r && r !== "SUB") s.roles[r] = (s.roles[r] || 0) + 1;
        if (m.status === "done") {
          const [a, b] = [sc[ti], sc[1 - ti]];
          if (a > b) s.w++;
          else if (a < b) s.l++;
          else s.d++;
        }
      })
    );
    (m.goals || []).forEach((x) => {
      if (x.og) {
        if (x.scorer) g(x.scorer).og++;
        return;
      }
      if (x.scorer) g(x.scorer).goals++;
      if (x.assist) g(x.assist).ast++;
    });
  });
  return { st, games: ms.length, goals: ms.reduce((a, m) => a + (m.goals || []).length, 0) };
}

/** 추천 포지션: 실제 경기에서 가장 많이 뛴 자리 → 없으면 첫 번째 선호 포지션 */
export function recommendedPos(pid, s) {
  const top = Object.entries(s?.roles || {}).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : (P(pid)?.pos || [])[0] || null;
}

/** 선수별 참가 횟수 (경기한 날짜 수) */
export function attendanceCounts() {
  const days = {};
  Object.values(S.matches).forEach((m) =>
    m.teams.forEach((T) => (T.players || []).forEach((pid) => (days[pid] ||= new Set()).add(m.date)))
  );
  const out = {};
  for (const k in days) out[k] = days[k].size;
  return out;
}
