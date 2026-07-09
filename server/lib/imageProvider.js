// 이미지 생성 공급자 디스패처 — OpenAI 또는 Gemini 중 사용 가능한 키로 자동 선택한다.
// Claude(Anthropic)는 이미지 생성을 지원하지 않으므로 대상에서 제외한다.
import { getSecret } from "./secrets.js";
import { generateImage as generateImageOpenAI } from "./openaiImage.js";
import { generateImage as generateImageGemini } from "./geminiImage.js";

const LABELS = { openai: "OpenAI", gemini: "Gemini" };

function pickProvider(settings) {
  const hasOpenAI = !!getSecret("OPENAI_API_KEY");
  const hasGemini = !!getSecret("GEMINI_API_KEY");
  const preferred = settings?.aiProvider;

  if (preferred === "gemini" && hasGemini) return "gemini";
  if (preferred === "openai" && hasOpenAI) return "openai";
  if (hasOpenAI) return "openai";
  if (hasGemini) return "gemini";

  throw new Error(
    "이미지 생성에는 OpenAI 또는 Gemini API 키가 필요합니다. 설정 화면 → API 키 관리에서 하나를 입력하세요.",
  );
}

// prompt로 이미지 1장을 생성해 Buffer로 반환한다. 사용 가능한 공급자(OpenAI 우선, 없으면 Gemini)를 자동 선택한다.
export async function generateImage({ prompt, size, settings }) {
  const provider = pickProvider(settings);
  try {
    const buffer =
      provider === "openai"
        ? await generateImageOpenAI({ prompt, size })
        : await generateImageGemini({ prompt, size });
    return { buffer, provider };
  } catch (e) {
    throw new Error(`[${LABELS[provider]}] ${e.message}`);
  }
}
