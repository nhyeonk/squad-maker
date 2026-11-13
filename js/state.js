// 앱 전체 상태 (한 곳에서 관리)
import { uid } from "./utils.js";

export const TEAM_COLORS = [
  { c: "#e5484d", n: "A팀" },
  { c: "#3e63dd", n: "B팀" },
  { c: "#f59e0b", n: "C팀" },
  { c: "#30a46c", n: "D팀" },
  { c: "#8e4ec6", n: "E팀" },
  { c: "#5b5b57", n: "F팀" },
];

/**
 * 데이터 구조
 * players: { [id]: { id, name, pos: ["MF","FW"] (선호 순서), skill: 1~5, regular: 고정 참여 여부, createdAt } }
 * matches: { [id]: { id, date, title, referee, size, formation, status: "live"|"done",
 *                    teams: [{ name, color, players: [id], roles: { [id]: "GK"|"DF"|"MF"|"FW"|"SUB" } } x2],
 *                    goals: [{ id, team: 0|1, scorer, assist, og, t }], createdAt, updatedAt } }
 * lineup:  { size, formation, referee, attendees: [id],
 *            teams: [{ id, name, color, slots: { [slotIndex]: playerId }, bench: [id] }] }
 */
export const S = {
  players: {},
  matches: {},
  lineup: null,
  ui: { tab: "lineup", team: 0, sel: null, matchId: null, sort: "goals", period: "all" },
  mode: "local", // "local" | "remote"
  canEdit: true,
  user: null,
  recorders: null, // { owner, emails[] } (Firebase 모드)
  isOwner: false,
  ready: false,
};

export function mkTeam(i) {
  const t = TEAM_COLORS[i % TEAM_COLORS.length];
  return { id: uid(), name: t.n, color: t.c, slots: {}, bench: [] };
}

export function defaultLineup() {
  return { size: 11, formation: "4-4-2", referee: "", attendees: [], teams: [mkTeam(0), mkTeam(1)] };
}

/** 현재 라인업 (없으면 새로 만들어요) */
export function lineup() {
  if (!S.lineup) S.lineup = defaultLineup();
  return S.lineup;
}

export const P = (id) => S.players[id];
export const pname = (id) => P(id)?.name || "(삭제됨)";

/** 화면 다시 그리기 훅 (main.js에서 연결) */
export const hooks = { render: () => {}, scheduleRender: () => {} };
