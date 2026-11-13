// 인원별 포메이션과 경기장 위 자리 좌표

/** 인원(골키퍼 포함) → 고를 수 있는 포메이션 (필드 플레이어 라인, 뒤에서 앞으로) */
export const FORMATIONS = {
  3: ["1-1", "2"],
  4: ["2-1", "1-2", "1-1-1"],
  5: ["1-2-1", "2-2", "2-1-1", "3-1"],
  6: ["2-2-1", "2-1-2", "3-1-1", "1-2-2"],
  7: ["2-3-1", "3-2-1", "3-1-2", "2-2-2"],
  8: ["3-3-1", "3-2-2", "2-3-2", "2-4-1"],
  9: ["3-3-2", "3-4-1", "4-3-1", "3-2-3"],
  10: ["4-3-2", "3-4-2", "4-4-1", "3-3-3"],
  11: ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "4-1-4-1", "5-3-2", "3-4-3"],
};

/** 이 인원 이하는 풋살 코트로 그려요 */
export const FUTSAL_MAX = 6;

export const POS = ["GK", "DF", "MF", "FW"];
export const POS_KO = { GK: "골키퍼", DF: "수비", MF: "미드", FW: "공격" };
export const POS_COLOR = { FW: "#e5484d", MF: "#30a46c", DF: "#3e63dd", GK: "#f0b400" };

const LABELS = {
  DF: { 1: ["CB"], 2: ["LCB", "RCB"], 3: ["LCB", "CB", "RCB"], 4: ["LB", "LCB", "RCB", "RB"], 5: ["LWB", "LCB", "CB", "RCB", "RWB"] },
  MF: { 1: ["CM"], 2: ["LCM", "RCM"], 3: ["LCM", "CM", "RCM"], 4: ["LM", "LCM", "RCM", "RM"], 5: ["LM", "LCM", "CM", "RCM", "RM"] },
  DM: { 1: ["CDM"], 2: ["LDM", "RDM"], 3: ["LDM", "CDM", "RDM"] },
  AM: { 1: ["CAM"], 2: ["LAM", "RAM"], 3: ["LAM", "CAM", "RAM"] },
  FW: { 1: ["ST"], 2: ["LS", "RS"], 3: ["LW", "ST", "RW"], 4: ["LW", "LS", "RS", "RW"] },
};

/** 고를 수 있는 포지션 이름 (모두 대문자) */
export const POSITION_GROUPS = {
  FW: ["LW", "LF", "LS", "ST", "CF", "SS", "RS", "RF", "RW"],
  MF: ["LAM", "CAM", "RAM", "LM", "LCM", "CM", "RCM", "RM", "LDM", "CDM", "RDM"],
  DF: ["LWB", "LB", "LCB", "CB", "RCB", "RB", "RWB", "SW"],
  GK: ["GK"],
};
/** 선수 선호 포지션에서 고를 수 있는 세부 포지션 (공격/미드/수비 버튼을 누르면 나와요) */
export const PREF_DETAIL = {
  FW: ["LW", "ST", "CF", "RW", "SS"],
  MF: ["CAM", "LM", "CM", "RM", "CDM"],
  DF: ["LB", "LWB", "CB", "RB", "RWB"],
  GK: [],
};
const ROLE_OF = {};
for (const [role, list] of Object.entries(POSITION_GROUPS)) list.forEach((l) => (ROLE_OF[l] = role));
export const roleOfLabel = (label) => ROLE_OF[String(label).toUpperCase()] || "MF";

/** 자리를 옮기면 가장 가까운 기준점의 이름으로 바뀌어요 (x: 왼→오, y: 위=공격) */
const ANCHORS = [
  ["LW", 15, 20], ["RW", 85, 20], ["ST", 50, 13], ["LS", 37, 16], ["RS", 63, 16], ["SS", 50, 27], ["LF", 27, 22], ["RF", 73, 22],
  ["LAM", 28, 35], ["CAM", 50, 36], ["RAM", 72, 35],
  ["LM", 12, 48], ["LCM", 34, 49], ["CM", 50, 48], ["RCM", 66, 49], ["RM", 88, 48],
  ["LDM", 36, 61], ["CDM", 50, 61], ["RDM", 64, 61],
  ["LWB", 10, 63], ["RWB", 90, 63], ["LB", 13, 74], ["RB", 87, 74],
  ["LCB", 34, 76], ["CB", 50, 77], ["RCB", 66, 76], ["SW", 50, 84], ["GK", 50, 92],
];
export function nearestLabel(x, y) {
  let best = "CM", bd = Infinity;
  for (const [l, ax, ay] of ANCHORS) {
    const d = (ax - x) ** 2 + ((ay - y) * 1.3) ** 2; // 세로 차이를 조금 더 크게 봐요
    if (d < bd) [best, bd] = [l, d];
  }
  return best;
}

/**
 * 포메이션의 자리 목록. 좌표는 % (x: 왼→오, y: 위=공격 방향)
 * @returns {{role:"GK"|"DF"|"MF"|"FW", label:string, x:number, y:number}[]}
 */
export function formationSlots(size, formation) {
  const slots = [{ role: "GK", label: "GK", x: 50, y: 91 }];
  const lines = formation.split("-").map(Number);
  const L = lines.length;

  lines.forEach((n, i) => {
    let role, key;
    if (L === 1) [role, key] = ["MF", "MF"];
    else if (i === 0) [role, key] = ["DF", "DF"];
    else if (i === L - 1) [role, key] = ["FW", "FW"];
    else {
      role = "MF";
      // 미드필드 라인이 2줄 이상이면 뒤쪽은 수비형(DM), 앞쪽은 공격형(AM)
      const firstMid = i === 1, lastMid = i === L - 2;
      key = L >= 4 && n <= 3 ? (firstMid ? "DM" : lastMid ? "AM" : "MF") : "MF";
    }

    const labels = (LABELS[key][n] || Array(n).fill(role)).slice();

    const y = L === 1 ? 52 : 74 - i * (56 / (L - 1));
    for (let j = 0; j < n; j++) {
      const x = n === 1 ? 50 : n === 2 ? (j ? 70 : 30) : 14 + j * (72 / (n - 1));
      slots.push({ role, label: labels[j] || role, x, y });
    }
  });
  return slots;
}
