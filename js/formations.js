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
  DM: { 1: ["DM"], 2: ["LDM", "RDM"], 3: ["LDM", "DM", "RDM"] },
  FW: { 1: ["ST"], 2: ["LS", "RS"], 3: ["LW", "ST", "RW"], 4: ["LW", "LS", "RS", "RW"] },
};

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
    else [role, key] = ["MF", L >= 4 && i === 1 && n <= 3 ? "DM" : "MF"];

    let labels = (LABELS[key][n] || Array(n).fill(role)).slice();
    if (size === 5 && formation === "1-2-1") {
      labels = role === "DF" ? ["FIXO"] : role === "FW" ? ["PIVO"] : ["L-ALA", "R-ALA"];
    }

    const y = L === 1 ? 52 : 74 - i * (56 / (L - 1));
    for (let j = 0; j < n; j++) {
      const x = n === 1 ? 50 : n === 2 ? (j ? 70 : 30) : 14 + j * (72 / (n - 1));
      slots.push({ role, label: labels[j] || role, x, y });
    }
  });
  return slots;
}
