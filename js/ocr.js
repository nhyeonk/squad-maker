// 카톡 투표자 캡처 → 이름 인식 (Tesseract.js, 폰 안에서 처리 · 서버로 이미지 안 보냄)
import { similarPlayer } from "./players.js";

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

/** 이름이 아닌 카톡 화면 글자들 */
const IGNORE = new Set(["투표자", "이름순", "항목", "투표", "참여", "참여자", "미참여", "나", "친구", "초대", "완료", "명", "닫기", "결과", "보기"]);

let workerPromise = null;
let idleTimer = null;

/** 다 쓰고 1분 동안 안 쓰면 인식 엔진을 꺼서 폰 메모리를 돌려줘요 (다음에 쓰면 다시 켜요) */
function scheduleIdleStop() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const p = workerPromise;
    workerPromise = null;
    try { (await p)?.terminate(); } catch {}
  }, 60_000);
}

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => fail(new Error("인식 엔진을 불러오지 못했어요. 인터넷 연결을 확인하세요."));
    document.head.appendChild(s);
  });
}

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      if (!window.Tesseract) await loadScript(TESSERACT_URL);
      const w = await window.Tesseract.createWorker("kor", 1, {
        logger: (m) => m.status === "recognizing text" && onProgress?.(m.progress),
      });
      await w.setParameters({ tessedit_pageseg_mode: "6" }); // 한 덩어리 글자 블록
      return w;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/**
 * 인식이 잘 되게 이미지 손보기
 * - 휴대폰 상단 상태 표시줄(위 8%), 왼쪽 프로필 사진, 오른쪽 버튼 영역은 잘라내고 (가로 15%~85%)
 * - 다크 모드면 색 반전, 흑백으로 또렷하게
 */
async function preprocess(file) {
  const img = await createImageBitmap(file);
  const x0 = Math.round(img.width * 0.15);
  const w = Math.round(img.width * 0.7);
  const y0 = Math.round(img.height * 0.08);
  const h = img.height - y0;
  const scale = img.width < 900 ? 2 : 1;
  const cv = document.createElement("canvas");
  cv.width = w * scale;
  cv.height = h * scale;
  const c = cv.getContext("2d", { willReadFrequently: true });
  c.drawImage(img, x0, y0, w, h, 0, 0, cv.width, cv.height);

  const d = c.getImageData(0, 0, cv.width, cv.height);
  const px = d.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
  const dark = sum / (px.length / 4) < 128;
  for (let i = 0; i < px.length; i += 4) {
    let v = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    if (dark) v = 255 - v;
    v = v > 150 ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  c.putImageData(d, 0, 0);
  return cv;
}

/** 인식된 글자 → 이름 후보 목록 (중복 제거) */
export function extractNames(text) {
  const out = [];
  for (let line of text.split("\n")) {
    line = line.replace(/[|“”"'`~^@#%&*()\[\]{}<>「」『』【】、。·•:;!?_=+\\/.,0-9]/g, " ").trim();
    // 한글 2~5자 덩어리, 또는 영문 이름
    const words = line.split(/\s+/).filter((w) => /^[가-힣]{2,5}$/.test(w) || /^[A-Za-z]{2,12}$/.test(w));
    const names = words.filter((w) => !IGNORE.has(w));
    if (names.length !== 1) {
      // "나 김남현" 처럼 한 줄에 이름이 하나만 있는 경우만 믿어요. 여러 개면 가장 긴 한글 단어
      const best = names.filter((w) => /^[가-힣]{2,4}$/.test(w)).sort((a, b) => b.length - a.length)[0];
      if (!best || words.length > 3) continue;
      names.splice(0, names.length, best);
    }
    if (!out.includes(names[0])) out.push(names[0]);
  }
  return out;
}

/**
 * 이미지 여러 장 → [{ raw: 인식된 글자, name: 제안 이름, existingId }]
 * 이미 있는 선수와 비슷하면 그 선수 이름으로 바로잡아요 (예: 방하능 → 박하늘)
 */
export async function recognizeNames(files, onProgress) {
  clearTimeout(idleTimer);
  const worker = await getWorker(onProgress);
  const raws = [];
  for (const f of files) {
    const canvas = await preprocess(f);
    const { data } = await worker.recognize(canvas);
    extractNames(data.text).forEach((n) => !raws.includes(n) && raws.push(n));
  }
  scheduleIdleStop();
  const seen = new Set();
  return raws
    .map((raw) => {
      const p = similarPlayer(raw);
      return { raw, name: p ? p.name : raw, existingId: p?.id || null };
    })
    .filter((r) => (seen.has(r.name) ? false : seen.add(r.name)));
}

