import { pitchPosition, PITCH_TOUCHLINE } from "./pitch-zones.js";

const [topLeft, , , bottomLeft] = PITCH_TOUCHLINE.map(([x, y]) => pitchPosition(x, y));
const clamp = (value, min, max) => min <= max ? Math.max(min, Math.min(max, value)) : (min + max) / 2;

/** 아이콘이 드래그 중 커져도 숫자와 이름표까지 필드 선 안에 두어요. */
export function pitchMarkerInsets(slot) {
  const box = slot.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const circle = slot.querySelector(".cir");
  const ring = circle.getBoundingClientRect();
  const cx = ring.left + ring.width / 2;
  const cy = ring.top + ring.height / 2;
  const scale = 1.2 * circle.offsetWidth / ring.width;
  const badge = slot.querySelector(".nb")?.getBoundingClientRect();
  const name = slot.querySelector(".nm")?.getBoundingClientRect();
  const left = cx + (Math.min(ring.left, badge?.left ?? ring.left) - cx) * scale;
  const right = cx + (Math.max(ring.right, badge?.right ?? ring.right) - cx) * scale;
  const top = cy + (Math.min(ring.top, badge?.top ?? ring.top) - cy) * scale;
  const bottom = cy + (Math.max(ring.bottom, badge?.bottom ?? ring.bottom) - cy) * scale;
  return {
    left: x - Math.min(left, name?.left ?? left) + 2,
    right: Math.max(right, name?.right ?? right) - x + 2,
    top: y - Math.min(top, name?.top ?? top) + 2,
    bottom: Math.max(bottom, name?.bottom ?? bottom) - y + 2,
    circleOffsetY: y - cy,
  };
}

export function positionPitchMarker(slot, point, { width, height }, pad, goalkeeper = false) {
  const top = goalkeeper ? 0 : topLeft.y * height / 100;
  const bottom = goalkeeper ? height : bottomLeft.y * height / 100;
  const y = clamp(point.y * height / 100, top + pad.top, bottom - pad.bottom);
  const ratio = clamp((y - pad.top - top) / (bottom - top), 0, 1);
  const edge = goalkeeper ? 0 : (topLeft.x + (bottomLeft.x - topLeft.x) * ratio) * width / 100;
  const x = clamp(point.x * width / 100, edge + pad.left, width - edge - pad.right);
  const fitted = { x: x / width * 100, y: y / height * 100 };
  slot.style.setProperty("--slot-display-x", `${fitted.x}%`);
  slot.style.setProperty("--slot-display-y", `${fitted.y}%`);
  return fitted;
}

function fitPitchMarkers(pitch) {
  const size = pitch.getBoundingClientRect();
  if (!size.width || !size.height) return;
  const markers = [...pitch.querySelectorAll(".slot:not(.dragging)")];
  const insets = markers.map(pitchMarkerInsets);
  markers.forEach((slot, i) => {
    const x = parseFloat(slot.style.getPropertyValue("--slot-x"));
    const y = parseFloat(slot.style.getPropertyValue("--slot-y"));
    const pad = insets[i];
    // 기본 좌표에는 이름표를 제외한 동그라미의 중심을 맞춰요.
    const offset = slot.hasAttribute("data-moved") ? 0 : pad.circleOffsetY / size.height * 100;
    positionPitchMarker(slot, { x, y: y + offset }, size, pad, slot.dataset.drag === "0");
  });
}

const observer = typeof ResizeObserver === "function"
  ? new ResizeObserver((entries) => entries.forEach(({ target }) => fitPitchMarkers(target)))
  : null;

export function layoutPitchMarkers(pitch) {
  observer?.disconnect();
  if (!pitch) return;
  fitPitchMarkers(pitch);
  observer?.observe(pitch);
  const fonts = pitch.ownerDocument.fonts;
  if (fonts?.status === "loading") fonts.ready.then(() => {
    if (pitch.isConnected) fitPitchMarkers(pitch);
  });
}
