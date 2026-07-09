// Electron preload — 렌더러(React 앱)에 백엔드 API의 실제 origin을 전달한다.
// main.js가 동적으로 찾은 포트로 Express 서버를 띄우기 때문에, 렌더러는 그 값을 미리 알 수 없다.
// main.js가 BrowserWindow 생성 시 additionalArguments로 넘긴 --api-base=... 값을 읽어
// window.__API_BASE__ 로 노출한다(src/api.js가 이 값을 사용한다).
const { contextBridge } = require("electron");

const arg = process.argv.find((a) => a.startsWith("--api-base="));
const apiBase = arg ? arg.slice("--api-base=".length) : "";

contextBridge.exposeInMainWorld("__API_BASE__", apiBase);
