import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Electron 패키징 환경에서는 설치 폴더가 읽기 전용일 수 있으므로, main.js가 주입하는
// GREENFLOW_DATA_DIR(app.getPath('userData'))이 있으면 그쪽에 저장한다. 없으면 기존처럼
// 저장소 폴더 안의 server/data를 사용한다(웹 배포·로컬 개발 시 동작 그대로 유지).
export const DATA_DIR = process.env.GREENFLOW_DATA_DIR || path.join(__dirname, "..", "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function readJson(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

export function writeJson(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf-8");
}
