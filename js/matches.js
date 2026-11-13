// 경기 만들기·수정 로직
import { S, P, lineup } from "./state.js";
import { api } from "./store.js";
import { currentSlots, teamPlayers } from "./lineup.js";
import { uid, todayStr } from "./utils.js";

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
    id: uid(), date: todayStr(), title: title || "", referee: l.referee || "",
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
    id: uid(), date: todayStr(), title: "", referee: "", status: "live", createdAt: Date.now(), goals: [],
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
  api.putMatch(cur());
}
