// 데이터 저장소: 로컬(localStorage) 또는 Firebase Firestore (실시간 공유)
import { FIREBASE_CONFIG, GROUP_ID, FIREBASE_SDK_VERSION, STORAGE_KEY, CONFIG_KEY } from "./config.js";
import { S, hooks, defaultLineup } from "./state.js";
import { toast } from "./utils.js";

let FB = null; // { db, fs, au, auth, gid }
let lineupTimer;

const plain = (o) => JSON.parse(JSON.stringify(o)); // Firestore는 undefined를 못 받아요

/* ---------- 로컬 ---------- */
export function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { players: d.players || {}, matches: d.matches || {}, lineup: d.lineup || null };
  } catch {
    return { players: {}, matches: {}, lineup: null };
  }
}
function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ players: S.players, matches: S.matches, lineup: S.lineup }));
  } catch {
    toast("저장 공간이 부족해요");
  }
}

/* ---------- 쓰기 API (화면 코드는 이것만 쓰면 돼요) ---------- */
const ref = (...path) => FB.fs.doc(FB.db, "groups", FB.gid, ...path);

async function remote(fn) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    toast(e.code === "permission-denied" ? "저장 권한이 없어요. 기록자 계정으로 로그인하세요." : "저장 실패: " + (e.code || e.message));
  }
}

export const api = {
  putPlayer(p) {
    S.players[p.id] = p;
    if (FB) return remote(() => FB.fs.setDoc(ref("players", p.id), plain(p)));
    saveLocal();
  },
  delPlayer(id) {
    delete S.players[id];
    if (FB) return remote(() => FB.fs.deleteDoc(ref("players", id)));
    saveLocal();
  },
  putMatch(m) {
    m.updatedAt = Date.now();
    S.matches[m.id] = m;
    if (FB) return remote(() => FB.fs.setDoc(ref("matches", m.id), plain(m)));
    saveLocal();
  },
  delMatch(id) {
    delete S.matches[id];
    if (FB) return remote(() => FB.fs.deleteDoc(ref("matches", id)));
    saveLocal();
  },
  /** 라인업은 자주 바뀌니까 0.5초 모아서 저장 */
  putLineup() {
    if (!FB) return saveLocal();
    clearTimeout(lineupTimer);
    lineupTimer = setTimeout(() => remote(() => FB.fs.setDoc(ref("meta", "lineup"), plain(S.lineup))), 500);
  },
};

/* ---------- 서버 설정 ---------- */
export function getCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    if (c?.config) return c;
  } catch {}
  if (FIREBASE_CONFIG) return { config: FIREBASE_CONFIG, gid: GROUP_ID };
  return null;
}
export function saveCfg(config, gid) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ config, gid }));
}
export function clearCfg() {
  localStorage.removeItem(CONFIG_KEY);
}
export const groupId = () => FB?.gid;

/** Firebase 콘솔에서 복사한 firebaseConfig 코드 조각을 객체로 */
export function parseConfig(text) {
  const o = {};
  ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId", "databaseURL"].forEach((k) => {
    const m = text.match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`));
    if (m) o[k] = m[1];
  });
  return o.apiKey && o.projectId ? o : null;
}

/* 공유 링크: 주소 뒤 #join=... 에 서버 설정을 담아 친구 폰에 자동 연결 */
const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export function readJoinHash() {
  const m = location.hash.match(/join=([A-Za-z0-9_\-]+)/);
  if (!m) return;
  try {
    const d = JSON.parse(b64d(m[1]));
    if (d.c?.projectId) saveCfg(d.c, d.g || GROUP_ID);
  } catch (e) {
    console.warn(e);
  }
  history.replaceState(null, "", location.pathname + location.search);
}
export function shareLink() {
  const base = location.origin + location.pathname;
  const c = getCfg();
  // 설정이 config.js에 들어 있으면 링크만으로 충분
  if (!c || FIREBASE_CONFIG) return base;
  return base + "#join=" + b64e(JSON.stringify({ c: c.config, g: c.gid }));
}

/* ---------- 로그인 (기록자) ---------- */
export const login = (email, pw) => FB.au.signInWithEmailAndPassword(FB.auth, email, pw);
export const logout = () => FB.au.signOut(FB.auth);

/* ---------- Firebase 연결 & 실시간 구독 ---------- */
export async function initFirebase(cfg) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`;
  const [appM, fs, au] = await Promise.all([
    import(base + "firebase-app.js"),
    import(base + "firebase-firestore.js"),
    import(base + "firebase-auth.js"),
  ]);
  const app = appM.initializeApp(cfg.config);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch {
    db = fs.getFirestore(app);
  }
  const auth = au.getAuth(app);
  FB = { db, fs, au, auth, gid: cfg.gid || GROUP_ID };
  S.mode = "remote";
  S.canEdit = false;

  au.onAuthStateChanged(auth, (u) => {
    S.user = u;
    S.canEdit = !!u;
    hooks.render();
  });

  const onErr = (e) => {
    console.error(e);
    S.ready = true;
    toast("서버 연결 오류: " + (e.code || e.message));
    hooks.render();
  };
  let loaded = 0;
  const loadedOne = () => {
    if (++loaded === 3) {
      S.ready = true;
      hooks.render();
    }
  };
  const col = (n) => fs.collection(db, "groups", FB.gid, n);
  const toObj = (snap) => {
    const o = {};
    snap.forEach((d) => (o[d.id] = d.data()));
    return o;
  };

  fs.onSnapshot(col("players"), (snap) => { S.players = toObj(snap); loadedOne(); hooks.scheduleRender(); }, onErr);
  fs.onSnapshot(col("matches"), (snap) => { S.matches = toObj(snap); loadedOne(); hooks.scheduleRender(); }, onErr);
  fs.onSnapshot(ref("meta", "lineup"), (d) => {
    if (!d.metadata.hasPendingWrites) S.lineup = d.exists() ? d.data() : S.lineup || defaultLineup();
    loadedOne();
    hooks.scheduleRender();
  }, onErr);
}

export function useLocal() {
  FB = null;
  S.mode = "local";
  S.canEdit = true;
  Object.assign(S, loadLocal());
}
