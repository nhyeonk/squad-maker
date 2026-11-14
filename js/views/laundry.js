// 🧺 빨래 당번 뽑기: 룰렛 / 사다리타기 (당번은 한 명)
// 경기 상세(진 팀 기본 선택)나 라인업 탭에서 열어요. 뽑은 결과는 경기 기록에 저장할 수 있어요.
import { S, P, pname, lineup } from "../state.js";
import { teamPlayers } from "../lineup.js";
import { scoreOf } from "../stats.js";
import { esc } from "../utils.js";
import { openModal } from "./modals.js";

const COLORS = ["#e5484d", "#3e63dd", "#30a46c", "#f59e0b", "#8e4ec6", "#12a594", "#e54666", "#0090ff", "#ff801f", "#5b5b57", "#46a758", "#d6409f"];

/** 공정한 난수 (0 ≤ x < n) */
export function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

/* ---------- 후보 명단 ---------- */
function sources() {
  const L = S.ui.laundry;
  if (L.matchId && S.matches[L.matchId]) {
    const m = S.matches[L.matchId];
    return m.teams.map((T) => ({ name: T.name, color: T.color, ids: (T.players || []).filter(P) }));
  }
  return lineup().teams.map((T) => ({ name: T.name, color: T.color, ids: teamPlayers(T).filter(P) }));
}
export const candidates = () => {
  const L = S.ui.laundry;
  return (sources()[L.team]?.ids || []).filter((id) => !L.exclude.includes(id));
};

/** 처음 열 때: 경기에서 열면 진 팀이 기본 */
export function startLaundry(matchId) {
  let team = 0;
  if (matchId && S.matches[matchId]) {
    const sc = scoreOf(S.matches[matchId]);
    if (sc[0] !== sc[1]) team = sc[0] < sc[1] ? 0 : 1;
  }
  // 당번은 한 명 (count: 1)
  S.ui.laundry = { matchId: matchId || null, team, mode: "roulette", count: 1, winners: [], exclude: [], angle: 0, spinning: false, ladder: null };
  openLaundry();
}

/* ---------- 화면 ---------- */
export function openLaundry() {
  const L = S.ui.laundry;
  const src = sources();
  const ids = candidates();
  const m = L.matchId && S.matches[L.matchId];
  const sc = m ? scoreOf(m) : null;
  const loser = sc && sc[0] !== sc[1] ? (sc[0] < sc[1] ? 0 : 1) : -1;

  const teamBtns = src
    .map((t, i) => `<button class="${L.team === i ? "on" : ""}" data-act="lteam" data-v="${i}"><span class="dot" style="background:${t.color};margin-right:5px"></span>${esc(t.name)} ${t.ids.length}명${i === loser ? " · 패" : ""}</button>`)
    .join("");
  const done = L.winners.length >= Math.min(L.count, ids.length + L.winners.length);
  const result = L.winners.length
    ? `<div class="lresult">🧺 빨래 당번: ${L.winners.map((id) => `<b>${esc(pname(id))}</b>`).join(", ")}</div>`
    : "";
  const saveBtn = L.winners.length && m && S.canEdit && done
    ? `<button class="btn pri" data-act="lsave">경기 기록에 저장</button>`
    : "";
  const exclude = (sources()[L.team]?.ids || []).length
    ? `<details class="lex"><summary>빼고 뽑을 사람 ${L.exclude.length ? `(${L.exclude.length}명)` : ""}</summary><div class="chips" style="margin-top:6px">${sources()[L.team].ids
        .map((id) => `<button class="chip ${L.exclude.includes(id) ? "ghost" : ""}" data-act="lexclude" data-v="${id}">${L.exclude.includes(id) ? "✕ " : ""}${esc(pname(id))}</button>`)
        .join("")}</div></details>`
    : "";

  let stage;
  if (ids.length + L.winners.length < 1) stage = `<div class="empty">이 팀에 선수가 없어요.</div>`;
  else if (L.mode === "roulette") stage = rouletteHtml(ids, done);
  else stage = ladderHtml(ids);

  openModal(`<h2>🧺 빨래 당번 뽑기<span class="sp"></span><button class="btn sm" data-act="close">닫기</button></h2>
    <div class="seg imgseg" style="margin-bottom:8px">${teamBtns}</div>
    <div class="row" style="flex-wrap:wrap;margin-bottom:10px">
      <div class="seg"><button class="${L.mode === "roulette" ? "on" : ""}" data-act="lmode" data-v="roulette">🎡 룰렛</button><button class="${L.mode === "ladder" ? "on" : ""}" data-act="lmode" data-v="ladder">🪜 사다리</button></div>
    </div>
    ${exclude}
    <div class="lstage">${stage}</div>
    ${result}
    <div class="row" style="justify-content:flex-end;margin-top:10px;flex-wrap:wrap">${L.winners.length ? `<button class="btn" data-act="lreset">다시 뽑기</button>` : ""}${saveBtn}</div>`);
  document.querySelector("#modal .modal")?.classList.add("wide");
  if (L.mode === "roulette") drawWheel();
}

/* ---------- 룰렛 ---------- */
function rouletteHtml(ids, done) {
  const L = S.ui.laundry;
  return `<div class="wheelbox"><div class="wheelptr">▼</div><canvas id="wheel" width="600" height="600"></canvas></div>
    <button class="btn pri block" data-act="lspin" ${L.spinning || done || !ids.length ? "disabled" : ""}>${
      done ? "뽑았어요!" : "🎡 돌리기"
    }</button>`;
}

export function drawWheel(highlight) {
  const cv = document.getElementById("wheel");
  if (!cv) return;
  const L = S.ui.laundry;
  const ids = candidates().filter((id) => !L.winners.includes(id));
  const c = cv.getContext("2d");
  const R = 290, cx = 300, cy = 300;
  c.clearRect(0, 0, 600, 600);
  if (!ids.length) return;
  const seg = (Math.PI * 2) / ids.length;
  ids.forEach((id, i) => {
    const a0 = L.angle + i * seg - Math.PI / 2;
    c.beginPath();
    c.moveTo(cx, cy);
    c.arc(cx, cy, R, a0, a0 + seg);
    c.closePath();
    c.fillStyle = id === highlight ? "#1d1d1b" : COLORS[i % COLORS.length];
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = 3;
    c.stroke();
    // 이름
    c.save();
    c.translate(cx, cy);
    c.rotate(a0 + seg / 2);
    c.fillStyle = "#fff";
    c.font = `800 ${ids.length > 12 ? 22 : 28}px 'Pretendard Variable',Pretendard,sans-serif`;
    c.textAlign = "right";
    c.textBaseline = "middle";
    c.fillText(pname(id), R - 18, 0);
    c.restore();
  });
  c.beginPath();
  c.arc(cx, cy, 34, 0, Math.PI * 2);
  c.fillStyle = "#fff";
  c.fill();
  c.font = "30px sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("🧺", cx, cy + 2);
}

/** 당첨자를 먼저 공정하게 뽑고, 그 칸이 위쪽 화살표에 멈추도록 돌려요 */
export function spin(onDone) {
  const L = S.ui.laundry;
  const ids = candidates().filter((id) => !L.winners.includes(id));
  if (!ids.length || L.spinning) return;
  const win = randInt(ids.length);
  const seg = (Math.PI * 2) / ids.length;
  // 당첨 칸 가운데가 맨 위(화살표)로 오는 각도 + 칸 안에서 살짝 무작위 + 5~7바퀴
  const inSeg = (randInt(1000) / 1000 - 0.5) * seg * 0.7;
  const target = -(win * seg + seg / 2 + inSeg);
  const start = L.angle;
  const TAU = Math.PI * 2;
  const turns = (5 + randInt(3)) * TAU; // 5~7바퀴
  const delta = (((target - start) % TAU) + TAU) % TAU;
  const finalAngle = start + turns + delta;
  const total = finalAngle - start;
  const dur = 4200;
  const t0 = performance.now();
  L.spinning = true;
  document.querySelector('[data-act="lspin"]')?.setAttribute("disabled", "");
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const ease = 1 - Math.pow(1 - t, 4);
    L.angle = start + total * ease;
    drawWheel();
    if (t < 1) return requestAnimationFrame(step);
    L.angle = finalAngle;
    drawWheel(ids[win]);
    L.spinning = false;
    navigator.vibrate?.(120);
    setTimeout(() => {
      L.winners.push(ids[win]);
      L.angle = 0;
      onDone?.();
    }, 900);
  };
  requestAnimationFrame(step);
}

/* ---------- 사다리타기 ---------- */
/** 사다리 만들기: 가로줄을 무작위로 놓고, 아래 칸 중 count개를 🧺로 */
export function makeLadder(n, count) {
  const rows = Math.max(8, Math.min(14, n + 4));
  const rungs = []; // rungs[row] = [왼쪽 기둥 번호들]
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let i = 0; i < n - 1; i++) if (!row.includes(i - 1) && randInt(100) < 45) row.push(i);
    rungs.push(row);
  }
  // 모든 기둥 사이에 최소 한 줄은 있게
  for (let i = 0; i < n - 1; i++) {
    if (!rungs.some((row) => row.includes(i))) {
      const r = randInt(rows);
      if (!rungs[r].includes(i - 1) && !rungs[r].includes(i + 1)) rungs[r].push(i);
    }
  }
  const prizes = Array(n).fill(false);
  let k = Math.min(count, n);
  while (k) {
    const i = randInt(n);
    if (!prizes[i]) {
      prizes[i] = true;
      k--;
    }
  }
  return { n, rows, rungs, prizes, revealed: [] };
}

/** 위에서 col번째로 출발했을 때 지나는 길 [[col,row]...]과 도착 칸 */
export function tracePath(lad, col) {
  const pts = [[col, -1]];
  let c = col;
  for (let r = 0; r < lad.rows; r++) {
    pts.push([c, r]);
    if (lad.rungs[r].includes(c)) c += 1;
    else if (lad.rungs[r].includes(c - 1)) c -= 1;
    pts.push([c, r]);
  }
  pts.push([c, lad.rows]);
  return { pts, end: c };
}

function ladderHtml(ids) {
  const L = S.ui.laundry;
  if (!L.ladder || L.ladder.n !== ids.length) L.ladder = makeLadder(ids.length, L.count);
  const lad = L.ladder;
  const W = 64, H = 30, top = 44, left = 32;
  const width = left * 2 + W * (lad.n - 1), height = top + H * (lad.rows + 1) + 46;
  const X = (c) => left + c * W, Y = (r) => top + (r + 0.5) * H;
  let svg = "";
  for (let c = 0; c < lad.n; c++) svg += `<line x1="${X(c)}" y1="${top}" x2="${X(c)}" y2="${top + H * (lad.rows + 1)}" class="lv"/>`;
  lad.rungs.forEach((row, r) => row.forEach((c) => (svg += `<line x1="${X(c)}" y1="${Y(r)}" x2="${X(c + 1)}" y2="${Y(r)}" class="lv"/>`)));
  // 지나간 길
  lad.revealed.forEach((c) => {
    const { pts } = tracePath(lad, c);
    const d = pts.map(([cc, r], i) => `${i ? "L" : "M"}${X(cc)},${r < 0 ? top : r >= lad.rows ? top + H * (lad.rows + 1) : Y(r)}`).join(" ");
    const anim = (lad.fresh || []).includes(c) ? "" : ";animation:none;stroke-dashoffset:0"; // 방금 탄 길만 그려지는 애니메이션
    svg += `<path d="${d}" class="lpath" style="stroke:${COLORS[c % COLORS.length]}${anim}"/>`;
  });
  // 위: 이름, 아래: 결과
  const ends = {};
  lad.revealed.forEach((c) => (ends[tracePath(lad, c).end] = c));
  const tops = ids
    .map((id, c) => `<button class="lname ${lad.revealed.includes(c) ? "done" : ""}" style="left:${X(c)}px;border-color:${COLORS[c % COLORS.length]}" data-act="lpick" data-v="${c}">${esc(pname(id))}</button>`)
    .join("");
  const bottoms = lad.prizes
    .map((p, c) => `<span class="lprize ${c in ends ? (p ? "hit" : "miss") : ""}" style="left:${X(c)}px">${c in ends ? (p ? "🧺" : "통과") : "?"}</span>`)
    .join("");
  return `<div class="ladderwrap"><div class="ladder" style="width:${width}px;height:${height}px">${tops}
      <svg width="${width}" height="${height}">${svg}</svg>${bottoms}</div></div>
    <div class="row" style="margin-top:8px"><span class="hint" style="margin:0;flex:1">이름을 누르면 사다리를 타요.</span>
      <button class="btn sm" data-act="lnew">사다리 새로 만들기</button><button class="btn sm pri" data-act="lall">전체 결과 보기</button></div>`;
}

/** 사다리 결과 → 당첨자 */
export function ladderWinners() {
  const L = S.ui.laundry;
  const ids = candidates();
  return L.ladder.revealed.filter((c) => L.ladder.prizes[tracePath(L.ladder, c).end]).map((c) => ids[c]);
}
