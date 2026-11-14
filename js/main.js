// 앱 시작점
import { S, hooks } from "./state.js";
import { getCfg, initFirebase, readJoinHash, useLocal } from "./store.js";
import { render, scheduleRender } from "./render.js";
import { bindEvents } from "./events.js";
import { toast } from "./utils.js";
import { APP_VERSION } from "./config.js";

hooks.render = render;
hooks.scheduleRender = scheduleRender;
bindEvents();

// 공유 링크(#join=...)로 들어왔으면 서버 설정 저장
readJoinHash();

const cfg = getCfg();
if (cfg) {
  render(); // "불러오는 중…"
  initFirebase(cfg).catch((e) => {
    console.error(e);
    toast("서버에 연결하지 못했어요. 이 폰 저장 모드로 열어요.");
    useLocal();
    render();
  });
} else {
  useLocal();
  render();
}

// 홈 화면에 설치 (PWA)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`).then((reg) => reg.update()).catch(() => {});
  // 새 버전이 설치되면 한 번 자동 새로고침
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !sessionStorage.getItem("sw-reloaded")) {
      sessionStorage.setItem("sw-reloaded", "1");
      location.reload();
    }
  });
}

window.__S = S; // 디버깅용
