# ⚽ 스쿼드 메이커

동네축구·풋살 라인업 짜기, 경기 기록, 선수 기록을 위한 웹앱(PWA)이에요.
링크를 받은 사람은 폰에 앱처럼 설치해서 쓸 수 있어요. 빌드 과정이나 서버가 필요 없는 순수 HTML·CSS·자바스크립트예요.

## 주요 기능
- 모임별 선수 명단과 경기 기록, 기본 모임에서 시작
- 선수별 S·A·B·C·F 티어 지정, 스쿼드 저장 및 배치 복원
- 인원(3~11명)·포메이션 선택, 경기장에 끌어다 놓기로 배치
- 위치에 따라 포지션 자동 판정 (ST, CAM, LCB, SW 등) + 포지션 색 (공격 빨강 · 미드 초록 · 수비 파랑 · GK 노랑)
- 팀 최대 8개 (풋살 밀어내기), 팀별 후보, 모든 팀 공통 심판
- 이미지 캡처에서 참가자 이름 읽기 (Tesseract.js, 폰 안에서 처리)
- 경기 기록: 스코어, 득점·도움, 심판, 출전 선수
- 선수 기록: 출전·승무패·골·도움, 추천 포지션
- 스쿼드 이미지 저장·공유, 명단 텍스트 복사
- 백업 파일 저장/불러오기, 오프라인 사용

## 폴더 구조
```
index.html            화면 구조(HTML)만 들어 있어요
css/style.css         디자인 전체
js/                   기능별 자바스크립트 (아래 순서대로 불러와요)
  utils.js            상수·도우미: 포메이션 목록, 팀 색, 포지션 판정(posOf), 날짜·글자 도우미
  store.js            데이터 상태와 저장(localStorage), 계산용 함수
  ui.js               알림(toast)·팝업(modal)
  render.js           라인업 화면 그리기 (경기장·후보·대기 명단·팀 명단)
  lineup.js           배치·자리 바꾸기·끌어서 놓기, 참가자 추가, 랜덤 나누기,
                      팀 추가/삭제, 인원 변경, 경기 시작
  matches.js          경기 기록 목록·상세, 골·심판·출전 선수
  stats.js            선수 기록, 수동 티어 설정, 추천 포지션, 선수 관리
  setup.js            팀당 인원 변경
  groups.js           모임 만들기·전환, 기본 모임 설정, 저장된 명단에서 참가자 선택
  squads.js           모임별 스쿼드 저장·불러오기
  ocr.js              카톡 투표 캡처 → 이름 인식 (Tesseract.js)
  image.js            스쿼드 이미지 그리기·저장·공유
  app.js              앱 설치 안내, 백업, 시작(boot) ← 반드시 마지막
sw.js                 오프라인 지원(서비스 워커)
manifest.webmanifest  앱 이름·아이콘·색 (설치용)
icons/                앱 아이콘
```

> **js 파일들은 모듈이 아니라 순서대로 불러오는 일반 스크립트예요.** 한 파일에서 만든 변수·함수를 다른 파일에서 그대로 쓸 수 있어요.
> 파일을 새로 만들면 `index.html` 아래쪽 `<script>` 목록과 `sw.js`의 `SHELL` 목록에 둘 다 추가하세요. `app.js`는 항상 마지막이에요.

## 자주 고칠 곳
| 바꾸고 싶은 것 | 파일 · 위치 |
|---|---|
| 포메이션 목록 | `js/utils.js` → `FORMATIONS` |
| 팀 색 순서 | `js/utils.js` → `COLORS` |
| 포지션 판정 구역 (어디부터 CB/CDM/ST인지) | `js/utils.js` → `posOf()` |
| 포지션 색 | `js/utils.js` → `POSCOL` |
| 캡처 인식에서 걸러낼 단어 | `js/ocr.js` → `UI_RE`, 투표 항목 단어는 `OPT_RE` |
| 스쿼드 이미지 모양 | `js/image.js` → `drawTeam()` |
| 색·글꼴·간격 | `css/style.css` 맨 위 `:root` |

## 내 컴퓨터에서 실행
서비스 워커와 설치 기능 때문에 파일을 더블클릭하지 말고 간단한 서버로 여세요.
```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

## GitHub Pages로 올리기
1. 이 폴더 내용을 저장소 맨 위(root)에 올려요.
2. 저장소 **Settings → Pages** → Source를 `Deploy from a branch`, 브랜치 `main` / 폴더 `/ (root)`로 저장해요.
3. 몇 분 뒤 `https://<아이디>.github.io/<저장소이름>/` 주소가 생겨요. 이 링크를 단톡방에 보내면 돼요.

**고친 뒤 배포할 때**: 커밋·푸시하면 자동으로 반영돼요. 설치한 사람도 다음에 앱을 열 때 새 버전을 받아요.
화면이 예전 그대로면 `sw.js` 맨 위 `VERSION` 값을 올려 주세요 (예: `squadmaker-v3`).

## 폰에 설치하기 (링크 받은 사람)
- 카톡에서 링크를 열면 카톡 안 브라우저라 설치가 안 돼요. 먼저 **Safari로 열기 / 다른 브라우저로 열기**를 누르세요.
- **안드로이드(크롬)**: 화면 위 **앱 설치** 버튼, 또는 메뉴(⋮) → 앱 설치
- **아이폰(사파리)**: 공유 버튼 → **홈 화면에 추가**

## 데이터 저장
- 모든 기록은 각 폰의 브라우저 저장소(`localStorage`, 키 `squadmaker.v2`)에 있어요. 서버로 보내지 않아요.
- 폰을 바꾸거나 기록을 넘길 땐 화면 맨 아래 **백업 파일 저장 → 백업 불러오기**를 쓰세요.
- 아이폰은 앱을 몇 주 안 열면 저장소가 정리될 수 있어요. 가끔 백업하세요.
- 처음 만든 모임이 기본 모임이에요. 앱은 기본 모임의 라인업을 열어요. **모임 목록**에서 다른 모임을 열거나 기본 모임을 바꿀 수 있어요.
- **스쿼드 저장**으로 현재 팀, 선수 배치, 후보, 포메이션을 보관하고 같은 모임에서 다시 불러올 수 있어요.
- 전체 백업에는 기본 모임, 모든 모임의 명단과 티어, 경기, 현재 라인업, 저장한 스쿼드가 포함돼요. 기존 단일 모임 기록도 불러올 수 있어요.

### 저장 형식 (요약)
```js
data    = { v:4, defaultGroupId, groups:{ [모임id]: { name, roster, matches, cur, squads } } }
roster  = { [선수id]: { name, createdAt, tier? } }
matches = { [경기id]: { date, title, size, referee, finished, createdAt,
            teams: { A: { name, color, formation, players:[선수id], pos:{[선수id]:'GK'|'DF'|'MF'|'FW'|'SUB'} }, B: {...} },
            goals: [{ id, team:'A'|'B', scorer, assist, og, ts }] } }
cur     = { size, title, referee, active, teamCount, attendees:[선수id],
            teams: { A: { name, color, formation, slots:[{x,y,pid}], subs:[선수id] }, ... } }
squads  = [{ id, name, savedAt, lineup }]
```

## 사용한 외부 리소스
- [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 (Apache-2.0) — 캡처 글자 인식, 처음 쓸 때 CDN(jsdelivr)에서 불러와요
- [Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR) (SIL OFL) — Google Fonts
