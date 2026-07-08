import { GoogleGenAI } from "@google/genai";
import { getSecret } from "./secrets.js";

const DEFAULT_MODEL = "gemini-3.5-flash";

function getClient() {
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.");
  }
  return new GoogleGenAI({ apiKey });
}

// 채널별 콘텐츠 4종을 구조화 출력(JSON 스키마)으로 생성
export async function generateChannelContent({ systemPrompt, userPrompt, schema, model }) {
  const interaction = await getClient().interactions.create({
    model: model || DEFAULT_MODEL,
    system_instruction: systemPrompt,
    input: userPrompt,
    response_format: { type: "text", mime_type: "application/json", schema: schema.schema },
  });

  if (!interaction.output_text) {
    throw new Error("생성이 거부되었거나 모델 응답에서 텍스트를 찾을 수 없습니다. 원본 내용을 확인해주세요.");
  }
  return JSON.parse(interaction.output_text);
}

// 월간 리포트 등 자유 형식 텍스트 생성
export async function generateText({ systemPrompt, userPrompt, model }) {
  const interaction = await getClient().interactions.create({
    model: model || DEFAULT_MODEL,
    ...(systemPrompt ? { system_instruction: systemPrompt } : {}),
    input: userPrompt,
  });

  if (!interaction.output_text) {
    throw new Error("생성이 거부되었거나 모델 응답에서 텍스트를 찾을 수 없습니다.");
  }
  return interaction.output_text;
}
