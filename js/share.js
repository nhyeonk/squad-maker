// 내보내기: 명단 텍스트, 스쿼드 이미지, 백업 파일
import { S, P, pname, lineup } from "./state.js";
import { api } from "./store.js";
import { currentSlots, teamPlayers, poolList } from "./lineup.js";
import { POS_COLOR } from "./formations.js";
import { findByName } from "./players.js";
import { clone, download, fmtDate, todayStr, toast } from "./utils.js";

/* ---------- 카톡용 명단 텍스트 ---------- */
export function lineupText() {
  const l = lineup();
  let s = `⚽ ${fmtDate(todayStr())} ${l.size} vs ${l.size} 라인업\n`;
  if (l.referee) s += `심판: ${l.referee}\n`;
  l.teams.forEach((T, ti) => {
    const slots = currentSlots(ti);
    const ids = teamPlayers(T).filter(P);
    if (!ids.length) return;
    s += `\n${T.name} (${ids.length}명)\n`;
    const by = { GK: [], DF: [], MF: [], FW: [] };
    Object.entries(T.slots).forEach(([k, pid]) => P(pid) && by[slots[k]?.role || "MF"].push(`${pname(pid)}(${slots[k]?.label})`));
    ["GK", "DF", "MF", "FW"].forEach((r) => by[r].length && (s += `${r} ${by[r].join(", ")}\n`));
    const bench = T.bench.filter(P);
    if (bench.length) s += `후보 ${bench.map(pname).join(", ")}\n`;
  });
  const pool = poolList();
  if (pool.length) s += `\n대기: ${pool.map(pname).join(", ")}\n`;
  return s.trim();
}

/* ---------- 스쿼드 이미지 (canvas) ----------
 * mode: "t0", "t1" … = 그 팀만, "all" = 선수가 있는 모든 팀을 나란히
 */
const FONT = "'Pretendard Variable',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',sans-serif";
const font = (w, px) => `${w} ${px}px ${FONT}`;
const PANEL_W = 900, PANEL_H = 1240;

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}

function drawPitch(c, x, y, w, h) {
  const stripes = ["#2e8b4d", "#2a8047"];
  for (let i = 0; i < 12; i++) {
    c.fillStyle = stripes[i % 2];
    c.fillRect(x, y + (i * h) / 12, w, h / 12 + 1);
  }
  c.strokeStyle = "rgba(255,255,255,.75)";
  c.lineWidth = 3;
  const m = 14;
  c.strokeRect(x + m, y + m, w - m * 2, h - m * 2);
  c.beginPath();
  c.moveTo(x + m, y + h / 2);
  c.lineTo(x + w - m, y + h / 2);
  c.stroke();
  c.beginPath();
  c.arc(x + w / 2, y + h / 2, w * 0.14, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "rgba(255,255,255,.85)";
  c.beginPath();
  c.arc(x + w / 2, y + h / 2, 5, 0, Math.PI * 2);
  c.fill();
  // 페널티 박스, 골 박스
  c.strokeRect(x + w * 0.2, y + m, w * 0.6, h * 0.15);
  c.strokeRect(x + w * 0.36, y + m, w * 0.28, h * 0.055);
  c.strokeRect(x + w * 0.2, y + h - m - h * 0.15, w * 0.6, h * 0.15);
  c.strokeRect(x + w * 0.36, y + h - m - h * 0.055, w * 0.28, h * 0.055);
}

function drawPanel(c, ox, oy, ti, st) {
  const l = lineup();
  const T = l.teams[ti];
  const slots = currentSlots(ti);
  // 배경 카드
  c.fillStyle = "#f3f0ea";
  c.fillRect(ox, oy, PANEL_W, PANEL_H);

  // 머리글
  c.fillStyle = T.color;
  roundRect(c, ox + 30, oy + 32, 8, 48, 4);
  c.fill();
  c.fillStyle = "#1d1d1b";
  c.font = font(800, 44);
  c.textBaseline = "alphabetic";
  c.fillText(T.name, ox + 52, oy + 70);
  c.fillStyle = "#6f6b63";
  c.font = font(600, 22);
  c.fillText(`${l.size}인 ${l.formation} · ${fmtDate(todayStr())}`, ox + 52, oy + 104);

  // 경기장
  const px = ox + 30, py = oy + 130, pw = 640, ph = 1070;
  roundRect(c, px, py, pw, ph, 14);
  c.save();
  c.clip();
  drawPitch(c, px, py, pw, ph);
  c.restore();

  // 선수
  c.textAlign = "center";
  slots.forEach((s, i) => {
    const pid = T.slots[i];
    const x = px + (pw * s.x) / 100, y = py + (ph * s.y) / 100;
    const col = POS_COLOR[s.role];
    c.beginPath();
    c.arc(x, y, 32, 0, Math.PI * 2);
    if (pid && P(pid)) {
      c.fillStyle = col;
      c.fill();
      c.lineWidth = 5;
      c.strokeStyle = "#fff";
      c.stroke();
      c.fillStyle = s.role === "GK" ? "#3a2c00" : "#fff";
      c.font = font(900, 19);
      c.textBaseline = "middle";
      c.fillText(s.label, x, y + 1);
      // 숫자 배지
      const n = badgeNumber(st, pid);
      if (n) {
        c.beginPath();
        c.arc(x + 27, y - 25, 14, 0, Math.PI * 2);
        c.fillStyle = "#fff";
        c.fill();
        c.fillStyle = "#1d1d1b";
        c.font = font(900, 16);
        c.fillText(String(n), x + 27, y - 24);
      }
      // 이름표 + 팀 색 줄
      const name = pname(pid);
      c.font = font(800, 23);
      const tw = c.measureText(name).width + 20;
      c.fillStyle = "#1f2a24";
      roundRect(c, x - tw / 2, y + 40, tw, 36, 6);
      c.fill();
      c.fillStyle = T.color;
      c.fillRect(x - tw / 2 + 3, y + 72, tw - 6, 4);
      c.fillStyle = "#fff";
      c.fillText(name, x, y + 58);
    } else {
      c.fillStyle = "rgba(0,0,0,.18)";
      c.fill();
      c.setLineDash([6, 5]);
      c.lineWidth = 3;
      c.strokeStyle = col;
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = col;
      c.font = font(800, 17);
      c.textBaseline = "middle";
      c.fillText(s.label, x, y + 1);
    }
  });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";

  // 오른쪽: 심판, 후보
  const sx = ox + 690, sw = 180;
  let sy = py;
  const box = (title, lines) => {
    const h = 56 + Math.max(1, lines.length) * 34;
    c.fillStyle = "#20302a";
    roundRect(c, sx, sy, sw, h, 12);
    c.fill();
    c.fillStyle = "#fff";
    c.font = font(800, 21);
    c.fillText(title, sx + 16, sy + 36);
    c.font = font(700, 20);
    c.fillStyle = "rgba(255,255,255,.88)";
    (lines.length ? lines : ["-"]).forEach((t, i) => c.fillText(t, sx + 16, sy + 74 + i * 34));
    sy += h + 14;
  };
  if (l.referee) box("심판", [l.referee]);
  const bench = T.bench.filter(P).map(pname);
  box(`후보 ${bench.length}`, bench.slice(0, 18));

  // 범례
  const legend = [["공격", "FW"], ["미드필더", "MF"], ["수비", "DF"], ["골키퍼", "GK"]];
  let ly = py + ph - legend.length * 32 - 30;
  c.font = font(600, 19);
  legend.forEach(([t, r]) => {
    c.fillStyle = POS_COLOR[r];
    c.beginPath();
    c.arc(sx + 12, ly - 6, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#6f6b63";
    c.fillText(t, sx + 30, ly);
    ly += 32;
  });
  c.fillStyle = "#a19c91";
  c.font = font(600, 16);
  c.fillText("스쿼드 메이커", sx, py + ph - 4);
}

function badgeNumber(st, pid) {
  const s = st[pid];
  if (!s) return 0;
  return { apps: s.apps, goals: s.goals, ap: s.goals + s.ast }[S.ui.badge] || 0;
}

/** 이미지에 들어갈 팀 목록 */
export function imageTeams(mode) {
  const l = lineup();
  if (/^t\d+$/.test(mode)) return [Math.min(+mode.slice(1), l.teams.length - 1)];
  const withPlayers = l.teams.map((T, i) => (teamPlayers(T).filter(P).length ? i : -1)).filter((i) => i >= 0);
  return withPlayers.length ? withPlayers : l.teams.map((_, i) => i);
}

export function renderSquadCanvas(mode, st) {
  const teams = imageTeams(mode);
  const scale = teams.length > 2 ? 1 : 1.5; // 한두 팀이면 더 선명하게
  const gap = 24;
  const cv = document.createElement("canvas");
  cv.width = (teams.length * PANEL_W + (teams.length - 1) * gap) * scale;
  cv.height = PANEL_H * scale;
  const c = cv.getContext("2d");
  c.scale(scale, scale);
  c.fillStyle = "#e9e5dc";
  c.fillRect(0, 0, cv.width, cv.height);
  teams.forEach((ti, k) => drawPanel(c, k * (PANEL_W + gap), 0, ti, st));
  return cv;
}

const toBlob = (cv) => new Promise((r) => cv.toBlob(r, "image/png"));
const fileName = (mode) => `squad-${mode === "all" ? "all" : lineup().teams[imageTeams(mode)[0]].name}-${todayStr()}.png`;

export async function saveCanvasImage(cv, mode) {
  const blob = await toBlob(cv);
  const file = new File([blob], fileName(mode), { type: "image/png" });
  // 폰에서는 공유 시트(카톡 등)로 바로 보내기
  if (navigator.canShare?.({ files: [file] }) && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: "스쿼드" });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  download(blob, file.name);
}

export async function copyCanvasImage(cv) {
  try {
    // 사파리는 Promise를 넘겨야 클릭 직후 권한이 유지돼요
    await navigator.clipboard.write([new ClipboardItem({ "image/png": toBlob(cv) })]);
    toast("이미지를 복사했어요. 카톡 대화창에 붙여넣으세요");
  } catch (e) {
    console.warn(e);
    toast("이 브라우저는 이미지 복사를 지원하지 않아요. 저장을 눌러 주세요");
  }
}

/* ---------- 백업 ---------- */
export function exportBackup() {
  const data = { app: "squadmaker", v: 1, at: new Date().toISOString(), players: S.players, matches: S.matches, lineup: S.lineup };
  download(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), `squadmaker-backup-${todayStr()}.json`);
}

export function importBackup(onDone) {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json,.json";
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (!d.players) throw new Error("bad file");
      const msg = `선수 ${Object.keys(d.players).length}명, 경기 ${Object.keys(d.matches || {}).length}개를 합칠까요? (같은 경기는 덮어써요)`;
      if (!confirm(msg)) return;
      await mergeData(d);
      toast("불러왔어요");
      onDone?.();
    } catch {
      toast("백업 파일을 읽지 못했어요");
    }
  };
  inp.click();
}

/** 다른 기록 합치기. 이름이 같은 선수는 한 명으로 합쳐요 */
export async function mergeData(d) {
  const idMap = {};
  for (const p of Object.values(d.players || {})) {
    const ex = findByName(p.name);
    if (ex) {
      idMap[p.id] = ex.id;
      if (!(ex.pos || []).length && (p.pos || []).length) await api.putPlayer({ ...ex, pos: p.pos, skill: p.skill || ex.skill });
    } else {
      idMap[p.id] = p.id;
      await api.putPlayer(p);
    }
  }
  const r = (id) => (id ? idMap[id] || id : id);
  for (const m of Object.values(d.matches || {})) {
    const mm = clone(m);
    mm.teams.forEach((T) => {
      T.players = (T.players || []).map(r);
      const roles = {};
      Object.entries(T.roles || {}).forEach(([k, v]) => (roles[r(k)] = v));
      T.roles = roles;
    });
    (mm.goals || []).forEach((g) => {
      g.scorer = r(g.scorer);
      g.assist = r(g.assist);
    });
    await api.putMatch(mm);
  }
}
