// 이미지 생성 — 블로그 대표 이미지 · 카드뉴스 배경
// Claude(Anthropic)는 이미지를 생성하지 못하므로, 이 기능은 OpenAI 키가 별도로 필요하다.

import OpenAI from "openai";
import { getSecret } from "./secrets.js";

const DEFAULT_MODEL = "gpt-image-1";

function getClient() {
  const apiKey = getSecret("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다. 이미지 생성에는 OpenAI 키가 필요합니다(텍스트 생성 공급자와 별개). 설정 화면 또는 .env 파일을 확인하세요.",
    );
  }
  return new OpenAI({ apiKey });
}

// prompt로 이미지 1장을 생성해 PNG Buffer로 반환한다.
export async function generateImage({ prompt, size = "1024x1024", model }) {
  const response = await getClient().images.generate({
    model: model || DEFAULT_MODEL,
    prompt,
    size,
    n: 1,
  });
  const item = response.data?.[0];
  if (!item) throw new Error("이미지 생성 응답에서 결과를 찾을 수 없습니다.");
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`생성된 이미지 다운로드 실패 (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("이미지 생성 응답 형식을 처리할 수 없습니다.");
}
