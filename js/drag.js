// 끌어서 옮기기 (마우스·터치)
// 1) 경기장 위 선수 동그라미: 자리 이동, 맞교환, 경기장 밖(대기 명단·후보·팀 카드)으로 끌어내기
// 2) 대기 명단·후보·팀 명단의 선수 이름: 경기장이나 다른 곳으로 끌어오기 (폰은 살짝 길게 눌러서)
import { S, P, lineup } from "./state.js";
import { movePlayer, currentSlots, setSlotLayout } from "./lineup.js";
import { roleOfLabel } from "./formations.js";
import { clampFieldPosition, pitchDistance, pitchZoneAt, PITCH_ZONES } from "./pitch-zones.js";
import { render, commitLineup } from "./render.js";

/* ---------- 경기장: 끌어서 옮기기 / 빈 잔디 눌러서 옮기기 ---------- */
const clamp = (v) => Math.max(4, Math.min(96, v));
export function pitchPoint(e, offset, r = document.getElementById("pitch").getBoundingClientRect()) {
  return {
    x: clamp(((e.clientX - r.left) / r.width) * 100 - (offset?.x ?? 0)),
    y: clamp(((e.clientY - r.top) / r.height) * 100 - (offset?.y ?? 0)),
  };
}

function pitchDropAt(point, { skip = -1, previous, goalkeeper = false, fallback = false } = {}) {
  const t = S.ui.team;
  const slots = currentSlots(t);
  const T = lineup().teams[t];
  const targets = slots.map((slot, i) => ({ i, slot, distance: pitchDistance(slot, point) }))
    .filter(({ i }) => i !== skip && (i !== 0 || goalkeeper))
    .sort((a, b) => a.distance - b.distance);
  const occupied = new Set(targets.map(({ slot }) => slot.label));
  const zone = pitchZoneAt(point, { previous, goalkeeper, occupied, fallback });
  const nearby = targets[0]?.distance <= 30 ? targets[0] : null;
  const destination = nearby || (zone && targets.find(({ i, slot }) => T.slots[i] && slot.label === zone.label));
  if (destination) {
    const label = destination.slot.label;
    return { zone: PITCH_ZONES[label] ?? zone, label, slotIdx: destination.i };
  }
  if (goalkeeper && zone?.label === "GK") return { zone, label: "GK", slotIdx: 0 };
  return { zone, label: zone?.label, slotIdx: -1 };
}

function showPitchZone(zone) {
  const polygon = document.querySelector("[data-position-zone]");
  if (!polygon) return;
  if (zone) {
    polygon.setAttribute("points", zone.points);
    polygon.setAttribute("data-position-zone", zone.label);
  }
  polygon.parentElement.toggleAttribute("hidden", !zone);
}

function savePitchPosition(team, slot, point, label) {
  setSlotLayout(team, slot, { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10, label });
}

/** 자리를 옮기거나, 가리킨 포지션의 선수와 맞교환해요. */
export function dropSlot(slotIdx, pt, previous) {
  if (slotIdx === 0) return; // GK 자리는 고정, 선수 교체는 슬롯 선택으로 가능
  const t = S.ui.team;
  const point = clampFieldPosition(pt);
  const target = pitchDropAt(point, { skip: slotIdx, previous, fallback: true });
  const near = target.slotIdx;
  const T = lineup().teams[t];
  if (near >= 0) {
    // 자리끼리 선수 맞교환
    const a = T.slots[slotIdx], b = T.slots[near];
    if (b) T.slots[slotIdx] = b; else delete T.slots[slotIdx];
    if (a) T.slots[near] = a; else delete T.slots[near];
  } else {
    savePitchPosition(t, slotIdx, point, target.label);
  }
  commitLineup();
}

let drag = null;
let suppressClick = false;
export const clickSuppressed = () => suppressClick;

/** 끄는 동안 화면 가장자리에 가까우면 자동 스크롤 */
function edgeScroll(e) {
  if (e.clientY > innerHeight - 70) scrollBy(0, 14);
  else if (e.clientY < 70) scrollBy(0, -14);
}
/** 손가락/마우스 아래에 있는 놓을 곳 찾기 (끌고 있는 요소는 빼고) */
function dropTargetAt(e, ...hide) {
  hide.forEach((h) => h && (h.style.visibility = "hidden"));
  const under = document.elementFromPoint(e.clientX, e.clientY);
  hide.forEach((h) => h && (h.style.visibility = ""));
  return under;
}
function markDropOver(under) {
  document.querySelectorAll(".dropover").forEach((el) => el.classList.remove("dropover"));
  under?.closest("[data-drop], [data-pdrag]")?.classList.add("dropover");
}
/** 경기장 밖(대기 명단·후보·팀 카드·다른 선수)에 놓았을 때 처리. 처리했으면 true */
function dropOutside(pid, under) {
  if (!pid || !under) return false;
  const other = under.closest("[data-pdrag]")?.dataset.pdrag;
  const zone = under.closest("[data-drop]")?.dataset.drop;
  if (other && other !== pid) movePlayer(pid, { kind: "player", pid: other });
  else if (zone === "bench") movePlayer(pid, { kind: "bench", team: S.ui.team });
  else if (zone === "pool") movePlayer(pid, { kind: "pool" });
  else if (zone?.startsWith("team:")) movePlayer(pid, { kind: "team", team: +zone.slice(5) });
  else return false;
  return true;
}

function bindPitchDrag() {
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-drag]");
    if (!el || !S.canEdit || e.button > 0) return;
    const idx = +el.dataset.drag;
    if (idx === 0) return;
    const pid = lineup().teams[S.ui.team].slots[idx] || null;
    const slot = currentSlots()[idx];
    const pitchRect = document.getElementById("pitch").getBoundingClientRect();
    const box = el.getBoundingClientRect();
    // 가장자리에서는 화면에 표시된 위치를 기준으로 잡은 지점을 유지해요.
    const offset = {
      x: (e.clientX - (box.left + box.width / 2)) / pitchRect.width * 100,
      y: (e.clientY - (box.top + box.height / 2)) / pitchRect.height * 100,
    };
    drag = { el, idx, pid, sx: e.clientX, sy: e.clientY, moving: false, id: e.pointerId,
      ox: el.style.getPropertyValue("--slot-x"), oy: el.style.getPropertyValue("--slot-y"), offset, previous: slot.label };
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moving && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
    if (!drag.moving) {
      drag.moving = true;
      drag.el.classList.add("dragging");
      try { drag.el.setPointerCapture(e.pointerId); } catch {}
      if (drag.pid) document.body.classList.add("pdragging");
    }
    e.preventDefault();
    edgeScroll(e);
    const r = document.getElementById("pitch").getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside || !drag.pid) {
      // 경기장 안: 동그라미가 따라와요
      drag.ghost?.remove();
      drag.ghost = null;
      drag.el.classList.remove("faded");
      markDropOver(null);
      const pt = pitchPoint(e, drag.offset, r);
      drag.el.style.setProperty("--slot-x", pt.x + "%");
      drag.el.style.setProperty("--slot-y", pt.y + "%");
      const target = pitchDropAt(pt, { skip: drag.idx, previous: drag.previous });
      drag.previous = target.label;
      showPitchZone(target.zone);
      const circle = drag.el.querySelector(".cir");
      if (circle && target.label) {
        const label = circle.querySelector(".rl") || circle;
        label.textContent = target.label;
        circle.className = `cir role-${roleOfLabel(target.label)}`;
      }
    } else {
      // 경기장 밖: 이름표가 따라오고, 동그라미는 제자리에 흐리게
      showPitchZone(null);
      if (!drag.ghost) {
        drag.ghost = document.createElement("div");
        drag.ghost.className = "dragghost";
        drag.ghost.textContent = P(drag.pid)?.name || "";
        document.body.appendChild(drag.ghost);
        drag.el.style.setProperty("--slot-x", drag.ox);
        drag.el.style.setProperty("--slot-y", drag.oy);
        drag.el.classList.add("faded");
      }
      drag.ghost.style.left = e.clientX + "px";
      drag.ghost.style.top = e.clientY + "px";
      markDropOver(dropTargetAt(e, drag.ghost));
    }
  }, { passive: false });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moving) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 60);
    document.body.classList.remove("pdragging");
    markDropOver(null);
    showPitchZone(null);
    if (d.ghost) {
      const under = dropTargetAt(e, d.ghost);
      d.ghost.remove();
      if (dropOutside(d.pid, under)) return commitLineup();
      return render(); // 놓을 곳이 아니면 제자리로
    }
    dropSlot(d.idx, pitchPoint(e, d.offset), d.previous);
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", (e) => {
    if (drag && e.pointerId === drag.id) {
      drag.ghost?.remove();
      drag = null;
      document.body.classList.remove("pdragging");
      render();
    }
  });
}

/* ---------- 대기 명단·후보·팀 명단에서 선수 끌어오기 ---------- */
/** 경기장 (x,y)에 선수 놓기: 가장 가까운 빈자리를 그 위치로 옮겨서 넣어요. 빈자리가 없으면 가장 가까운 선수와 교체 */
function dropPlayerOnPitch(pid, pt) {
  const t = S.ui.team;
  const T = lineup().teams[t];
  const slots = currentSlots(t);
  const point = clampFieldPosition(pt);
  const target = pitchDropAt(pt, { goalkeeper: true });
  if (target.slotIdx >= 0) return movePlayer(pid, { kind: "slot", team: t, slot: target.slotIdx });
  const label = target.label || pitchDropAt(point, { fallback: true }).label;
  const dist = (s) => pitchDistance(s, point);
  const outfield = slots.map((_, i) => i).slice(1);
  const empty = outfield.filter((i) => !T.slots[i]);
  if (empty.length) {
    const i = empty.sort((a, b) => dist(slots[a]) - dist(slots[b]))[0];
    movePlayer(pid, { kind: "slot", team: t, slot: i });
    savePitchPosition(t, i, point, label);
  } else {
    const i = outfield.sort((a, b) => dist(slots[a]) - dist(slots[b]))[0];
    movePlayer(pid, { kind: "slot", team: t, slot: i });
  }
}

let pdrag = null;
function bindPlayerDrag() {
  const start = (d, e) => {
    d.active = true;
    d.ghost = document.createElement("div");
    d.ghost.className = "dragghost";
    d.ghost.textContent = P(d.pid)?.name || "";
    document.body.appendChild(d.ghost);
    document.body.classList.add("pdragging");
    navigator.vibrate?.(15);
    move(e);
  };
  const move = (e) => {
    if (!pdrag?.ghost) return;
    edgeScroll(e);
    pdrag.ghost.style.left = e.clientX + "px";
    pdrag.ghost.style.top = e.clientY + "px";
    document.querySelectorAll(".dropover").forEach((el) => el.classList.remove("dropover"));
    pdrag.ghost.style.display = "none";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    pdrag.ghost.style.display = "";
    if (under?.closest("#pitch")) {
      const slot = under.closest("[data-drag]");
      const label = slot && currentSlots()[+slot.dataset.drag]?.label;
      const pt = pitchPoint(e);
      showPitchZone(PITCH_ZONES[label] ?? pitchDropAt(pt, { goalkeeper: true }).zone);
    } else {
      showPitchZone(null);
      under?.closest("[data-drop], [data-pdrag]")?.classList.add("dropover");
    }
  };
  const finish = (e) => {
    const d = pdrag;
    pdrag = null;
    clearTimeout(d.timer);
    if (!d.active) return;
    d.ghost.remove();
    document.body.classList.remove("pdragging");
    document.querySelectorAll(".dropover").forEach((el) => el.classList.remove("dropover"));
    showPitchZone(null);
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 60);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (!under) return render();
    const slotEl = under.closest("#pitch [data-drag]");
    if (slotEl) movePlayer(d.pid, { kind: "slot", team: S.ui.team, slot: +slotEl.dataset.drag });
    else if (under.closest("#pitch")) dropPlayerOnPitch(d.pid, pitchPoint(e));
    else if (!dropOutside(d.pid, under)) return render();
    commitLineup();
  };

  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-pdrag]");
    if (!el || !S.canEdit || e.button > 0 || e.target.closest(".x")) return;
    pdrag = { pid: el.dataset.pdrag, sx: e.clientX, sy: e.clientY, id: e.pointerId, touch: e.pointerType !== "mouse", active: false };
    // 폰: 살짝 길게 누르면 끌기 시작 (그냥 쓸면 스크롤)
    if (pdrag.touch) pdrag.timer = setTimeout(() => pdrag && !pdrag.active && start(pdrag, { clientX: pdrag.sx, clientY: pdrag.sy }), 250);
  });
  document.addEventListener("pointermove", (e) => {
    if (!pdrag || e.pointerId !== pdrag.id) return;
    const far = Math.hypot(e.clientX - pdrag.sx, e.clientY - pdrag.sy) > 8;
    if (!pdrag.active) {
      if (!far) return;
      if (pdrag.touch) { clearTimeout(pdrag.timer); pdrag = null; return; } // 길게 누르기 전에 움직이면 스크롤
      start(pdrag, e);
    }
    e.preventDefault();
    move(e);
  }, { passive: false });
  // 끄는 중에는 화면 스크롤 막기
  document.addEventListener("touchmove", (e) => { if (pdrag?.active) e.preventDefault(); }, { passive: false });
  document.addEventListener("pointerup", (e) => pdrag && e.pointerId === pdrag.id && finish(e));
  document.addEventListener("pointercancel", (e) => {
    if (!pdrag || e.pointerId !== pdrag.id) return;
    const d = pdrag;
    pdrag = null;
    clearTimeout(d.timer);
    if (d.active) { d.ghost.remove(); document.body.classList.remove("pdragging"); render(); }
  });
  // 길게 누를 때 뜨는 메뉴 막기
  document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-pdrag]") && S.canEdit) e.preventDefault(); });
}

export function bindDrag() {
  bindPitchDrag();
  bindPlayerDrag();
}
