// 앱 전체 상태 (한 곳에서 관리)
import { uid } from "./utils.js";

const DEFAULT_TEAMS = [
  { c: "#e5484d", n: "A팀" },
  { c: "#3e63dd", n: "B팀" },
];

/**
 * 데이터 구조
 * players: { [id]: { id, name, pos: ["MF","FW"] (선호 순서), detail: ["CM","ST"] (세부 선호 포지션), tier: "S"|"A"|"B"|"C"|"F"|null, regular: 고정 참여 여부, createdAt } }
 * matches: { [id]: { id, date, title, referee, size, formation, status: "live"|"done",
 *                    teams: [{ name, color, players: [id], roles: { [id]: "GK"|"DF"|"MF"|"FW"|"SUB" } } x2],
 *                    goals: [{ id, team: 0|1, scorer, assist, og, t }], createdAt, updatedAt } }
 * lineup:  { size, formation, referee, attendees: [id],
 *            teams: [{ id, name, color, slots: { [slotIndex]: playerId }, bench: [id] }] x2 }
 */
export const S = {
  players: {},
  matches: {},
  lineup: null,
  ui: {
    tab: "lineup", team: 0, sel: null, matchId: null, sort: "goals", period: "all", tierFilter: "all",
    badge: (() => { try { return localStorage.getItem("squadmaker_badge") || "apps"; } catch { return "apps"; } })(),
  },
  mode: "local", // "local" | "remote"
  canEdit: true,
  user: null,
  roles: null, // { owner, admins[] } (Firebase 모드, 관리자만 읽을 수 있어요)
  rolesLoaded: false,
  isOwner: false, // 👑 최고 관리자
  isAdmin: true, // 🛡️ 관리자 (이 폰에만 저장하는 모드에서는 모두 관리자)
  ready: false,
};

function mkTeam(i) {
  const t = DEFAULT_TEAMS[i];
  return { id: uid(), name: t.n, color: t.c, slots: {}, bench: [] };
}

export function defaultLineup() {
  return { size: 11, formation: "4-4-2", referee: "", attendees: [], teams: [mkTeam(0), mkTeam(1)] };
}

/** 예전에 만든 추가 팀의 선수는 오늘 참가자와 대기 명단에 남겨요. */
export function normalizeLineup(saved) {
  if (!saved) return defaultLineup();
  if (saved.teams?.length === 2) return saved;
  const [first, second, ...extra] = saved.teams || [];
  const attendees = new Set(saved.attendees || []);
  for (const team of extra) {
    for (const id of [...Object.values(team.slots || {}), ...(team.bench || [])]) attendees.add(id);
  }
  return { ...saved, attendees: [...attendees], teams: [first || mkTeam(0), second || mkTeam(1)] };
}

/** 현재 라인업 (없으면 새로 만들어요) */
export function lineup() {
  if (!S.lineup) S.lineup = defaultLineup();
  return S.lineup;
}

export const P = (id) => S.players[id];
export const pname = (id) => P(id)?.name || "(삭제됨)";

/** 선수·경기 데이터가 바뀔 때마다 올라가는 번호 (통계 계산 결과를 재사용할지 판단) */
export const dataVersion = { n: 0 };
export const bumpData = () => dataVersion.n++;

/** 화면 다시 그리기 훅 (main.js에서 연결) */
export const hooks = { render: () => {}, scheduleRender: () => {} };
