// 음성 내레이션 생성 — Gemini TTS
// Gemini Interactions API는 오디오를 16bit/24000Hz/모노 raw PCM(base64)으로 돌려주기 때문에,
// 브라우저 <audio>/디코딩이 바로 되도록 WAV 헤더를 직접 붙여서 저장한다.
import { GoogleGenAI } from "@google/genai";
import { getSecret } from "./secrets.js";

const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_VOICE = "Kore";
const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BIT_DEPTH = 16;

function getClient() {
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.");
  }
  return new GoogleGenAI({ apiKey });
}

function pcmToWav(pcmBuffer) {
  const byteRate = SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8);
  const blockAlign = CHANNELS * (BIT_DEPTH / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BIT_DEPTH, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

// text를 읽는 wav 음성을 생성해 Buffer로 반환한다.
export async function generateSpeech({ text, voice, model }) {
  const interaction = await getClient().interactions.create({
    model: model || DEFAULT_MODEL,
    input: text,
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice: voice || DEFAULT_VOICE, language: "ko-KR" }],
    },
  });
  if (!interaction.output_audio?.data) {
    throw new Error("음성 생성 응답에서 오디오 데이터를 찾을 수 없습니다.");
  }
  const pcm = Buffer.from(interaction.output_audio.data, "base64");
  return pcmToWav(pcm);
}
