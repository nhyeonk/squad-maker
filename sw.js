// 서비스 워커: 한 번 연 파일을 저장해 두고, 인터넷이 안 될 때도 앱이 열리게 해요.
// 버전은 js/config.js의 APP_VERSION 하나만 올리면 돼요. (sw.js?v=버전 으로 등록돼서 자동으로 새로 설치돼요)
// 새 파일을 추가해도 여기에 적을 필요 없어요. 처음 불러올 때 알아서 저장돼요.
const VERSION = new URL(location.href).searchParams.get("v") || "dev";
const CACHE = `squadmaker-${VERSION}`;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./css/style.css", "./js/main.js", "./icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
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

// 같은 사이트 파일: 항상 최신을 먼저 확인하고(no-cache), 안 되면 저장해 둔 걸로. Firebase 등 외부 요청은 건드리지 않아요.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
