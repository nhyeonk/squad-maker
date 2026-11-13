// 버튼·입력 이벤트 처리
// HTML의 data-act="이름" 버튼을 누르면 아래 actions["이름"]이 실행돼요. (data-v 값이 v로 들어와요)
import { S, P, lineup, defaultLineup, mkTeam } from "./state.js";
import { api, parseConfig, saveCfg, clearCfg, shareLink, login, logout, loginGoogle, claimOwner, setRecorders, loadLocal } from "./store.js";
import { FORMATIONS } from "./formations.js";
import { ensurePlayer, findByName, parseNames } from "./players.js";
import { recognizeNames } from "./ocr.js";
import { locate, removeFrom, movePlayer, autoPlace, relayoutAll, balanceSplit, fillEmpty, teamPlayers, poolList } from "./lineup.js";
import { createMatchFromLineup, createBlankMatch, addGoal, removeGoal, addToMatch, removeFromMatch, updateMatchField } from "./matches.js";
import { lineupText, saveSquadImage, exportBackup, importBackup, mergeData } from "./share.js";
import * as M from "./views/modals.js";
import { render } from "./render.js";
import { $, copyText, toast } from "./utils.js";

/** 라인업 변경 저장 + 선택 해제 + 다시 그리기 */
function commitLineup() {
  S.ui.sel = null;
  api.putLineup();
  render();
}

/* 보기 전용일 때 막을 동작 */
const EDIT_ONLY = new Set([
  "tobench", "toteam", "topool", "attend", "unattend", "split", "fill", "clearteam", "resetall", "addteam", "delteam",
  "autoplace", "startmatch", "newmatch", "goal", "delgoal", "mstatus", "delmatch", "mrmplayer", "maddplayer",
  "ppos", "pskill", "psave", "pdel", "newplayer", "upload", "import", "ocr", "ocrapply", "pregular", "attendregulars", "rostertoggle",
]);

const actions = {
  /* ----- 공통 ----- */
  tab(v) {
    S.ui.tab = v;
    S.ui.sel = null;
    if (v !== "matches") S.ui.matchId = null;
    render();
    window.scrollTo(0, 0);
  },
  settings: () => M.openSettings(),
  close: () => M.closeModal(),
  info: (v) => M.openPlayer(v),

  /* ----- 라인업: 선택 & 이동 ----- */
  team(v) {
    S.ui.team = +v;
    render();
  },
  pl(v) {
    // 선수 칩/후보 누르기: 선택 → 다른 선수 누르면 맞교환
    if (!S.canEdit) return M.openPlayer(v);
    const sel = S.ui.sel;
    if (sel && sel !== v) {
      movePlayer(sel, { kind: "player", pid: v });
      commitLineup();
    } else {
      S.ui.sel = sel === v ? null : v;
      render();
    }
  },
  slot(v) {
    const T = lineup().teams[S.ui.team];
    const pid = T.slots[v];
    if (!S.canEdit) return pid && M.openPlayer(pid);
    const sel = S.ui.sel;
    if (sel) {
      if (sel === pid) S.ui.sel = null;
      else return movePlayer(sel, { kind: "slot", team: S.ui.team, slot: +v }), commitLineup();
      render();
    } else if (pid) {
      S.ui.sel = pid;
      render();
    } else if (poolList().length) toast("대기 명단에서 선수를 먼저 누르세요");
  },
  tobench() {
    if (!S.ui.sel) return toast("선수를 먼저 누르세요");
    movePlayer(S.ui.sel, { kind: "bench", team: S.ui.team });
    commitLineup();
  },
  toteam(v) {
    if (!S.ui.sel) return;
    movePlayer(S.ui.sel, { kind: "team", team: +v });
    commitLineup();
  },
  topool() {
    if (!S.ui.sel) return;
    movePlayer(S.ui.sel, { kind: "pool" });
    commitLineup();
  },
  unsel() {
    S.ui.sel = null;
    render();
  },

  /* ----- 라인업: 참가자 & 팀 ----- */
  attend(v) {
    const l = lineup();
    if (!l.attendees.includes(v)) l.attendees.push(v);
    commitLineup();
  },
  unattend(v) {
    const l = lineup();
    removeFrom(locate(v), v);
    l.attendees = l.attendees.filter((x) => x !== v);
    commitLineup();
  },
  split() {
    if (!balanceSplit()) return toast("참가자를 먼저 추가하세요");
    commitLineup();
    toast(`${lineup().teams.length}팀으로 나눴어요. 선수를 눌러 바꿀 수 있어요`);
  },
  fill() {
    if (!fillEmpty(S.ui.team)) return toast("대기 명단이 비어 있어요");
    commitLineup();
  },
  clearteam() {
    const T = lineup().teams[S.ui.team];
    T.slots = {};
    T.bench = [];
    commitLineup();
  },
  resetall() {
    if (!confirm("참가자와 팀 배치를 모두 지울까요? (경기 기록은 그대로예요)")) return;
    const { size, formation } = lineup();
    S.lineup = { ...defaultLineup(), size, formation };
    S.ui.team = 0;
    commitLineup();
  },
  addteam() {
    const l = lineup();
    if (l.teams.length >= 6) return toast("팀은 6개까지예요");
    l.teams.push(mkTeam(l.teams.length));
    S.ui.team = l.teams.length - 1;
    commitLineup();
  },
  delteam() {
    const l = lineup();
    if (l.teams.length <= 2) return;
    if (!confirm(`${l.teams[S.ui.team].name}을(를) 삭제할까요? 선수는 대기 명단으로 가요.`)) return;
    l.teams.splice(S.ui.team, 1);
    S.ui.team = 0;
    commitLineup();
  },
  autoplace() {
    lineup().teams.forEach((T, i) => autoPlace(i, teamPlayers(T).filter(P)));
    commitLineup();
    toast("선호 포지션대로 다시 배치했어요");
  },
  /* ----- 카톡 캡처 → 참가자 ----- */
  roster: () => M.openRoster(),
  async rostertoggle(v) {
    await api.putPlayer({ ...P(v), regular: !P(v).regular });
    M.openRoster();
    render();
  },
  ocr(target) {
    target = target === "roster" ? "roster" : "attend";
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.multiple = true; // 목록이 길면 여러 장 캡처
    inp.onchange = async () => {
      const files = [...inp.files];
      if (!files.length) return;
      S.ui.ocr = { busy: true, progress: 0, rows: [], target };
      M.openOcr();
      try {
        const found = await recognizeNames(files, (p) => {
          const el = $("#ocrpct");
          if (el) el.textContent = Math.round(p * 100) + "%";
        });
        const l = lineup();
        const already = (r) => r.existingId && (target === "roster" ? P(r.existingId)?.regular : l.attendees.includes(r.existingId));
        S.ui.ocr = { busy: false, target, rows: found.map((r) => ({ ...r, on: !already(r) })) };
      } catch (e) {
        console.error(e);
        S.ui.ocr = { busy: false, rows: [], target, error: e.message || "사진을 읽지 못했어요" };
      }
      M.openOcr();
    };
    inp.click();
  },
  ocrtoggle(v) {
    const r = S.ui.ocr.rows[+v];
    r.on = !r.on;
    M.openOcr();
  },
  ocradd() {
    S.ui.ocr.rows.push({ raw: "", name: "", existingId: null, on: true });
    M.openOcr();
    setTimeout(() => [...document.querySelectorAll("[data-ocr-i]")].pop()?.focus(), 30);
  },
  ocrapply() {
    const rows = S.ui.ocr.rows.filter((r) => r.on && r.name.trim());
    if (S.ui.ocr.target === "roster") {
      rows.forEach((r) => {
        const p = ensurePlayer(r.name);
        if (p && !p.regular) api.putPlayer({ ...p, regular: true });
      });
      toast(`고정 참여 명단에 ${rows.length}명 넣었어요`);
      M.openRoster();
      return render();
    }
    const l = lineup();
    let added = 0;
    rows.forEach((r) => {
      const p = ensurePlayer(r.name);
      if (p && !l.attendees.includes(p.id)) {
        l.attendees.push(p.id);
        added++;
      }
    });
    M.closeModal();
    commitLineup();
    toast(`${added}명 추가했어요`);
  },
  img: () => saveSquadImage(),
  copytext: () => copyText(lineupText()),

  /* ----- 경기 ----- */
  startmatch() {
    if (!M.openStartMatch()) toast("두 팀 이상에 선수를 배치하세요");
  },
  mpick(v) {
    const pk = S.ui.mpick;
    if (pk.includes(+v)) return;
    pk.shift();
    pk.push(+v);
    M.redrawStart();
  },
  mcreate() {
    const [a, b] = S.ui.mpick;
    const m = createMatchFromLineup(a, b, ($("#mtitle")?.value || "").trim());
    M.closeModal();
    openMatch(m.id);
  },
  newmatch() {
    if (M.openStartMatch()) return;
    openMatch(createBlankMatch().id);
  },
  openmatch: (v) => openMatch(v),
  backlist() {
    S.ui.matchId = null;
    render();
  },
  goal: (v) => M.openGoal(+v),
  gog(v) {
    Object.assign(S.ui.goalDraft, { og: v === "1", scorer: null, assist: null });
    M.redrawGoal();
  },
  gsc(v) {
    const d = S.ui.goalDraft;
    d.scorer = v || null;
    if (d.assist === v) d.assist = null;
    M.redrawGoal();
  },
  gas(v) {
    S.ui.goalDraft.assist = v || null;
    M.redrawGoal();
  },
  gsave() {
    addGoal(S.ui.goalDraft);
    M.closeModal();
    render();
  },
  delgoal(v) {
    if (!confirm("이 골을 지울까요?")) return;
    removeGoal(v);
    render();
  },
  mstatus(v) {
    updateMatchField("status", v);
    render();
  },
  delmatch() {
    if (!confirm("이 경기를 삭제할까요? 되돌릴 수 없어요.")) return;
    api.delMatch(S.ui.matchId);
    S.ui.matchId = null;
    render();
  },
  mrmplayer(v) {
    const [ti, pid] = v.split(":");
    removeFromMatch(+ti, pid);
    render();
  },
  maddplayer: (v) => M.openAddMatchPlayer(+v),
  maddpick(v) {
    const [ti, pid] = v.split(":");
    addToMatch(+ti, pid);
    M.closeModal();
    render();
  },

  /* ----- 선수 ----- */
  newplayer: () => M.openNewPlayer(),
  async ppos(v) {
    const [pid, r] = v.split(":");
    const pos = [...(P(pid).pos || [])];
    const i = pos.indexOf(r);
    i >= 0 ? pos.splice(i, 1) : pos.push(r);
    await api.putPlayer({ ...P(pid), pos });
    M.openPlayer(pid);
    render();
  },
  async pregular(v) {
    await api.putPlayer({ ...P(v), regular: !P(v).regular });
    M.openPlayer(v);
    render();
  },
  attendregulars() {
    const l = lineup();
    const ids = Object.values(S.players).filter((p) => p.regular && !l.attendees.includes(p.id)).map((p) => p.id);
    l.attendees.push(...ids);
    commitLineup();
    toast(`고정 참여 ${ids.length}명 추가했어요`);
  },
  async pskill(v) {
    const [pid, n] = v.split(":");
    await api.putPlayer({ ...P(pid), skill: +n });
    M.openPlayer(pid);
    render();
  },
  async psave(v) {
    const n = $("#pnm").value.trim();
    if (!n) return;
    const ex = findByName(n);
    if (ex && ex.id !== v) return toast("이미 있는 이름이에요");
    await api.putPlayer({ ...P(v), name: n });
    M.closeModal();
    render();
    toast("저장했어요");
  },
  async pdel(v) {
    const used = Object.values(S.matches).some((m) => m.teams.some((T) => (T.players || []).includes(v)));
    if (!confirm(used ? "경기 기록에 있는 선수예요. 삭제하면 기록에 '(삭제됨)'으로 보여요. 삭제할까요?" : "이 선수를 삭제할까요?")) return;
    const l = lineup();
    removeFrom(locate(v), v);
    l.attendees = l.attendees.filter((x) => x !== v);
    api.putLineup();
    await api.delPlayer(v);
    M.closeModal();
    render();
  },
  sort(v) {
    S.ui.sort = v;
    render();
  },
  period(v) {
    S.ui.period = v;
    render();
  },

  /* ----- 설정 · 공유 · 백업 ----- */
  connect() {
    const cfg = parseConfig($("#cfg").value);
    const gid = ($("#gid").value || "my-team").trim().replace(/[^A-Za-z0-9_\-]/g, "") || "my-team";
    if (!cfg) return toast("설정값에서 apiKey와 projectId를 찾지 못했어요");
    saveCfg(cfg, gid);
    location.reload();
  },
  disconnect() {
    if (!confirm("이 폰에서 서버 연결을 해제할까요? 서버의 기록은 지워지지 않아요.")) return;
    clearCfg();
    location.reload();
  },
  share: () => copyText(shareLink()),
  async logout() {
    await logout();
    M.openSettings();
  },
  async googlelogin() {
    try {
      await loginGoogle();
      toast("로그인했어요");
    } catch (e) {
      console.error(e);
      toast(e.code === "auth/unauthorized-domain" ? "이 주소가 Firebase 승인된 도메인에 없어요 (README 참고)" : e.code === "auth/popup-closed-by-user" ? "로그인을 취소했어요" : "로그인 실패: " + (e.code || e.message));
    }
  },
  async claimowner() {
    try {
      await claimOwner();
      toast("관리자로 등록했어요");
      setTimeout(M.openSettings, 400);
    } catch (e) {
      toast(e.code === "permission-denied" ? "firestore.rules에 적은 관리자 이메일이 아니에요" : "실패: " + (e.code || e.message));
    }
  },
  async recdel(v) {
    if (!confirm(`${M.maskEmail(v)}을(를) 기록자에서 뺄까요?`)) return;
    await setRecorders((S.recorders.emails || []).filter((x) => x !== v)).catch((e) => toast("실패: " + e.code));
    M.openSettings();
  },
  async upload() {
    const d = loadLocal();
    const np = Object.keys(d.players).length, nm = Object.keys(d.matches).length;
    if (!(np + nm)) return toast("이 폰에 저장된 기록이 없어요");
    if (!confirm(`이 폰의 선수 ${np}명, 경기 ${nm}개를 서버로 합칠까요?`)) return;
    await mergeData(d);
    render();
    toast("서버로 올렸어요");
  },
  export: () => exportBackup(),
  import: () => importBackup(render),
};

function openMatch(id) {
  S.ui.tab = "matches";
  S.ui.matchId = id;
  render();
  window.scrollTo(0, 0);
}

/* ----- 폼 제출 ----- */
const forms = {
  addnames(f) {
    const names = parseNames(f.n.value);
    if (!names.length) return;
    const l = lineup();
    let added = 0;
    names.forEach((n) => {
      const p = ensurePlayer(n);
      if (p && !l.attendees.includes(p.id)) {
        l.attendees.push(p.id);
        added++;
      }
    });
    commitLineup();
    toast(`${added}명 추가했어요`);
    setTimeout(() => $('form[data-act="addnames"] input')?.focus(), 30);
  },
  maddname(f) {
    const p = ensurePlayer(f.n.value);
    if (!p) return;
    addToMatch(+f.dataset.v, p.id);
    M.closeModal();
    render();
  },
  newplayer(f) {
    const p = ensurePlayer(f.n.value);
    if (!p) return;
    render();
    M.openPlayer(p.id);
  },
  rosteradd(f) {
    const names = parseNames(f.n.value);
    names.forEach((n) => {
      const p = ensurePlayer(n);
      if (p && !p.regular) api.putPlayer({ ...p, regular: true });
    });
    M.openRoster();
    render();
    setTimeout(() => $('form[data-act="rosteradd"] input')?.focus(), 30);
  },
  async recadd(f) {
    const email = f.n.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("이메일 형식을 확인하세요");
    try {
      await setRecorders([...(S.recorders.emails || []), email]);
      toast("기록자를 추가했어요");
      S.ui.recordersOpen = true;
      M.openSettings();
    } catch (e) {
      toast("실패: " + (e.code || e.message));
    }
  },
  async login(f) {
    try {
      await login(f.e.value.trim(), f.p.value);
      M.closeModal();
      toast("로그인했어요");
    } catch {
      toast("로그인 실패: 이메일/비밀번호를 확인하세요");
    }
  },
};

/* ----- 값 변경 (select, input) ----- */
const changes = {
  size(el) {
    const l = lineup();
    l.size = +el.value;
    l.formation = FORMATIONS[l.size][0];
    relayoutAll();
    commitLineup();
  },
  formation(el) {
    lineup().formation = el.value;
    relayoutAll();
    commitLineup();
  },
  referee(el) {
    lineup().referee = el.value.trim();
    api.putLineup();
  },
  teamname(el) {
    const T = lineup().teams[S.ui.team];
    T.name = el.value.trim() || T.name;
    commitLineup();
  },
};

export function bindEvents() {
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "FORM") return;
    const act = el.dataset.act;
    if (act === "maskclose") {
      if (e.target === el) M.closeModal();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (EDIT_ONLY.has(act) && !S.canEdit) return toast("보기 전용이에요");
    const fn = actions[act];
    if (fn) await fn(el.dataset.v);
  });

  document.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const fn = forms[f.dataset.act];
    if (!fn) return;
    if (!["login", "recadd"].includes(f.dataset.act) && !S.canEdit) return toast("보기 전용이에요");
    await fn(f);
    if (f.n) f.n.value = "";
  });

  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-chg]");
    if (!el || !S.canEdit) return;
    const k = el.dataset.chg;
    if (k.startsWith("m.")) {
      updateMatchField(k.slice(2), el.value.trim());
      render();
    } else changes[k]?.(el);
  });

  // 사진 인식 결과에서 이름 고치기 (다시 그리지 않고 그 자리에서 표시만 바꿔요)
  document.addEventListener("input", (e) => {
    const oi = e.target.closest("[data-ocr-i]");
    if (!oi || !S.ui.ocr) return;
    const i = +oi.dataset.ocrI;
    const r = S.ui.ocr.rows[i];
    r.name = oi.value.trim();
    r.existingId = findByName(r.name)?.id || null;
    const tag = document.getElementById("ocrtag-" + i);
    if (tag) tag.outerHTML = M.ocrTag(r, i);
    M.updateOcrCount();
  });

  // 카톡 투표 결과처럼 여러 줄을 붙여넣으면 이름만 뽑아서 넣기
  document.addEventListener("paste", (e) => {
    const inp = e.target.closest?.('form[data-act="addnames"] input, form[data-act="rosteradd"] input');
    if (!inp) return;
    const t = e.clipboardData.getData("text");
    if (!t.includes("\n")) return;
    e.preventDefault();
    inp.value = parseNames(t).join(", ");
  });

  // 접었다 펼친 상태 기억 (설정 창이 새로 그려져도 유지)
  document.addEventListener("toggle", (e) => {
    const k = e.target.dataset?.actToggle;
    if (k) S.ui[k] = e.target.open;
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($("#modal").innerHTML) M.closeModal();
    else if (S.ui.sel) actions.unsel();
  });
}
