// 카톡 투표자 캡처 → 이름 인식 (Tesseract.js, 폰 안에서 처리 · 서버로 이미지 안 보냄)
import { findByName, similarPlayer } from "./players.js";

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
 * - 세로로 긴 전체 화면 캡처에서 상태 표시줄과 좌우 여백을 제외해요.
 * - 어두운 배경은 반전하고 글자의 회색 음영은 유지해요.
 */
async function preprocess(file) {
  const img = await createImageBitmap(file);
  const tall = img.height >= img.width * 1.6;
  const x0 = tall ? Math.round(img.width * 0.15) : 0;
  const w = img.width - 2 * x0;
  const y0 = tall ? Math.round(img.height * 0.08) : 0;
  const h = img.height - y0;
  const scale = Math.min(2, Math.max(1, 1440 / img.width), Math.sqrt(4_000_000 / (w * h)));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * scale));
  cv.height = Math.max(1, Math.round(h * scale));
  const c = cv.getContext("2d", { willReadFrequently: true });
  try {
    c.fillStyle = "white";
    c.fillRect(0, 0, cv.width, cv.height);
    c.imageSmoothingQuality = "high";
    c.drawImage(img, x0, y0, w, h, 0, 0, cv.width, cv.height);
  } finally {
    img.close();
  }

  const d = c.getImageData(0, 0, cv.width, cv.height);
  const px = d.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const gray = Math.round(px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11);
    px[i] = px[i + 1] = px[i + 2] = gray;
    sum += gray;
  }
  if (sum / (px.length / 4) < 128) {
    for (let i = 0; i < px.length; i += 4) {
      px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
    }
  }
  c.putImageData(d, 0, 0);
  return cv;
}

/** 인식된 글자 → 이름 후보 목록 (중복 제거) */
export function extractNames(text) {
  const out = new Set();
  for (const line of text.normalize("NFC").split("\n")) {
    const tokens = line.split(/[^가-힣A-Za-z]+/).filter((word) => word && !IGNORE.has(word));
    if (tokens.length > 1) {
      // "김 민수"처럼 이름 중간에 들어간 공백은 명단에서 확인해요.
      const registered = findByName(tokens.join(" ")) || findByName(tokens.join(""));
      if (registered) {
        out.add(registered.name);
        continue;
      }
    }
    // 한글 2~5자 덩어리, 또는 영문 이름
    const names = tokens.filter((w) => /^[가-힣]{2,5}$/.test(w) || /^[A-Za-z]{2,12}$/.test(w));
    const known = names.filter((name) => findByName(name));
    if (known.length === 1 || names.length === 1) {
      out.add(known[0] || names[0]);
    } else if (known.length === 0 && names.length <= 3) {
      const best = names.filter((w) => /^[가-힣]{2,4}$/.test(w)).sort((a, b) => b.length - a.length)[0];
      if (best) out.add(best);
    }
  }
  return [...out];
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

