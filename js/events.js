// 버튼·입력 이벤트 처리
// HTML의 data-act="이름" 버튼을 누르면 아래 actions["이름"]이 실행돼요. (data-v 값이 v로 들어와요)
import { S, P, lineup, defaultLineup, mkTeam } from "./state.js";
import { api, parseConfig, saveCfg, clearCfg, shareLink, login, logout, loginGoogle, claimOwner, setRecorders, loadLocal, requestAccess, cancelRequest, approveRequest, rejectRequest } from "./store.js";
import { FORMATIONS } from "./formations.js";
import { ensurePlayer, findByName, parseNames } from "./players.js";
import { recognizeNames } from "./ocr.js";
import { locate, removeFrom, movePlayer, autoPlace, relayoutAll, balanceSplit, fillEmpty, teamPlayers, poolList, currentSlots, setSlotLayout, resetSlotLayout } from "./lineup.js";
import { nearestLabel } from "./formations.js";
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
  "posopen", "posset", "posreset", "ppos", "pskill", "psave", "pdel", "newplayer", "upload", "import", "ocr", "ocrapply", "pregular", "attendregulars", "rostertoggle",
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
  /* ----- 포지션 직접 바꾸기 ----- */
  posopen: (v) => M.openPosPicker(+v),
  posset(v) {
    const [i, label] = v.split(":");
    const s = currentSlots()[+i];
    setSlotLayout(S.ui.team, +i, { x: s.x, y: s.y, label });
    M.closeModal();
    commitLineup();
  },
  posreset(v) {
    resetSlotLayout(S.ui.team, +v);
    M.closeModal();
    commitLineup();
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
    lineup().teams.forEach((T, i) => {
      T.layout = {};
      autoPlace(i, teamPlayers(T).filter(P));
    });
    commitLineup();
    toast("포메이션 기본 자리에 선호 포지션대로 다시 배치했어요");
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
    // 카톡·네이버·인스타 같은 앱 안 브라우저에서는 구글이 로그인을 막아요 → 기본 브라우저로 열기
    const ua = navigator.userAgent;
    if (/KAKAOTALK/i.test(ua)) {
      location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
      return;
    }
    if (/NAVER|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) {
      return toast("이 앱 안에서는 구글 로그인이 안 돼요. 오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.");
    }
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
  async reqsend() {
    try {
      await requestAccess();
      toast("기록자 신청을 보냈어요");
    } catch (e) {
      toast("신청 실패: " + (e.code || e.message));
    }
  },
  async reqcancel() {
    await cancelRequest().catch((e) => toast("실패: " + e.code));
  },
  async reqok(v) {
    const r = S.requests.find((x) => x.uid === v);
    try {
      await approveRequest(v);
      toast(`${r?.name || "신청자"}님을 기록자로 승인했어요`);
    } catch (e) {
      toast("실패: " + (e.code || e.message));
    }
  },
  async reqno(v) {
    const r = S.requests.find((x) => x.uid === v);
    if (!confirm(`${r?.name || "이 사람"}의 신청을 거절할까요?`)) return;
    await rejectRequest(v).catch((e) => toast("실패: " + e.code));
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

/* ---------- 경기장: 끌어서 옮기기 / 빈 잔디 눌러서 옮기기 ---------- */
const clamp = (v) => Math.max(4, Math.min(96, v));
function pitchPoint(e) {
  const r = document.getElementById("pitch").getBoundingClientRect();
  return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
}
/** 자리를 (x,y)로 옮기기. 다른 자리 가까이 놓으면 그 자리 선수와 맞교환 */
function dropSlot(slotIdx, pt) {
  const t = S.ui.team;
  const slots = currentSlots(t);
  const near = slots.findIndex((s, i) => i !== slotIdx && Math.hypot(s.x - pt.x, (s.y - pt.y) * 0.68) < 6);
  const T = lineup().teams[t];
  if (near >= 0) {
    // 자리끼리 선수 맞교환
    const a = T.slots[slotIdx], b = T.slots[near];
    if (b) T.slots[slotIdx] = b; else delete T.slots[slotIdx];
    if (a) T.slots[near] = a; else delete T.slots[near];
  } else {
    setSlotLayout(t, slotIdx, { x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10, label: nearestLabel(pt.x, pt.y) });
  }
  commitLineup();
}

let drag = null, suppressClick = false;
function bindPitchDrag() {
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-drag]");
    if (!el || !S.canEdit || e.button > 0) return;
    drag = { el, idx: +el.dataset.drag, sx: e.clientX, sy: e.clientY, moving: false, id: e.pointerId };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moving && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
    if (!drag.moving) {
      drag.moving = true;
      drag.el.classList.add("dragging");
      try { drag.el.setPointerCapture(e.pointerId); } catch {}
    }
    e.preventDefault();
    const pt = pitchPoint(e);
    drag.el.style.left = pt.x + "%";
    drag.el.style.top = pt.y + "%";
    const lab = drag.el.querySelector(".rl") || drag.el.querySelector(".cir");
    if (lab) lab.textContent = nearestLabel(pt.x, pt.y);
  }, { passive: false });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moving) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 50);
    dropSlot(d.idx, pitchPoint(e));
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", (e) => {
    if (drag && e.pointerId === drag.id) {
      drag = null;
      render();
    }
  });
}

export function bindEvents() {
  bindPitchDrag();
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.tagName === "FORM") return;
    if (suppressClick) return;
    const act = el.dataset.act;
    // 빈 잔디 누르기: 선택한 선수(이 팀 경기장 위)를 그 자리로 옮겨요
    if (act === "pitch") {
      const loc = S.ui.sel && locate(S.ui.sel);
      if (S.canEdit && loc?.kind === "slot" && loc.team === S.ui.team) dropSlot(loc.slot, pitchPoint(e));
      return;
    }
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
    if (!el) return;
    if (el.dataset.chg === "badge") {
      // 보기 설정이라 보기 전용이어도 바꿀 수 있어요 (이 폰에만 저장)
      S.ui.badge = el.value;
      try { localStorage.setItem("squadmaker_badge", el.value); } catch {}
      return render();
    }
    if (!S.canEdit) return;
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
