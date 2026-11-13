// 내보내기: 명단 텍스트, 스쿼드 이미지, 백업 파일
import { S, P, pname, lineup } from "./state.js";
import { api } from "./store.js";
import { currentSlots, teamPlayers, poolList } from "./lineup.js";
import { FUTSAL_MAX, POS_COLOR } from "./formations.js";
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

/* ---------- 스쿼드 이미지 (canvas) ---------- */
export async function saveSquadImage() {
  const l = lineup();
  const T = l.teams[S.ui.team];
  const slots = currentSlots();
  const futsal = l.size <= FUTSAL_MAX;
  const W = 1080, H = 1500;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  const font = (w) => `${w} 'Pretendard Variable',Pretendard,'Apple SD Gothic Neo','Noto Sans KR',sans-serif`;

  c.fillStyle = "#f3f0ea";
  c.fillRect(0, 0, W, H);
  c.fillStyle = T.color;
  c.beginPath();
  c.arc(40, 75, 12, 0, 7);
  c.fill();
  c.fillStyle = "#1d1d1b";
  c.font = font("800 52px");
  c.fillText(T.name, 60, 92);
  c.fillStyle = "#6f6b63";
  c.font = font("600 30px");
  c.fillText(`${fmtDate(todayStr())} · ${l.size} vs ${l.size} · ${l.formation}${l.referee ? " · 심판 " + l.referee : ""}`, 60, 140);

  // 경기장
  const px = 60, py = 175, pw = W - 120, ph = 1170;
  const stripes = futsal ? ["#3d79b8", "#3770ad"] : ["#2e8b4d", "#2a8047"];
  for (let i = 0; i < 10; i++) {
    c.fillStyle = stripes[i % 2];
    c.fillRect(px, py + (i * ph) / 10, pw, ph / 10 + 1);
  }
  c.strokeStyle = "rgba(255,255,255,.75)";
  c.lineWidth = 4;
  c.strokeRect(px + 20, py + 20, pw - 40, ph - 40);
  c.beginPath();
  c.moveTo(px + 20, py + ph / 2);
  c.lineTo(px + pw - 20, py + ph / 2);
  c.stroke();
  c.beginPath();
  c.arc(px + pw / 2, py + ph / 2, pw * 0.13, 0, 7);
  c.stroke();
  c.strokeRect(px + pw * 0.2, py + 20, pw * 0.6, ph * 0.15);
  c.strokeRect(px + pw * 0.2, py + ph - 20 - ph * 0.15, pw * 0.6, ph * 0.15);

  // 선수
  c.textAlign = "center";
  c.textBaseline = "middle";
  slots.forEach((s, i) => {
    const x = px + (pw * s.x) / 100, y = py + (ph * s.y) / 100, pid = T.slots[i];
    c.beginPath();
    c.arc(x, y, 42, 0, 7);
    c.fillStyle = pid ? POS_COLOR[s.role] : "rgba(0,0,0,.2)";
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = pid ? "#fff" : POS_COLOR[s.role];
    c.stroke();
    c.fillStyle = pid ? (s.role === "GK" ? "#3a2c00" : "#fff") : "#fff";
    c.font = font("800 22px");
    c.fillText(s.label, x, y);
    if (pid) {
      const n = pname(pid);
      c.font = font("800 30px");
      const tw = c.measureText(n).width + 22;
      c.fillStyle = "#1f2a24";
      c.beginPath();
      c.roundRect ? c.roundRect(x - tw / 2, y + 50, tw, 44, 8) : c.rect(x - tw / 2, y + 50, tw, 44);
      c.fill();
      c.fillStyle = T.color;
      c.fillRect(x - tw / 2 + 4, y + 90, tw - 8, 5);
      c.fillStyle = "#fff";
      c.fillText(n, x, y + 73);
    }
  });
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  const bench = T.bench.filter(P).map(pname);
  if (bench.length) {
    c.fillStyle = "#1d1d1b";
    c.font = font("700 30px");
    c.fillText(`후보  ${bench.join(", ")}`, 60, py + ph + 70);
  }
  c.fillStyle = "#a19c91";
  c.font = font("600 24px");
  c.fillText("스쿼드 메이커", 60, H - 40);

  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const file = new File([blob], `squad-${T.name}.png`, { type: "image/png" });
  // 폰에서는 공유 시트(카톡 등)로 바로 보내기
  if (navigator.canShare?.({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: `${T.name} 라인업` });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  download(blob, file.name);
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
