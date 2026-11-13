// 라인업 로직: 선수 이동/교체, 자동 배치, 밸런스 팀 나누기
import { S, P, lineup } from "./state.js";
import { formationSlots, roleOfLabel } from "./formations.js";
import { fit } from "./players.js";
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
      free.sort((a, b) => fit(pid, slots[b].role) - fit(pid, slots[a].role));
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
  const T = lineup().teams[teamIdx];
  const slots = currentSlots(teamIdx);
  T.slots = {};
  T.bench = [];
  const pairs = [];
  pids.forEach((p) => slots.forEach((s, i) => pairs.push({ p, i, v: fit(p, s.role) + Math.random() * 0.3 })));
  pairs.sort((a, b) => b.v - a.v);
  const used = new Set();
  for (const x of pairs) {
    if (used.has(x.p) || T.slots[x.i]) continue;
    T.slots[x.i] = x.p;
    used.add(x.p);
  }
  pids.forEach((p) => !used.has(p) && T.bench.push(p));
}

/** 인원·포메이션이 바뀌면 각 팀 선수를 새 자리에 다시 배치 */
export function relayoutAll() {
  lineup().teams.forEach((T, i) => {
    T.layout = {}; // 포메이션이 바뀌면 직접 옮긴 자리는 초기화
    autoPlace(i, teamPlayers(T).filter(P));
  });
}

/**
 * 실력(★)과 선호 포지션을 고려해 참가자 전원을 팀 수만큼 나눠요.
 * 1) 골키퍼가 주 포지션인 사람은 팀마다 한 명씩
 * 2) 나머지는 실력 높은 순으로, 인원이 적은 팀 → 같은 포지션이 적은 팀 → 실력 합이 낮은 팀에 배정
 * 매번 약간의 무작위를 섞어 누를 때마다 조합이 달라져요.
 */
export function balanceSplit() {
  const l = lineup();
  const n = l.teams.length;
  const all = l.attendees.filter((id) => P(id));
  if (!all.length) return false;

  const skill = (id) => P(id).skill || 3;
  const jitter = (id) => skill(id) + Math.random() * 0.8;
  const primary = (id) => (P(id).pos || [])[0] || "X";
  const buckets = Array.from({ length: n }, () => ({ ids: [], sum: 0, roles: {} }));
  const add = (b, id) => {
    b.ids.push(id);
    b.sum += skill(id);
    b.roles[primary(id)] = (b.roles[primary(id)] || 0) + 1;
  };

  const used = new Set();
  shuffle(all.filter((id) => primary(id) === "GK"))
    .sort((a, b) => jitter(b) - jitter(a))
    .slice(0, n)
    .forEach((id, i) => {
      add(buckets[i], id);
      used.add(id);
    });

  all
    .filter((id) => !used.has(id))
    .map((id) => ({ id, s: jitter(id) }))
    .sort((a, b) => b.s - a.s)
    .forEach(({ id }) => {
      const minCount = Math.min(...buckets.map((b) => b.ids.length));
      const role = primary(id);
      const best = buckets
        .filter((b) => b.ids.length === minCount)
        .sort((a, b) => (a.roles[role] || 0) - (b.roles[role] || 0) || a.sum - b.sum)[0];
      add(best, id);
    });

  buckets.forEach((b, i) => autoPlace(i, shuffle(b.ids)));
  return true;
}

/** 대기 명단 선수로 지금 보는 팀의 빈자리 채우기 */
export function fillEmpty(teamIdx) {
  const T = lineup().teams[teamIdx];
  const slots = currentSlots(teamIdx);
  const pool = shuffle(poolList());
  if (!pool.length) return false;
  const free = slots.map((_, i) => i).filter((i) => !T.slots[i]);
  const pairs = [];
  pool.forEach((p) => free.forEach((i) => pairs.push({ p, i, v: fit(p, slots[i].role) + Math.random() * 0.3 })));
  pairs.sort((a, b) => b.v - a.v);
  const used = new Set();
  for (const x of pairs) {
    if (used.has(x.p) || T.slots[x.i]) continue;
    T.slots[x.i] = x.p;
    used.add(x.p);
  }
  return true;
}
