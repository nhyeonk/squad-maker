/**
 * 앱 설정
 *
 * Firebase 설정값을 여기에 넣으면 이 사이트를 여는 모든 사람이 자동으로 같은 서버에 연결돼요.
 * 비워 두면(null) 각자 폰에만 저장되고, 앱의 ⚙️ 설정 화면에서 붙여넣어 연결할 수도 있어요.
 *
 * Firebase 웹 설정값(apiKey 등)은 비밀번호가 아니라서 깃허브에 올려도 괜찮아요.
 * 실제 보안은 firestore.rules(누가 쓸 수 있는지)로 지켜요.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDUXYlvpbVMmOJF4ae8cnwTxx2ZRwVsOK8",
  authDomain: "squad-maker-7254f.firebaseapp.com",
  projectId: "squad-maker-7254f",
  storageBucket: "squad-maker-7254f.firebasestorage.app",
  messagingSenderId: "258113198803",
  appId: "1:258113198803:web:8996d731fb0da3d9d81226",
};

/** 같은 Firebase 프로젝트에서 여러 모임을 따로 쓰고 싶을 때 바꾸는 이름 (영문/숫자) */
export const GROUP_ID = "my-team";

/** Firebase JS SDK 버전 (CDN) */
export const FIREBASE_SDK_VERSION = "10.12.2";

/** localStorage 키 */
export const STORAGE_KEY = "squadmaker_v1";
export const CONFIG_KEY = "squadmaker_cfg";

/** 앱 버전 (⚙️ 설정 맨 아래에 보여요. 수정해서 올릴 때마다 sw.js의 VERSION과 같이 올려 주세요) */
export const APP_VERSION = "v17";
