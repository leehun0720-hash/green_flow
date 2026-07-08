import Anthropic from "@anthropic-ai/sdk";
import { getSecret } from "./secrets.js";

const DEFAULT_MODEL = "claude-opus-4-8";

function getClient() {
  const apiKey = getSecret("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.");
  }
  return new Anthropic({ apiKey });
}

// 채널별 콘텐츠 4종을 구조화 출력(JSON 스키마)으로 생성
export async function generateChannelContent({ systemPrompt, userPrompt, schema, model }) {
  const response = await getClient().messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    output_config: {
      format: { type: "json_schema", schema: schema.schema },
    },
    messages: [{ role: "user", content: userPrompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("생성이 거부되었습니다(안전 정책). 원본 내용을 확인해주세요.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("모델 응답에서 텍스트 블록을 찾을 수 없습니다.");
  return JSON.parse(textBlock.text);
}

// 월간 리포트 등 자유 형식 텍스트 생성
export async function generateText({ systemPrompt, userPrompt, model }) {
  const response = await getClient().messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 8000,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: userPrompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("생성이 거부되었습니다(안전 정책).");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("모델 응답에서 텍스트 블록을 찾을 수 없습니다.");
  return textBlock.text;
}
