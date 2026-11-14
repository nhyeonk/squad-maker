// 데이터 저장소: 로컬(localStorage) 또는 Firebase Firestore (실시간 공유)
import { FIREBASE_CONFIG, GROUP_ID, FIREBASE_SDK_VERSION, STORAGE_KEY, CONFIG_KEY } from "./config.js";
import { S, hooks, defaultLineup } from "./state.js";
import { toast } from "./utils.js";

let FB = null; // { db, fs, au, auth, gid }
let lineupTimer;
let lineupDirty = false;

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
    return true;
  } catch {
    toast("저장 공간이 부족해요");
    return false;
  }
}

/* ---------- 쓰기 API (화면 코드는 이것만 쓰면 돼요) ---------- */
const ref = (...path) => FB.fs.doc(FB.db, "groups", FB.gid, ...path);

async function remote(fn) {
  try {
    await fn();
    return true;
  } catch (e) {
    console.error(e);
    toast(e.code === "permission-denied" ? "저장 권한이 없어요. 기록자 계정으로 로그인하세요." : "저장 실패: " + (e.code || e.message));
    return false;
  }
}

export const api = {
  async putPlayerSkill(id, skill) {
    const previous = S.players[id];
    if (!S.canEdit || !previous) return false;
    if (FB) {
      const connection = FB;
      const saved = await remote(() => connection.fs.updateDoc(ref("players", id), { skill }));
      if (saved && FB === connection && S.players[id] === previous) S.players[id] = { ...previous, skill };
      return saved;
    }
    S.players[id] = { ...previous, skill };
    if (saveLocal()) return true;
    S.players[id] = previous;
    return false;
  },
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
    lineupDirty = true; // 저장 전까지는 서버에서 온 예전 라인업으로 덮어쓰지 않아요
    lineupTimer = setTimeout(async () => {
      await remote(() => FB.fs.setDoc(ref("meta", "lineup"), plain(S.lineup)));
      lineupDirty = false;
    }, 400);
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

/* ---------- 로그인 & 기록자 권한 ----------
 * 기록자 명단은 Firestore의 recorders/{그룹ID} 문서에 있어요: { owner: 관리자이메일, emails: [기록자 이메일...] }
 * 관리자 이메일만 firestore.rules에 한 번 적어 두고, 나머지 기록자는 앱 설정에서 추가/삭제해요.
 */
export const login = (email, pw) => FB.au.signInWithEmailAndPassword(FB.auth, email, pw);
export const logout = () => FB.au.signOut(FB.auth);

export async function loginGoogle() {
  const provider = new FB.au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await FB.au.signInWithPopup(FB.auth, provider);
  } catch (e) {
    // 홈 화면 앱(PWA)이나 팝업 차단 환경에서는 페이지 이동 방식으로
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
      return FB.au.signInWithRedirect(FB.auth, provider);
    }
    throw e;
  }
}

const myEmail = () => (S.user?.email || "").toLowerCase();

function updatePermission() {
  const e = myEmail();
  const r = S.recorders;
  S.isOwner = !!e && !!r && r.owner === e;
  S.canEdit = !!e && !!r && (r.owner === e || (r.emails || []).includes(e));
}

const recordersRef = () => FB.fs.doc(FB.db, "recorders", FB.gid);
const requestsCol = () => FB.fs.collection(FB.db, "requests", FB.gid, "items");
const myRequestRef = () => FB.fs.doc(FB.db, "requests", FB.gid, "items", S.user.uid);

/* ---------- 기록자 신청 → 관리자 승인 ----------
 * requests/{그룹ID}/items/{신청자uid} = { email, name(구글 이름), at }
 * 신청자 본인과 관리자만 볼 수 있어요.
 */
export async function requestAccess() {
  await FB.fs.setDoc(myRequestRef(), { email: myEmail(), name: S.user.displayName || "", at: Date.now() });
}
export async function cancelRequest() {
  await FB.fs.deleteDoc(myRequestRef());
}
export async function approveRequest(uid) {
  const r = S.requests.find((x) => x.uid === uid);
  if (!r) return;
  await setRecorders([...(S.recorders.emails || []), r.email]);
  await FB.fs.deleteDoc(FB.fs.doc(FB.db, "requests", FB.gid, "items", uid));
}
export async function rejectRequest(uid) {
  await FB.fs.deleteDoc(FB.fs.doc(FB.db, "requests", FB.gid, "items", uid));
}

/** 관리자면 신청 목록 전체, 아니면 내 신청만 실시간으로 지켜봐요 */
let unsubReq = null, reqMode = null;
function watchRequests() {
  const mode = !S.user ? null : S.isOwner ? "owner" : S.canEdit ? null : "self";
  if (mode === reqMode) return;
  unsubReq?.();
  unsubReq = null;
  reqMode = mode;
  S.requests = [];
  S.myRequest = null;
  if (mode === "owner") {
    unsubReq = FB.fs.onSnapshot(requestsCol(), (snap) => {
      S.requests = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => a.at - b.at);
      hooks.render();
    }, (e) => console.warn(e));
  } else if (mode === "self") {
    unsubReq = FB.fs.onSnapshot(myRequestRef(), (d) => {
      S.myRequest = d.exists() ? d.data() : null;
      hooks.render();
    }, (e) => console.warn(e));
  }
}

/** 처음 한 번: 이 계정을 관리자로 등록 (firestore.rules에 적은 관리자만 성공해요) */
export async function claimOwner() {
  await FB.fs.setDoc(recordersRef(), { owner: myEmail(), emails: [] });
}
export async function setRecorders(emails) {
  const r = S.recorders;
  await FB.fs.setDoc(recordersRef(), { owner: r.owner, emails: [...new Set(emails.map((x) => x.trim().toLowerCase()).filter(Boolean))] });
}

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

  au.getRedirectResult(auth).catch((e) => console.warn(e));
  let unsubRec = null;
  au.onAuthStateChanged(auth, (u) => {
    S.user = u;
    S.recorders = null;
    updatePermission();
    unsubRec?.();
    unsubRec = null;
    watchRequests();
    if (u) {
      S.recordersLoaded = false;
      S.recordersDenied = false;
      unsubRec = fs.onSnapshot(
        recordersRef(),
        (d) => {
          S.recorders = d.exists() ? d.data() : null;
          S.recordersLoaded = true;
          updatePermission();
          watchRequests();
          hooks.render();
        },
        (e) => {
          // 기록자 명단에 없는 사람은 명단을 못 읽어요 → 보기 전용
          console.warn(e);
          S.recordersLoaded = true;
          S.recordersDenied = e.code === "permission-denied";
          watchRequests();
          hooks.render();
        }
      );
    }
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
    if (!d.metadata.hasPendingWrites && !lineupDirty) S.lineup = d.exists() ? d.data() : S.lineup || defaultLineup();
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
