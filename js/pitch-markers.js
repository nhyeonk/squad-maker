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
  };
}

export function positionPitchMarker(slot, point, { width, height }, pad, preset = false) {
  const top = topLeft.y * height / 100;
  const bottom = bottomLeft.y * height / 100;
  const minY = top + pad.top;
  const maxY = bottom - pad.bottom;
  const rawY = point.y * height / 100;
  // 기본 포메이션은 줄 간격을 유지하고, 직접 옮긴 자리는 선을 넘을 때만 보정해요.
  const y = preset && minY <= maxY
    ? minY + (maxY - minY) * clamp((rawY - top) / (bottom - top), 0, 1)
    : clamp(rawY, minY, maxY);
  const ratio = clamp((y - pad.top - top) / (bottom - top), 0, 1);
  const edge = (topLeft.x + (bottomLeft.x - topLeft.x) * ratio) * width / 100;
  const x = clamp(point.x * width / 100, edge + pad.left, width - edge - pad.right);
  const fitted = { x: x / width * 100, y: y / height * 100 };
  slot.style.setProperty("--slot-display-x", `${fitted.x}%`);
  slot.style.setProperty("--slot-display-y", `${fitted.y}%`);
  return fitted;
}

function fitPitchMarkers(pitch) {
  const size = pitch.getBoundingClientRect();
  if (!size.width || !size.height) return;
  const markers = [...pitch.querySelectorAll('.slot:not([data-drag="0"]):not(.dragging)')];
  const insets = markers.map(pitchMarkerInsets);
  markers.forEach((slot, i) => positionPitchMarker(slot, {
    x: parseFloat(slot.style.getPropertyValue("--slot-x")),
    y: parseFloat(slot.style.getPropertyValue("--slot-y")),
  }, size, insets[i], !slot.hasAttribute("data-moved")));
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
