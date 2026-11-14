// 서비스 워커: 앱 파일을 캐시해서 오프라인에서도 열리게 해요.
// 앱 파일을 수정해 배포할 때는 VERSION 숫자를 올려 주세요. (폰에 새 버전이 반영돼요)
const VERSION = "v18";
const CACHE = `squadmaker-${VERSION}`;
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./js/main.js",
  "./js/config.js",
  "./js/utils.js",
  "./js/state.js",
  "./js/store.js",
  "./js/formations.js",
  "./js/players.js",
  "./js/lineup.js",
  "./js/matches.js",
  "./js/stats.js",
  "./js/share.js",
  "./js/ocr.js",
  "./js/render.js",
  "./js/events.js",
  "./js/views/common.js",
  "./js/views/lineup.js",
  "./js/views/matches.js",
  "./js/views/players.js",
  "./js/views/modals.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_FILES.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("squadmaker-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 같은 사이트 파일: 네트워크 먼저(최신 반영), 안 되면 캐시. Firebase 등 외부 요청은 건드리지 않아요.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }) // 브라우저 캐시 말고 항상 최신 파일 확인
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
