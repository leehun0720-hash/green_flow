// 이미지 생성 — Gemini(Google) Imagen 모델 사용
import { GoogleGenAI } from "@google/genai";
import { getSecret } from "./secrets.js";

const DEFAULT_MODEL = "imagen-4.0-generate-001";

function getClient() {
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.");
  }
  return new GoogleGenAI({ apiKey });
}

function sizeToAspectRatio(size) {
  if (size === "1536x1024" || size === "1792x1024") return "16:9";
  if (size === "1024x1536" || size === "1024x1792") return "9:16";
  return "1:1";
}

// prompt로 이미지 1장을 생성해 PNG/JPEG Buffer로 반환한다.
export async function generateImage({ prompt, size = "1024x1024", model }) {
  const response = await getClient().models.generateImages({
    model: model || DEFAULT_MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: sizeToAspectRatio(size),
    },
  });
  const item = response.generatedImages?.[0];
  if (!item?.image?.imageBytes) {
    throw new Error(item?.raiFilteredReason || "이미지 생성 응답에서 결과를 찾을 수 없습니다.");
  }
  return Buffer.from(item.image.imageBytes, "base64");
}
