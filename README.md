# ⚽ 스쿼드 메이커

동네 축구·풋살 모임용 **라인업 짜기 · 팀 나누기 · 경기 기록** 웹앱입니다.
한 명(기록자)이 입력하면 친구들은 링크만 열어 실시간으로 볼 수 있고, 폰 홈 화면에 설치하면 앱처럼 쓸 수 있어요.

## 주요 기능

- **라인업**: 3 vs 3 ~ 11 vs 11, 인원별 포메이션, 풋살 코트(6인 이하)
- **팀 나누기**: 실력(★1~5)과 선호 포지션을 보고 2~6팀으로 자동 분배
  - 나눈 뒤에도 선수를 눌러 **다른 팀으로 이동**하거나 **두 선수 맞교환** 가능
  - 빈자리 채우기, 후보, 대기 명단
- **선호 포지션**: 골키퍼/수비/미드/공격 중 여러 개, 누른 순서가 우선순위
- **경기 기록**: 골·도움·자책골, 출전 선수, 심판, 진행 중/종료
- **선수 기록**: 득점·도움·공격포인트·출전·승률 순위, 기간(전체/올해/이번 달), 추천 포지션
- **카톡 투표 캡처로 참가자 추가**: 투표자 목록 스크린샷을 올리면 이름을 읽어요(폰 안에서 처리). 기존 선수와 비슷한 이름은 자동으로 바로잡고, 추가 전에 이름 수정·제외 가능
- **공유**: 스쿼드 이미지 저장(카톡 공유), 명단 텍스트 복사, 카톡 투표 결과 텍스트 붙여넣기
- **저장**: Firebase(실시간 공유) 또는 폰에만 저장, 백업 파일 내보내기/불러오기

## 폴더 구조

```
├── index.html            # 화면 뼈대
├── css/style.css         # 디자인
├── js/
│   ├── main.js           # 시작점
│   ├── config.js         # ★ Firebase 설정 넣는 곳
│   ├── state.js          # 앱 상태와 데이터 구조
│   ├── store.js          # 저장소 (로컬 / Firebase 실시간)
│   ├── formations.js     # 인원별 포메이션, 자리 좌표
│   ├── players.js        # 선수 추가, 이름 붙여넣기 처리, 포지션 적합도
│   ├── lineup.js         # 선수 이동·교체, 자동 배치, 밸런스 팀 나누기
│   ├── matches.js        # 경기 생성·골 기록
│   ├── stats.js          # 선수별 통계
│   ├── share.js          # 이미지·텍스트·백업
│   ├── ocr.js            # 카톡 캡처 이름 인식 (Tesseract.js)
│   ├── render.js         # 화면 그리기
│   ├── events.js         # 버튼/입력 이벤트 (data-act → actions)
│   └── views/            # 탭별 화면 HTML
│       ├── lineup.js  matches.js  players.js  modals.js  common.js
├── sw.js                 # 오프라인 캐시 (PWA)
├── manifest.webmanifest  # 홈 화면 설치 정보
├── icons/                # 앱 아이콘
└── firestore.rules       # Firebase 보안 규칙
```

빌드 도구 없이 순수 HTML/CSS/JS(ES 모듈)라서 파일을 고치고 올리면 바로 반영돼요.

## 1. 깃허브 Pages로 배포하기

1. 깃허브에 새 저장소를 만들고 이 폴더의 파일을 모두 올립니다.
   ```bash
   git init
   git add .
   git commit -m "스쿼드 메이커 첫 버전"
   git branch -M main
   git remote add origin https://github.com/<내 아이디>/squad-maker.git
   git push -u origin main
   ```
2. 저장소 → **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `/ (root)` → Save
3. 1~2분 뒤 `https://<내 아이디>.github.io/squad-maker/` 주소로 열려요.

> 로컬에서 테스트할 때는 파일을 더블클릭하지 말고 간단한 서버로 여세요 (ES 모듈은 `file://`에서 안 돼요).
> `python3 -m http.server 8000` → http://localhost:8000

이 상태로도 바로 쓸 수 있어요. 다만 기록이 **각자 폰에만** 저장돼요. 친구들과 같이 보려면 2번을 하세요.

## 2. Firebase 연결 (친구들과 실시간 공유) — 약 5분

1. [Firebase 콘솔](https://console.firebase.google.com)에서 **프로젝트 추가** (구글 애널리틱스는 꺼도 돼요)
2. **빌드 → Firestore Database → 데이터베이스 만들기** → 위치 `asia-northeast3 (서울)` → **프로덕션 모드**
3. **규칙** 탭에 이 저장소의 `firestore.rules` 내용을 붙여넣고, `recorder@example.com`을 기록자 이메일로 바꾼 뒤 **게시**
4. **빌드 → Authentication → 시작하기 → 로그인 방법: 이메일/비밀번호** 사용 설정
5. **Authentication → Users → 사용자 추가**로 기록자 계정(3번에 적은 이메일 + 비밀번호)을 만들기
6. **프로젝트 설정(⚙️) → 일반 → 내 앱 → 웹(</>)** 으로 앱 등록 → 나오는 `firebaseConfig`를 복사
7. 연결 방법은 둘 중 하나:
   - **(추천) 코드에 넣기**: `js/config.js`의 `FIREBASE_CONFIG = null`을 복사한 값으로 바꾸고 커밋·푸시.
     그러면 사이트 주소만 공유해도 모두 자동 연결돼요.
   - **앱에서 붙여넣기**: 앱의 ⚙️ 설정 → 붙여넣기 → 연결하기 → **공유 링크 복사**로 만든 링크를 단톡방에 공유
8. 기록자는 ⚙️ 설정에서 5번 계정으로 로그인하면 입력할 수 있어요. 나머지 사람은 **보기 전용**이에요.

> Firebase 웹 설정값(apiKey 등)은 비밀번호가 아니라 깃허브에 올려도 괜찮아요. 쓰기 권한은 `firestore.rules`가 막아줘요.
> 무료 요금제(Spark)로 동네 모임 규모는 충분해요.

**기존에 폰에 저장해 둔 기록**은 기록자로 로그인한 뒤 ⚙️ 설정 → "이 폰에 저장된 기록을 서버로 합치기"로 올릴 수 있어요.

## 3. 폰에 앱으로 설치

- **아이폰(사파리)**: 공유 버튼 → 홈 화면에 추가
- **안드로이드(크롬)**: 메뉴(⋮) → 앱 설치 / 홈 화면에 추가

## 데이터 구조 (Firestore)

```
groups/{그룹ID}/players/{선수ID}   { name, pos: ["MF","FW"], skill: 3 }
groups/{그룹ID}/matches/{경기ID}   { date, title, referee, status, teams[2], goals[] }
groups/{그룹ID}/meta/lineup        현재 라인업 (참가자, 팀 배치)
```

`js/config.js`의 `GROUP_ID`를 바꾸면 같은 Firebase 프로젝트로 여러 모임을 따로 운영할 수 있어요.

## 수정할 때 참고

| 바꾸고 싶은 것 | 파일 |
| --- | --- |
| 포메이션 추가/자리 위치 | `js/formations.js` |
| 팀 나누기 방식 | `js/lineup.js` → `balanceSplit()` |
| 포지션 적합도 점수 | `js/players.js` → `fit()` |
| 캡처 인식 (자르는 영역, 무시할 단어) | `js/ocr.js` |
| 비슷한 이름 바로잡기 기준 | `js/players.js` → `similarPlayer()` |
| 통계 항목 | `js/stats.js`, `js/views/players.js` |
| 색·글꼴·여백 | `css/style.css` (맨 위 `:root` 변수) |
| 새 버튼 동작 | HTML에 `data-act="이름"` → `js/events.js`의 `actions`에 함수 추가 |

새 JS 파일을 추가했다면 `sw.js`의 `APP_FILES`에도 넣고, 배포할 때마다 `sw.js`의 `VERSION`을 올려 주세요.
