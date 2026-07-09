// 음성 내레이션 생성 — OpenAI TTS
import OpenAI from "openai";
import { getSecret } from "./secrets.js";

const DEFAULT_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "alloy";

function getClient() {
  const apiKey = getSecret("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.");
  }
  return new OpenAI({ apiKey });
}

// text를 읽는 mp3 음성을 생성해 Buffer로 반환한다.
export async function generateSpeech({ text, voice, model }) {
  const response = await getClient().audio.speech.create({
    model: model || DEFAULT_MODEL,
    voice: voice || DEFAULT_VOICE,
    input: text,
    response_format: "mp3",
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
