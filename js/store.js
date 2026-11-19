// 데이터 저장소: 로컬(localStorage) 또는 Firebase Firestore (실시간 공유)
import { FIREBASE_CONFIG, GROUP_ID, FIREBASE_SDK_VERSION, STORAGE_KEY, CONFIG_KEY, ADMIN_EMAIL_HASHES } from "./config.js";
import { S, hooks, normalizeLineup, bumpData } from "./state.js";
import { validTier } from "./players.js";
import { toast } from "./utils.js";

let FB = null; // { db, fs, au, auth, gid }
let lineupTimer;
let lineupDirty = false;

const plain = (o) => JSON.parse(JSON.stringify(o)); // Firestore는 undefined를 못 받아요

/* ---------- 로컬 ---------- */
export function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { players: d.players || {}, matches: d.matches || {}, lineup: d.lineup ? normalizeLineup(d.lineup) : null };
  } catch {
    return { players: {}, matches: {}, lineup: null };
  }
}
function publicProfile({ tier, skill, ...profile }) {
  return profile;
}

function saveLocal() {
  try {
    // 예전 로컬 백업의 티어는 관리자 업로드용으로만 보존해요.
    const old = loadLocal().players;
    const players = Object.fromEntries(Object.entries(S.players).map(([id, p]) => [
      id, { ...old[id], ...publicProfile(p) }
    ]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, matches: S.matches, lineup: S.lineup }));
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
    toast(e.code === "permission-denied" ? (S.user ? "관리자만 할 수 있는 작업이에요" : "저장하려면 ⚙️ 설정에서 구글로 로그인하세요") : "저장 실패: " + (e.code || e.message));
    return false;
  }
}

export const api = {
  putPlayer(p) {
    const profile = publicProfile(p);
    bumpData();
    S.players[p.id] = profile;
    if (FB) return remote(() => FB.fs.setDoc(ref("playerProfiles", p.id), plain(profile)));
    return saveLocal();
  },
  async putPlayerTier(id, tier) {
    if (!FB || !S.isAdmin || !S.players[id] || (tier !== null && !validTier(tier))) return false;
    const doc = ref("playerTiers", id);
    const tiers = S.tiers;
    const previous = tiers[id];
    tiers[id] = tier;
    const saved = await remote(() => tier ? FB.fs.setDoc(doc, { tier }) : FB.fs.deleteDoc(doc));
    if (!saved && S.tiers === tiers && tiers[id] === tier) tiers[id] = previous;
    return saved;
  },
  async delPlayer(id) {
    if (!S.isAdmin || !FB) return false;
    const batch = FB.fs.writeBatch(FB.db);
    batch.delete(ref("playerProfiles", id));
    batch.delete(ref("playerTiers", id));
    return remote(() => batch.commit());
  },
  putMatch(m) {
    bumpData();
    m.updatedAt = Date.now();
    S.matches[m.id] = m;
    if (FB) return remote(() => FB.fs.setDoc(ref("matches", m.id), plain(m)));
    saveLocal();
  },
  delMatch(id) {
    bumpData();
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

/* ---------- 로그인 ---------- */
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

// v41 선수 원본은 규칙으로 읽기 전용으로 잠가 두고, 같은 ID로 공개 정보와 비공개 티어를 복사해요.
async function migrateDirectory() {
  const { fs, db, gid } = FB;
  const marker = ref("directory", "v42");
  if ((await fs.getDocFromServer(marker)).exists()) return;
  const legacy = await fs.getDocsFromServer(fs.collection(db, "groups", gid, "players"));
  for (const entry of legacy.docs) {
    await fs.runTransaction(db, async (tx) => {
      const profile = ref("playerProfiles", entry.id);
      if ((await tx.get(marker)).exists() || (await tx.get(profile)).exists()) return;
      const data = entry.data();
      tx.set(profile, { ...publicProfile(data), id: entry.id });
      const tier = validTier(data.tier);
      if (tier) tx.set(ref("playerTiers", entry.id), { tier });
    });
  }
  await fs.setDoc(marker, { ready: true });
}

let stopTiers;
let authRevision = 0;
function clearPrivateState() {
  S.isAdmin = false;
  S.tiers = {};
  S.ui.tierFilter = "all";
  if (S.ui.sort === "tier") S.ui.sort = "goals";
  S.ui.bulk = false;
  S.ui.bulkSel = [];
  S.ui.imgCanvas = null;
  hooks.closePrivateViews();
  bumpData();
}

async function isListedAdmin(user) {
  if (!user?.emailVerified || !user.email || !globalThis.crypto?.subtle) return false;
  const email = new TextEncoder().encode(user.email.trim().toLowerCase());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", email));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  return ADMIN_EMAIL_HASHES.has(hex);
}

async function watchTierAccess(user) {
  const revision = ++authRevision;
  const accountChanged = S.user && S.user.uid !== user?.uid;
  stopTiers?.();
  clearPrivateState();
  S.user = user;
  S.canEdit = Boolean(user?.emailVerified);
  hooks.render();
  if (accountChanged) {
    // SDK가 메모리에 보관한 이전 계정의 문서도 함께 비워요.
    location.reload();
    return;
  }
  if (!await isListedAdmin(user) || revision !== authRevision) return;
  if (!FB.privateSession) {
    location.reload(); // 관리자 로그인 직후에는 메모리 전용 DB로 다시 연결해요.
    return;
  }

  const { fs, db, gid } = FB;
  let checkedDirectory = false;
  stopTiers = fs.onSnapshot(fs.collection(db, "groups", gid, "playerTiers"), { includeMetadataChanges: true }, (snap) => {
    // 같은 기기에서 계정을 바꿔도 서버가 이 계정의 접근을 승인한 뒤에만 보여줘요.
    if (revision !== authRevision || snap.metadata.fromCache) return;
    S.isAdmin = true;
    S.tiers = Object.fromEntries(snap.docs.map((d) => [d.id, validTier(d.data().tier)]));
    bumpData();
    hooks.scheduleRender();
    if (!checkedDirectory) {
      checkedDirectory = true;
      migrateDirectory().catch((err) => {
        if (revision !== authRevision) return;
        console.error(err);
        toast("선수 명단 이전을 마치지 못했어요. 다시 연결한 뒤 새로고침해 주세요.");
      });
    }
  }, (err) => {
    if (revision !== authRevision) return;
    if (err.code !== "permission-denied") console.warn(err);
    if (S.isAdmin) clearPrivateState();
    hooks.render();
  });
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
  const auth = au.getAuth(app);
  await auth.authStateReady();
  const privateSession = await isListedAdmin(auth.currentUser);
  let db;
  if (privateSession) {
    db = fs.initializeFirestore(app, { localCache: fs.memoryLocalCache() });
  } else {
    try {
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch {
      db = fs.getFirestore(app);
    }
  }
  FB = { db, fs, au, auth, gid: cfg.gid || GROUP_ID, privateSession };
  S.mode = "remote";
  S.canEdit = false;
  S.isAdmin = false;

  au.getRedirectResult(auth).catch((e) => console.warn(e));
  au.onAuthStateChanged(auth, watchTierAccess);

  const onErr = (e) => {
    console.error(e);
    S.ready = true;
    toast("서버 연결 오류: " + (e.code || e.message));
    hooks.render();
  };
  const loaded = new Set();
  const loadedOne = (name) => {
    loaded.add(name);
    S.ready = loaded.size === 4;
  };
  const col = (n) => fs.collection(db, "groups", FB.gid, n);
  const toObj = (snap) => {
    const o = {};
    snap.forEach((d) => (o[d.id] = d.data()));
    return o;
  };

  fs.onSnapshot(ref("directory", "v42"), (d) => {
    S.directoryReady = d.data()?.ready === true;
    loadedOne("directory");
    hooks.scheduleRender();
  }, onErr);
  fs.onSnapshot(col("playerProfiles"), (snap) => { S.players = toObj(snap); bumpData(); loadedOne("players"); hooks.scheduleRender(); }, onErr);
  fs.onSnapshot(col("matches"), (snap) => { S.matches = toObj(snap); bumpData(); loadedOne("matches"); hooks.scheduleRender(); }, onErr);
  fs.onSnapshot(ref("meta", "lineup"), (d) => {
    if (!d.metadata.hasPendingWrites && !lineupDirty) S.lineup = normalizeLineup(d.exists() ? d.data() : S.lineup);
    loadedOne("lineup");
    hooks.scheduleRender();
  }, onErr);
}

export function useLocal() {
  FB = null;
  S.mode = "local";
  S.canEdit = true;
  S.user = null;
  S.isAdmin = false;
  S.tiers = {};
  const data = loadLocal();
  data.players = Object.fromEntries(Object.entries(data.players).map(([id, p]) => [id, publicProfile(p)]));
  Object.assign(S, data);
  bumpData();
}
