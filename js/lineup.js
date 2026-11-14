// 라인업 로직: 선수 이동/교체, 자동 배치, 밸런스 팀 나누기
import { S, P, lineup } from "./state.js";
import { formationSlots, roleOfLabel } from "./formations.js";
import { balanceSkill, fit, playerTier } from "./players.js";
import { shuffle } from "./utils.js";

/**
 * 팀의 자리 목록 = 포메이션 기본 자리 + 그 팀에서 직접 옮기거나 이름을 바꾼 자리(T.layout)
 * T.layout = { [자리번호]: { x, y, label } }
 */
export const currentSlots = (teamIdx = S.ui.team) => {
  const l = lineup();
  const base = formationSlots(l.size, l.formation);
  const lay = l.teams[teamIdx]?.layout || {};
  return base.map((s, i) => {
    const o = lay[i];
    if (!o) return s;
    const label = o.label || s.label;
    return { ...s, ...o, label, role: roleOfLabel(label), moved: true };
  });
};

/** 자리 위치/이름 바꾸기 */
export function setSlotLayout(teamIdx, slotIdx, patch) {
  const T = lineup().teams[teamIdx];
  T.layout = T.layout || {};
  T.layout[slotIdx] = { ...(T.layout[slotIdx] || {}), ...patch };
}
export function resetSlotLayout(teamIdx, slotIdx) {
  const T = lineup().teams[teamIdx];
  if (T.layout) delete T.layout[slotIdx];
}
export const teamPlayers = (T) => [...Object.values(T.slots), ...T.bench];
export const poolList = () => lineup().attendees.filter((id) => P(id) && locate(id)?.kind === "pool");

/** 선수가 지금 어디 있는지: 자리 / 후보 / 대기 명단 */
export function locate(pid) {
  const l = lineup();
  for (let t = 0; t < l.teams.length; t++) {
    const T = l.teams[t];
    for (const k in T.slots) if (T.slots[k] === pid) return { kind: "slot", team: t, slot: +k };
    const i = T.bench.indexOf(pid);
    if (i >= 0) return { kind: "bench", team: t, i };
  }
  if (l.attendees.includes(pid)) return { kind: "pool" };
  return null;
}

export function removeFrom(loc, pid) {
  if (!loc || loc.kind === "pool") return;
  const T = lineup().teams[loc.team];
  if (loc.kind === "slot") delete T.slots[loc.slot];
  else T.bench = T.bench.filter((x) => x !== pid);
}

function placeAt(loc, pid) {
  const T = lineup().teams[loc.team];
  if (loc.kind === "slot") T.slots[loc.slot] = pid;
  else if (loc.kind === "bench") T.bench.splice(Math.min(loc.i ?? Infinity, T.bench.length), 0, pid);
}

/**
 * 선수 이동. 목적지에 다른 선수가 있으면 서로 자리를 바꿔요.
 * dest: {kind:"slot",team,slot} | {kind:"bench",team} | {kind:"pool"}
 *     | {kind:"team",team}  (그 팀의 알맞은 빈자리, 없으면 후보)
 *     | {kind:"player",pid} (그 선수와 맞교환 — 다른 팀이면 팀이 바뀜)
 */
export function movePlayer(pid, dest) {
  const l = lineup();
  if (!l.attendees.includes(pid)) l.attendees.push(pid);
  const from = locate(pid);

  if (dest.kind === "pool") return removeFrom(from, pid);

  if (dest.kind === "team") {
    removeFrom(from, pid);
    const T = l.teams[dest.team];
    const slots = currentSlots(dest.team);
    const free = slots.map((_, i) => i).filter((i) => !T.slots[i]);
    if (free.length) {
      free.sort((a, b) => fit(pid, slots[b].role, slots[b].label) - fit(pid, slots[a].role, slots[a].label));
      T.slots[free[0]] = pid;
    } else T.bench.push(pid);
    return;
  }

  let other = null;
  if (dest.kind === "slot") other = l.teams[dest.team].slots[dest.slot] || null;
  if (dest.kind === "player") {
    other = dest.pid;
    dest = locate(other);
    if (!dest) return;
  }
  if (other === pid) return;

  removeFrom(from, pid);
  if (other) {
    removeFrom(dest, other);
    if (from && from.kind !== "pool") placeAt(from, other);
    // 대기 명단에서 온 선수와 바꾸면, 원래 선수는 대기 명단으로 가요
  }
  placeAt(dest, pid);
}

/** 선호 포지션에 맞게 팀 안에서 자리 배치 (남는 인원은 후보) */
export function autoPlace(teamIdx, pids) {
  Object.assign(lineup().teams[teamIdx], placePlayers(currentSlots(teamIdx), pids));
}

function placePlayers(slots, pids, keeper) {
  const assigned = {};
  if (keeper) assigned[keeper.slot] = keeper.id;
  const used = new Set(Object.values(assigned));
  const pairs = [];
  pids.forEach((p) => slots.forEach((s, i) => pairs.push({ p, i, v: fit(p, s.role, s.label) + Math.random() * 0.3 })));
  pairs.sort((a, b) => b.v - a.v);
  for (const x of pairs) {
    if (used.has(x.p) || assigned[x.i]) continue;
    assigned[x.i] = x.p;
    used.add(x.p);
  }
  return { slots: assigned, bench: pids.filter((p) => !used.has(p)) };
}

/** 인원·포메이션이 바뀌면 각 팀 선수를 새 자리에 다시 배치 */
export function relayoutAll() {
  lineup().teams.forEach((T, i) => {
    T.layout = {}; // 포메이션이 바뀌면 직접 옮긴 자리는 초기화
    autoPlace(i, teamPlayers(T).filter(P));
  });
}

/**
 * 현재 라인업을 변경하지 않고 팀 배정안을 계산해요.
 * 고정 선수와 골키퍼를 먼저 넣은 뒤 인원, 점수, 티어와 포지션을 비교해요.
 */
export function previewBalance(locks = new Map()) {
  const l = lineup();
  const all = [...new Set(l.attendees)].filter(P);
  if (all.length < 2) return { error: "참가자를 두 명 이상 추가하세요" };
  const primary = (id) => (P(id).pos || [])[0] || "X";
  const buckets = l.teams.map((team, index) => ({
    index, ids: [], sum: 0, roles: {}, tiers: {}, keeper: null, slots: currentSlots(index), team,
  }));
  const add = (b, id) => {
    const role = primary(id);
    const tier = playerTier(P(id));
    b.ids.push(id);
    b.sum += balanceSkill(id);
    b.roles[role] = (b.roles[role] || 0) + 1;
    b.tiers[tier] = (b.tiers[tier] || 0) + 1;
  };
  const reserveKeeper = (b, id, slot) => {
    b.keeper = { id, slot };
    add(b, id);
  };
  for (const id of all) {
    const lock = locks.get(id);
    if (!lock) continue;
    const b = buckets[lock.team];
    if (!b) return { error: "고정한 팀이 바뀌었어요. 배정을 다시 열어 주세요." };
    if (!lock.keeper) {
      add(b, id);
      continue;
    }
    const slot = b.slots.findIndex((s) => s.role === "GK");
    if (slot < 0) return { error: `${b.team.name}에 골키퍼 자리가 없어요.` };
    if (b.keeper) return { error: `${b.team.name}의 골키퍼는 한 명만 고정할 수 있어요.` };
    reserveKeeper(b, id, slot);
  }
  const pending = shuffle(all.filter((id) => !locks.has(id))).sort((a, b) => balanceSkill(b) - balanceSkill(a));
  const available = shuffle([...buckets]).sort((a, b) => a.ids.length - b.ids.length);
  for (const b of available) {
    const slot = b.slots.findIndex((s) => s.role === "GK");
    if (slot < 0 || b.keeper) continue;
    const own = b.ids.find((id) => primary(id) === "GK");
    const next = pending.findIndex((id) => primary(id) === "GK");
    if (own) b.keeper = { id: own, slot };
    else if (next !== -1 && b.ids.length < b.slots.length) reserveKeeper(b, pending.splice(next, 1)[0], slot);
  }
  for (const id of pending) {
    const role = primary(id);
    const tier = playerTier(P(id));
    const eligible = available.filter((b) => b.ids.length < b.slots.length);
    const sorted = (eligible.length ? eligible : [...available]).sort((a, b) =>
      a.ids.length - b.ids.length || a.sum - b.sum ||
      (a.tiers[tier] || 0) - (b.tiers[tier] || 0) || (a.roles[role] || 0) - (b.roles[role] || 0));
    add(sorted[0], id);
  }
  return { teams: buckets.map((b) => ({ ...b.team, ...placePlayers(b.slots, b.ids, b.keeper) })) };
}

/** 대기 명단 선수로 지금 보는 팀의 빈자리 채우기 */
export function fillEmpty(teamIdx) {
  const T = lineup().teams[teamIdx];
  const slots = currentSlots(teamIdx);
  const pool = shuffle(poolList());
  if (!pool.length) return false;
  const free = slots.map((_, i) => i).filter((i) => !T.slots[i]);
  const pairs = [];
  pool.forEach((p) => free.forEach((i) => pairs.push({ p, i, v: fit(p, slots[i].role, slots[i].label) + Math.random() * 0.3 })));
  pairs.sort((a, b) => b.v - a.v);
  const used = new Set();
  for (const x of pairs) {
    if (used.has(x.p) || T.slots[x.i]) continue;
    T.slots[x.i] = x.p;
    used.add(x.p);
  }
  return true;
}
