// FC온라인 스쿼드 메이커의 필드·골키퍼 구역을 앱의 % 좌표로 옮겨요.
const BOARD_WIDTH = 845;
const FIELD_HEIGHT = 445;
const BOARD_HEIGHT = 534;
const SIDE_INSET = 105;
const TOP_SPACE = 12;
const BOARD_SPAN = 84;
const SWITCH_MARGIN = 18; // 공식 보드 좌표에서의 거리 차이
const SW_CENTER_BAND = 35.49;
const DEFENSE_ORDER = { CB: 0, RCB: 1, LCB: 2, SW: 3 };

function project(x, y) {
  const inset = SIDE_INSET * (1 - Math.max(0, Math.min(100, y)) / 100);
  return { x: inset + (BOARD_WIDTH - 2 * inset) * x / 100, y: FIELD_HEIGHT * y / 100 };
}

function toPercent({ x, y }) {
  return { x: x / BOARD_WIDTH * 100, y: TOP_SPACE + y / BOARD_HEIGHT * BOARD_SPAN };
}

function toBoard({ x, y }) {
  return { x: x / 100 * BOARD_WIDTH, y: (y - TOP_SPACE) / BOARD_SPAN * BOARD_HEIGHT };
}

export const pitchPosition = (x, y) => toPercent(project(x, y));
export function clampFieldPosition(point) {
  const fieldY = Math.max(0, Math.min(100, toBoard(point).y / FIELD_HEIGHT * 100));
  const left = pitchPosition(5, fieldY);
  const right = pitchPosition(95, fieldY);
  return { x: Math.max(left.x, Math.min(right.x, point.x)), y: left.y };
}

export const pitchDistance = (a, b) => {
  const p = toBoard(a), q = toBoard(b);
  return Math.hypot(p.x - q.x, p.y - q.y);
};

/** [포지션, 왼쪽, 위, 오른쪽, 아래] (필드 %). GK는 필드 아래 별도 구역. */
const BOUNDS = [
  ["SW", 35, 80, 65, 100],
  ["RWB", 75, 60, 95, 100], ["RB", 75, 77, 95, 100],
  ["RCB", 50, 80, 75, 100], ["CB", 25, 80, 75, 100], ["LCB", 25, 80, 50, 100],
  ["LB", 5, 77, 25, 100], ["LWB", 5, 60, 25, 100],
  ["RDM", 50, 55, 75, 75], ["CDM", 25, 55, 75, 80], ["LDM", 25, 55, 50, 75],
  ["RM", 75, 30, 95, 60], ["RCM", 50, 40, 75, 60], ["CM", 25, 40, 75, 60],
  ["LCM", 25, 40, 50, 60], ["LM", 5, 30, 25, 60],
  ["RAM", 50, 25, 85, 45], ["CAM", 25, 25, 75, 45], ["LAM", 15, 25, 50, 45],
  ["RF", 50, 15, 75, 35], ["CF", 25, 10, 75, 30], ["LF", 25, 15, 50, 35],
  ["RW", 75, 0, 95, 35], ["RS", 50, 0, 75, 15], ["ST", 25, 0, 75, 15],
  ["LS", 25, 0, 50, 15], ["LW", 5, 0, 25, 35], ["GK", 30, 105, 70, 120],
];

export const PITCH_ZONES = Object.fromEntries(BOUNDS.map(([label, left, top, right, bottom]) => {
  const corners = [[left, top], [right, top], [right, bottom], [left, bottom]];
  const center = project((left + right) / 2, (top + bottom) / 2);
  const points = corners.map(([x, y]) => {
    const p = pitchPosition(x, y);
    return `${p.x},${p.y}`;
  }).join(" ");
  return [label, { label, left, top, right, bottom, center, points }];
}));

export const pitchZoneCenter = (label) => toPercent(PITCH_ZONES[label].center);

/** 겹치는 다각형은 가까운 중심을 우선하되, 드래그 중에는 이전 구역을 잠깐 유지해요. */
export function pitchZoneAt(point, { previous, occupied, goalkeeper = false, fallback = false } = {}) {
  const p = toBoard(point);
  const fieldY = p.y / FIELD_HEIGHT * 100;
  const leftEdge = project(0, fieldY).x;
  const fieldX = (p.x - leftEdge) / (BOARD_WIDTH - 2 * leftEdge) * 100;
  const zones = Object.values(PITCH_ZONES).filter(({ label }) =>
    (label !== "GK" || goalkeeper) && (label !== "SW" || occupied?.has("CB")));
  const inside = zones.filter((z) => fieldX >= z.left && fieldX < z.right && fieldY >= z.top && fieldY < z.bottom);
  const candidates = inside.length || !fallback ? inside : zones;
  if (!candidates.length) return null;

  const distance = (zone) => Math.hypot(p.x - zone.center.x, p.y - zone.center.y);
  let sweepPriority;
  if (inside.includes(PITCH_ZONES.SW) && inside.includes(PITCH_ZONES.CB)) {
    sweepPriority = Math.abs(p.x - PITCH_ZONES.SW.center.x) <= SW_CENTER_BAND ? "SW" : "CB";
  }
  const sorted = candidates.sort((a, b) => distance(a) - distance(b) ||
    Number(b.label === sweepPriority) - Number(a.label === sweepPriority) ||
    Number(b.label === previous) - Number(a.label === previous) ||
    (DEFENSE_ORDER[a.label] ?? 99) - (DEFENSE_ORDER[b.label] ?? 99));
  const closest = sorted[0];
  const current = inside.find((z) => z.label === previous);
  return current && distance(current) - distance(closest) <= SWITCH_MARGIN ? current : closest;
}
