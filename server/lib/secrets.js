// 02 · TOOL STACK — API 키 관리
// 설정 화면에서 입력한 키는 server/data/secrets.json 에 저장되며, 입력하지 않은 항목은
// .env 값을 그대로 사용한다(둘 다 없으면 미설정). 서버 재시작 없이 즉시 반영된다.

import { readJson, writeJson } from "./store.js";

export const SECRET_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "NAVER_ID",
  "NAVER_SECRET",
  "META_PAGE_ID",
  "META_IG_USER_ID",
  "META_PAGE_ACCESS_TOKEN",
];

export function getSecrets() {
  const stored = readJson("secrets", {});
  const merged = {};
  for (const key of SECRET_KEYS) {
    merged[key] = stored[key] || process.env[key] || "";
  }
  return merged;
}

export function getSecret(key) {
  return getSecrets()[key] || "";
}

// partial: { KEY: "새값", ... } — 값이 빈 문자열이면 해당 키를 지운다(.env 값으로 되돌아감)
export function setSecrets(partial) {
  const stored = readJson("secrets", {});
  for (const [key, value] of Object.entries(partial)) {
    if (!SECRET_KEYS.includes(key)) continue;
    if (value) stored[key] = value;
    else delete stored[key];
  }
  writeJson("secrets", stored);
  return getSecrets();
}

function maskValue(v) {
  if (!v) return "";
  if (v.length <= 8) return "•".repeat(v.length);
  return `${v.slice(0, 4)}${"•".repeat(Math.max(4, v.length - 8))}${v.slice(-4)}`;
}

// 실제 키 값은 절대 프런트엔드로 내려보내지 않고, 설정 여부와 마스킹된 미리보기만 전달한다.
export function secretsStatus() {
  const s = getSecrets();
  const status = {};
  for (const key of SECRET_KEYS) {
    status[key] = { set: !!s[key], preview: maskValue(s[key]) };
  }
  return status;
}
