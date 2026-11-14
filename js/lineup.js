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
  const T = lineup().teams[teamIdx];
  const slots = currentSlots(teamIdx);
  T.slots = {};
  T.bench = [];
  const pairs = [];
  pids.forEach((p) => slots.forEach((s, i) => pairs.push({ p, i, v: fit(p, s.role, s.label) + Math.random() * 0.3 })));
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
 * 실력(★, 0.5 단위)과 포지션을 보고 참가자 전원을 팀 수만큼 공정하게 나눠요.
 *
 * 1) 여러 번 무작위로 나눠 본 뒤, 두 팀 사이에서 선수를 맞바꿔 점수가 좋아지는 동안 계속 바꿔요 (언덕 오르기)
 * 2) 점수(낮을수록 공정) = 팀별 별 합계 차이 + 포지션 쏠림(공격/미드/수비/골키퍼) + 골키퍼 몰림
 * 3) 가장 공정한 조합들 중에서 하나를 무작위로 골라, 누를 때마다 조합이 달라져요
 * 인원이 다른 팀(예: 11 vs 10)은 인원 비율만큼 합계를 맞춰요.
 */
export function balanceSplit() {
  const l = lineup();
  const k = l.teams.length;
  const ids = l.attendees.filter((id) => P(id));
  if (!ids.length) return false;

  const sk = ids.map((id) => P(id).skill ?? 3);
  const role = ids.map((id) => (P(id).pos || [])[0] || "X");
  const n = ids.length;
  const total = sk.reduce((a, b) => a + b, 0);
  const sizes = Array.from({ length: k }, (_, t) => Math.floor(n / k) + (t < n % k ? 1 : 0));
  const gkCount = role.filter((r) => r === "GK").length;

  // 배정 → 점수
  const cost = (asg) => {
    const sum = Array(k).fill(0), cnt = Array(k).fill(0), roles = Array.from({ length: k }, () => ({}));
    asg.forEach((t, i) => {
      sum[t] += sk[i];
      cnt[t]++;
      roles[t][role[i]] = (roles[t][role[i]] || 0) + 1;
    });
    let c = 0;
    for (let t = 0; t < k; t++) c += Math.abs(sum[t] - (total * cnt[t]) / n) * 10; // 별 합계 차이 (가장 중요)
    for (const r of ["FW", "MF", "DF"]) {
      const v = roles.map((x) => x[r] || 0);
      c += Math.max(0, Math.max(...v) - Math.min(...v) - 1) * 3; // 같은 포지션이 한 팀에 몰리면 감점
    }
    const g = roles.map((x) => x.GK || 0);
    if (gkCount >= k) c += g.filter((x) => x === 0).length * 8; // 골키퍼가 충분하면 팀마다 한 명씩
    else c += g.filter((x) => x > 1).length * 8; // 부족하면 한 팀에 두 명은 피하기
    return c;
  };

  const randomStart = () => {
    const order = shuffle([...Array(n).keys()]);
    const asg = Array(n);
    let p = 0;
    sizes.forEach((size, t) => {
      for (let j = 0; j < size; j++) asg[order[p++]] = t;
    });
    return asg;
  };

  // 선수 둘을 맞바꿔서 좋아지면 계속
  const improve = (asg) => {
    let best = cost(asg);
    for (let loop = 0; loop < 50; loop++) {
      let gain = 0, bi = -1, bj = -1;
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          if (asg[i] === asg[j]) continue;
          [asg[i], asg[j]] = [asg[j], asg[i]];
          const c = cost(asg);
          [asg[i], asg[j]] = [asg[j], asg[i]];
          if (best - c > gain + 1e-9) [gain, bi, bj] = [best - c, i, j];
        }
      if (bi < 0) break;
      [asg[bi], asg[bj]] = [asg[bj], asg[bi]];
      best -= gain;
    }
    return { asg, c: best };
  };

  const tries = Array.from({ length: 40 }, () => improve(randomStart()));
  const bestC = Math.min(...tries.map((x) => x.c));
  const good = tries.filter((x) => x.c <= bestC + 0.6); // 거의 같은 공정함이면 아무거나
  const pick = good[Math.floor(Math.random() * good.length)].asg;

  for (let t = 0; t < k; t++) autoPlace(t, shuffle(ids.filter((_, i) => pick[i] === t)));
  return true;
}

/** 팀별 별 합계 (화면 표시용) */
export const teamSkillSum = (T) => teamPlayers(T).filter(P).reduce((a, id) => a + (P(id).skill ?? 3), 0);

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
