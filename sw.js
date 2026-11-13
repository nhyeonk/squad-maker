// 스쿼드 메이커 오프라인 지원
const VERSION = 'squadmaker-v7';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/style.css?v=7',
  './js/utils.js', './js/store.js', './js/ui.js', './js/render.js?v=5', './js/lineup.js', './js/matches.js',
  './js/stats.js?v=5', './js/setup.js', './js/groups.js', './js/squads.js', './js/ocr.js', './js/image.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 앱 화면: 인터넷이 되면 최신 버전, 안 되면 저장된 버전
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, {cache:'no-cache'}).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // 우리 사이트의 css·js: 인터넷이 되면 최신 버전, 안 되면 저장된 버전
  if (url.origin === location.origin && /\.(css|js|webmanifest)$/.test(url.pathname)) {
    e.respondWith(fetch(req, {cache:'no-cache'}).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req)));
    return;
  }
  // 아이콘·글꼴 등: 저장된 것 먼저
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
