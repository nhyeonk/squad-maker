// 인원별 포메이션과 경기장 위 자리 좌표
import { pitchZoneCenter } from "./pitch-zones.js";

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

// 11인 포메이션은 저장된 슬롯 순서(뒤에서 앞으로, 왼쪽에서 오른쪽)를 유지해요.
const FORMATION_POSITIONS = {
  "4-4-2": ["LB", "LCB", "RCB", "RB", "LM", "LCM", "RCM", "RM", "LS", "RS"],
  "4-3-3": ["LB", "LCB", "RCB", "RB", "LCM", "CM", "RCM", "LW", "ST", "RW"],
  "4-2-3-1": ["LB", "LCB", "RCB", "RB", "LDM", "RDM", "LAM", "CAM", "RAM", "ST"],
  "4-1-4-1": ["LB", "LCB", "RCB", "RB", "CDM", "LM", "LCM", "RCM", "RM", "ST"],
  "5-3-2": ["LWB", "LCB", "CB", "RCB", "RWB", "LCM", "CM", "RCM", "LS", "RS"],
  "3-4-3": ["LB", "CB", "RB", "LM", "LCM", "RCM", "RM", "LW", "ST", "RW"],
};

/**
 * 포메이션의 자리 목록. 좌표는 % (x: 왼→오, y: 위=공격 방향)
 * @returns {{role:"GK"|"DF"|"MF"|"FW", label:string, x:number, y:number}[]}
 */
export function formationSlots(size, formation) {
  const slots = [{ role: "GK", label: "GK", ...pitchZoneCenter("GK") }];
  const preset = size === 11 ? FORMATION_POSITIONS[formation] : null;
  if (preset) return slots.concat(preset.map((label) => ({ role: roleOfLabel(label), label, ...pitchZoneCenter(label) })));
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

    for (const label of LABELS[key][n]) slots.push({ role, label, ...pitchZoneCenter(label) });
  });
  return slots;
}
