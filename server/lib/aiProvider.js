// 02 · TOOL STACK — AI 공급자 선택
// 설정 화면에서 고른 공급자(Claude/ChatGPT/Gemini)에 맞춰 실제 생성 함수를 호출로 위임한다.

import { readJson } from "./store.js";
import { DEFAULT_SETTINGS } from "./prompts.js";
import * as anthropic from "./claude.js";
import * as openai from "./openai.js";
import * as gemini from "./gemini.js";

const MODULES = { anthropic, openai, gemini };
const MODEL_FIELD = {
  anthropic: "aiModelAnthropic",
  openai: "aiModelOpenAI",
  gemini: "aiModelGemini",
};
const PROVIDER_LABEL = {
  anthropic: "Claude(Anthropic)",
  openai: "ChatGPT(OpenAI)",
  gemini: "Gemini(Google)",
};

function resolveProvider() {
  const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
  const providerId = MODULES[settings.aiProvider] ? settings.aiProvider : "anthropic";
  const mod = MODULES[providerId];
  const model = settings[MODEL_FIELD[providerId]] || DEFAULT_SETTINGS[MODEL_FIELD[providerId]];
  return { mod, model, providerId };
}

function wrapProviderError(providerId, e) {
  const err = new Error(`[${PROVIDER_LABEL[providerId]}] ${e.message}`);
  err.cause = e;
  return err;
}

export async function generateChannelContent(args) {
  const { mod, model, providerId } = resolveProvider();
  try {
    return await mod.generateChannelContent({ ...args, model });
  } catch (e) {
    throw wrapProviderError(providerId, e);
  }
}

export async function generateText(args) {
  const { mod, model, providerId } = resolveProvider();
  try {
    return await mod.generateText({ ...args, model });
  } catch (e) {
    throw wrapProviderError(providerId, e);
  }
}
