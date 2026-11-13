/**
 * 앱 설정
 *
 * Firebase 설정값을 여기에 넣으면 이 사이트를 여는 모든 사람이 자동으로 같은 서버에 연결돼요.
 * 비워 두면(null) 각자 폰에만 저장되고, 앱의 ⚙️ 설정 화면에서 붙여넣어 연결할 수도 있어요.
 *
 * Firebase 웹 설정값(apiKey 등)은 비밀번호가 아니라서 깃허브에 올려도 괜찮아요.
 * 실제 보안은 firestore.rules(누가 쓸 수 있는지)로 지켜요.
 */
export const FIREBASE_CONFIG = null;
// 예시:
// export const FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "my-squad.firebaseapp.com",
//   projectId: "my-squad",
//   storageBucket: "my-squad.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef",
// };

/** 같은 Firebase 프로젝트에서 여러 모임을 따로 쓰고 싶을 때 바꾸는 이름 (영문/숫자) */
export const GROUP_ID = "my-team";

/** Firebase JS SDK 버전 (CDN) */
export const FIREBASE_SDK_VERSION = "10.12.2";

/** localStorage 키 */
export const STORAGE_KEY = "squadmaker_v1";
export const CONFIG_KEY = "squadmaker_cfg";
