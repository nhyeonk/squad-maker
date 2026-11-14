// 경기 만들기·수정 로직
import { S, P, lineup } from "./state.js";
import { api } from "./store.js";
import { currentSlots, teamPlayers } from "./lineup.js";
import { uid, todayStr } from "./utils.js";

/* ---------- 경기 이름: "26.11.14 일패운동장" ---------- */
/** 오늘 날짜를 "26.11.14" 형식으로 */
export const shortDate = (iso = todayStr()) => iso.slice(2).replace(/-/g, ".");

/** 경기 이름 앞의 "26.11.14"를 경기 날짜로 써요 (날짜를 고쳐 쓰면 경기 날짜도 같이 바뀌어요) */
export function dateFromTitle(title) {
  const m = String(title).trim().match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})(?:\s|$)/);
  if (!m) return null;
  const iso = `20${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return isNaN(new Date(iso + "T00:00:00")) ? null : iso;
}

/** 최근에 쓴 장소들 (경기 이름에서 날짜 뒤 부분), 최근 순 */
export function recentPlaces(limit = 5) {
  const out = [];
  Object.values(S.matches)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((m) => {
      const place = String(m.title || "").replace(/^\d{2}\.\d{1,2}\.\d{1,2}\s*/, "").trim();
      if (place && !/^\d+경기$/.test(place) && !out.includes(place)) out.push(place);
    });
  return out.slice(0, limit);
}

/** 경기 시작 창에 미리 넣을 이름: 오늘 날짜 + 띄어쓰기 (장소는 직접 써요) */
export const defaultMatchTitle = () => `${shortDate()} `;

/** 라인업의 두 팀으로 경기 생성. 자리(포지션)도 함께 저장해 추천 포지션 계산에 써요 */
export function createMatchFromLineup(teamA, teamB, title) {
  const l = lineup();
  const snap = (i) => {
    const T = l.teams[i];
    const slots = currentSlots(i);
    const roles = {};
    const labels = {};
    Object.entries(T.slots).forEach(([k, pid]) => {
      if (!P(pid)) return;
      roles[pid] = slots[k]?.role || "MF";
      labels[pid] = slots[k]?.label || roles[pid];
    });
    T.bench.filter(P).forEach((pid) => (roles[pid] = "SUB"));
    return { name: T.name, color: T.color, players: teamPlayers(T).filter(P), roles, labels };
  };
  const m = {
    id: uid(), date: dateFromTitle(title) || todayStr(), title: title || "", referee: l.referee || "",
    size: l.size, formation: l.formation, status: "live", createdAt: Date.now(),
    teams: [snap(teamA), snap(teamB)], goals: [],
  };
  api.putMatch(m);
  return m;
}

/** 라인업 없이 빈 경기 */
export function createBlankMatch() {
  const l = lineup();
  const m = {
    id: uid(), date: todayStr(), title: defaultMatchTitle().trim(), referee: "", status: "live", createdAt: Date.now(), goals: [],
    teams: [0, 1].map((i) => ({ name: l.teams[i].name, color: l.teams[i].color, players: [], roles: {} })),
  };
  api.putMatch(m);
  return m;
}

const cur = () => S.matches[S.ui.matchId];

export function addGoal(d) {
  const m = cur();
  m.goals = [...(m.goals || []), { id: uid(), team: d.team, scorer: d.scorer, assist: d.og ? null : d.assist, og: d.og, t: Date.now() }];
  api.putMatch(m);
}
export function removeGoal(id) {
  const m = cur();
  m.goals = m.goals.filter((g) => g.id !== id);
  api.putMatch(m);
}
export function addToMatch(ti, pid) {
  const T = cur().teams[ti];
  if (!T.players.includes(pid)) {
    T.players.push(pid);
    T.roles = T.roles || {};
    T.roles[pid] = "SUB";
  }
  api.putMatch(cur());
}
export function removeFromMatch(ti, pid) {
  const T = cur().teams[ti];
  T.players = T.players.filter((x) => x !== pid);
  if (T.roles) delete T.roles[pid];
  api.putMatch(cur());
}
export function updateMatchField(field, value) {
  cur()[field] = value;
  // 이름 앞 날짜를 고치면 경기 날짜도 맞춰요
  if (field === "title" && dateFromTitle(value)) cur().date = dateFromTitle(value);
  api.putMatch(cur());
}
