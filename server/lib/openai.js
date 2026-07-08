import OpenAI from "openai";
import { getSecret } from "./secrets.js";

const DEFAULT_MODEL = "gpt-5.5";

function getClient() {
  const apiKey = getSecret("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.");
  }
  return new OpenAI({ apiKey });
}

function assertNotRefused(choice) {
  if (choice.finish_reason === "content_filter") {
    throw new Error("생성이 거부되었습니다(안전 정책). 원본 내용을 확인해주세요.");
  }
}

// 채널별 콘텐츠 4종을 구조화 출력(JSON 스키마)으로 생성
export async function generateChannelContent({ systemPrompt, userPrompt, schema, model }) {
  const response = await getClient().chat.completions.create({
    model: model || DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: schema.name, schema: schema.schema, strict: true },
    },
  });

  const choice = response.choices[0];
  assertNotRefused(choice);
  if (!choice?.message?.content) throw new Error("모델 응답에서 콘텐츠를 찾을 수 없습니다.");
  return JSON.parse(choice.message.content);
}

// 월간 리포트 등 자유 형식 텍스트 생성
export async function generateText({ systemPrompt, userPrompt, model }) {
  const response = await getClient().chat.completions.create({
    model: model || DEFAULT_MODEL,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: userPrompt },
    ],
  });

  const choice = response.choices[0];
  assertNotRefused(choice);
  if (!choice?.message?.content) throw new Error("모델 응답에서 콘텐츠를 찾을 수 없습니다.");
  return choice.message.content;
}
