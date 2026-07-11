import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { readJson, writeJson, DATA_DIR } from "./lib/store.js";
import {
  DEFAULT_SETTINGS,
  buildSystemPrompt,
  buildGenerationUserPrompt,
  GENERATION_SCHEMA,
  buildReportPrompt,
} from "./lib/prompts.js";
import { generateChannelContent, generateText } from "./lib/aiProvider.js";
import { runClipping } from "./lib/naver.js";
import { publishFacebookPost, publishInstagramImage, publishInstagramReel, metaConnectionStatus } from "./lib/meta.js";
import { startScheduler, runScheduledPublishing } from "./lib/scheduler.js";
import { secretsStatus, setSecrets, getSecrets } from "./lib/secrets.js";
import { generateImage } from "./lib/imageProvider.js";
import { composeCard } from "./lib/cardCompose.js";
import { hasLogo, getLogoBuffer, saveLogo, deleteLogo, stampLogo } from "./lib/logo.js";
import { generateSpeech } from "./lib/ttsProvider.js";

// 스케줄러가 1분마다 도는 장기 구동 프로세스이므로, 요청 하나·타이머 콜백 하나에서 새는 예외가
// 프로세스 전체를 죽이지 않도록 막는다(기본 동작은 Node가 종료해버리는 것 — 예약 발행이 통째로 멈춤).
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

const IMAGES_DIR = path.join(DATA_DIR, "images");
const BRAND_DIR = path.join(DATA_DIR, "branding");
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(BRAND_DIR)) fs.mkdirSync(BRAND_DIR, { recursive: true });

// AI 배경 이미지에 원치 않는 외국어 표기·엉터리 브랜드명 오타·비한국인 인물이 나오는 것을 막기 위한
// 공통 지침. 블로그 대표 이미지·카드뉴스 배경·쇼츠 배경 생성 프롬프트에 모두 덧붙인다.
// 로고·브랜드명은 이미지 생성 후 코드(stampLogo·composeCard)로 정확하게 합성되므로,
// AI에게는 아예 그리지 말라고 강하게 지시한다 — 그렇지 않으면 철자가 깨진 상태로 자주 나온다
// (예: "그린플로"가 간판에 "Greenflo"나 의미 없는 한글로 잘못 그려지는 경우).
const IMAGE_LOCALE_GUIDE =
  "이미지 속 모니터·태블릿·스마트폰 화면에는 읽을 수 있는 글자·UI·앱 이름 대신 흐릿하게 처리된 그래프·차트· " +
  "도형 같은 추상적인 그래픽만 표시한다. 벽면 간판·배너·명함·문서에는 실제 문구 대신 빈 공간이나 추상적인 " +
  "무늬로 대체한다. 어떤 경우에도 회사명·브랜드명·제품명을 지어내거나 실제로 그려 넣지 않는다(주제 설명에 " +
  "특정 브랜드명이 언급되어 있어도 마찬가지다). 요약하면: 이미지 전체에 읽을 수 있는 문자가 단 하나도 없어야 " +
  "한다. 만에 하나 불가피하게 글자가 등장하면 한국어 또는 영어로만 표현한다(다른 언어 문자 금지). " +
  "사람이 등장하면 반드시 한국인으로 보이는 동아시아 외모로 표현한다.";

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use("/generated-images", express.static(IMAGES_DIR));
app.use("/branding", express.static(BRAND_DIR));

// ---------- 설정 (상주 지침: 브랜드/용어집/톤/키워드 풀) ----------
app.get("/api/settings", (_req, res) => {
  // 저장 파일에 없는 신규 필드(앱 업데이트로 추가된 설정)는 기본값으로 채워서 내려보낸다
  res.json({ ...DEFAULT_SETTINGS, ...readJson("settings", {}) });
});

app.put("/api/settings", (req, res) => {
  const merged = { ...DEFAULT_SETTINGS, ...readJson("settings", {}), ...req.body };
  writeJson("settings", merged);
  res.json(merged);
});

// ---------- 브랜드 로고 — 카드뉴스·블로그 대표 이미지에 합성된다 ----------
app.get("/api/settings/logo", (_req, res) => {
  res.json({ exists: hasLogo(), url: hasLogo() ? `/branding/logo.png?t=${Date.now()}` : null });
});

app.post("/api/settings/logo", async (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl) return res.status(400).json({ error: "이미지 파일이 필요합니다." });
    await saveLogo(dataUrl);
    res.json({ exists: true, url: `/branding/logo.png?t=${Date.now()}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/settings/logo", (_req, res) => {
  deleteLogo();
  res.json({ exists: false, url: null });
});

// ---------- 02 도구 스택 & 계정 준비 — API 키 관리 (설정 화면에서 즉시 입력/변경) ----------
// 보안: 실제 키 값은 절대 응답으로 내려보내지 않고, 설정 여부 + 마스킹된 미리보기만 반환한다.
app.get("/api/secrets", (_req, res) => {
  res.json(secretsStatus());
});

app.put("/api/secrets", (req, res) => {
  // 빈 값으로 보낸 필드는 무시(실수로 기존 키를 지우는 것을 방지) — 지우려면 /api/secrets/:key DELETE 사용
  const toUpdate = Object.fromEntries(Object.entries(req.body || {}).filter(([, v]) => v));
  setSecrets(toUpdate);
  res.json(secretsStatus());
});

app.delete("/api/secrets/:key", (req, res) => {
  setSecrets({ [req.params.key]: "" });
  res.json(secretsStatus());
});

// ---------- 백업 / 복원 — 설정·API 키·기록 전체를 JSON 파일 하나로 내보내고 되돌린다 ----------
const BACKUP_STORES = ["settings", "secrets", "generations", "calendar", "clipping_log", "reports"];

app.get("/api/backup", (_req, res) => {
  const backup = {
    app: "greenflow-content-automation",
    version: 1,
    exportedAt: new Date().toISOString(),
    stores: Object.fromEntries(BACKUP_STORES.map((name) => [name, readJson(name, null)])),
    logo: hasLogo() ? getLogoBuffer().toString("base64") : null,
  };
  const filename = `greenflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json(backup);
});

app.post("/api/restore", async (req, res) => {
  try {
    const backup = req.body;
    if (backup?.app !== "greenflow-content-automation" || !backup.stores) {
      return res.status(400).json({ error: "올바른 greenflow 백업 파일이 아닙니다." });
    }
    for (const name of BACKUP_STORES) {
      if (backup.stores[name] != null) writeJson(name, backup.stores[name]);
    }
    if (backup.logo) {
      await saveLogo(`data:image/png;base64,${backup.logo}`);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- 03·04 생성 자동화 파이프라인 ----------
app.post("/api/generate", async (req, res) => {
  try {
    const { source, purpose, keywords } = req.body;
    if (!source || !source.trim()) {
      return res.status(400).json({ error: "원본(기사 전문 또는 보도자료)을 입력하세요." });
    }
    const settings = readJson("settings", DEFAULT_SETTINGS);
    const systemPrompt = buildSystemPrompt(settings);
    const userPrompt = buildGenerationUserPrompt({ source, purpose, keywords });

    const result = await generateChannelContent({
      systemPrompt,
      userPrompt,
      schema: GENERATION_SCHEMA,
    });

    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      purpose: purpose || "",
      keywords: keywords || "",
      sourceExcerpt: source.slice(0, 300),
      result,
      review: { grade: null, checklist: {}, reviewerNote: "" },
    };
    const generations = readJson("generations", []);
    generations.unshift(record);
    writeJson("generations", generations.slice(0, 200));

    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/generations", (_req, res) => {
  res.json(readJson("generations", []));
});

app.delete("/api/generations/:id", (req, res) => {
  const generations = readJson("generations", []);
  writeJson("generations", generations.filter((g) => g.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- 05 사람 검수 게이트 ----------
app.put("/api/generations/:id/review", (req, res) => {
  const generations = readJson("generations", []);
  const idx = generations.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "생성 기록을 찾을 수 없습니다." });
  generations[idx].review = { ...generations[idx].review, ...req.body };
  writeJson("generations", generations);
  res.json(generations[idx]);
});

// ---------- 이미지 생성 — 블로그 대표 이미지 · 카드뉴스 배경(OpenAI 또는 Gemini 키 필요) ----------
app.post("/api/images/blog", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "이미지로 표현할 주제를 입력하세요." });
    }
    const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
    const fullPrompt = `${prompt.trim()}. 브랜드 톤: ${settings.brandDef}. 사진 같은 고품질 블로그 대표 이미지. 텍스트·글자·워터마크·로고는 절대 포함하지 않는다. ${IMAGE_LOCALE_GUIDE}`;

    const { buffer, provider } = await generateImage({ prompt: fullPrompt, size: "1536x1024", settings });
    const finalBuffer = hasLogo() ? await stampLogo(buffer, getLogoBuffer(), { corner: "bottom-right" }) : buffer;
    const filename = `blog-${randomUUID()}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), finalBuffer);
    res.json({ url: `/generated-images/${filename}`, provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/images/cardnews", async (req, res) => {
  try {
    const { cards, stylePrompt } = req.body;
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: "카드 목록이 필요합니다." });
    }
    const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
    const bgPrompt = `${
      stylePrompt?.trim() || `${settings.brandDef}(${settings.brandModifier}) 브랜드 느낌의 추상적이고 미니멀한 그라디언트 배경 디자인`
    }. 세로형 소셜미디어 카드뉴스용 배경 이미지. 텍스트·글자·숫자·워터마크·로고는 절대 포함하지 않는다 — 순수 배경 그래픽만. ${IMAGE_LOCALE_GUIDE}`;

    const { buffer: backgroundBuffer, provider } = await generateImage({ prompt: bgPrompt, size: "1024x1024", settings });
    const logoBuffer = getLogoBuffer();

    const urls = [];
    for (let i = 0; i < cards.length; i++) {
      const composed = await composeCard({
        backgroundBuffer,
        headline: cards[i].headline,
        subcopy: cards[i].subcopy,
        cardIndex: i + 1,
        totalCards: cards.length,
        brandLabel: settings.brandName,
        logoBuffer,
      });
      const filename = `card-${randomUUID()}-${i + 1}.png`;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), composed);
      urls.push(`/generated-images/${filename}`);
    }
    res.json({ urls, provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 쇼츠 영상용 장면별 배경 이미지 — 텍스트·로고 합성과 실제 영상 녹화(MediaRecorder)는
// 브라우저에서 진행하므로, 여기서는 순수 배경 이미지들만 세로형(9:16)으로 생성해 돌려준다.
app.post("/api/images/shorts", async (req, res) => {
  try {
    const { prompts } = req.body;
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ error: "장면별 이미지 프롬프트가 필요합니다." });
    }
    const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
    const urls = [];
    let provider;
    for (const p of prompts) {
      const fullPrompt = `${p}. 브랜드 톤: ${settings.brandDef}. 세로형 숏폼 영상 배경 이미지, 영화 같은 고품질. 텍스트·글자·자막·워터마크·로고는 절대 포함하지 않는다. ${IMAGE_LOCALE_GUIDE}`;
      const result = await generateImage({ prompt: fullPrompt, size: "1024x1536", settings });
      provider = result.provider;
      const filename = `shorts-${randomUUID()}.png`;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), result.buffer);
      urls.push(`/generated-images/${filename}`);
    }
    res.json({ urls, provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 쇼츠 영상용 장면별 AI 음성 내레이션 — 각 문장을 개별 음성 파일로 만들어 돌려준다.
// 클립 길이가 각 장면의 화면 노출 시간을 결정하므로(shortsVideo.js), 문장 단위로 나눠서 요청한다.
app.post("/api/audio/narration", async (req, res) => {
  try {
    const { texts } = req.body;
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: "내레이션할 문장 목록이 필요합니다." });
    }
    const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
    const clips = [];
    let provider;
    for (const text of texts) {
      const result = await generateSpeech({ text, settings });
      provider = result.provider;
      const filename = `narration-${randomUUID()}.${result.ext}`;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), result.buffer);
      clips.push({ url: `/generated-images/${filename}`, mimeType: result.mimeType });
    }
    res.json({ clips, provider });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- 08 예약 발행 자동화 & 콘텐츠 캘린더 ----------
app.get("/api/calendar", (_req, res) => {
  res.json(readJson("calendar", []));
});

app.post("/api/calendar", (req, res) => {
  const rows = readJson("calendar", []);
  const row = {
    id: randomUUID(),
    datetime: req.body.datetime || "",
    channel: req.body.channel || "블로그",
    type: req.body.type || "규제해설",
    source: req.body.source || "",
    status: req.body.status || "초안",
    url: req.body.url || "",
    note: req.body.note || "",
    // SNS 자동 발행용 (페이스북/카드뉴스/릴스)
    caption: req.body.caption || "",
    imageUrl: req.body.imageUrl || "",
    videoUrl: req.body.videoUrl || "",
    link: req.body.link || "",
    createdAt: new Date().toISOString(),
  };
  rows.push(row);
  writeJson("calendar", rows);
  res.json(row);
});

app.put("/api/calendar/:id", (req, res) => {
  const rows = readJson("calendar", []);
  const idx = rows.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "행을 찾을 수 없습니다." });
  rows[idx] = { ...rows[idx], ...req.body };
  writeJson("calendar", rows);
  res.json(rows[idx]);
});

app.delete("/api/calendar/:id", (req, res) => {
  const rows = readJson("calendar", []);
  writeJson("calendar", rows.filter((r) => r.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- SNS(인스타그램·페이스북) 자동 발행 — Meta Graph API ----------
app.post("/api/calendar/:id/publish-now", async (req, res) => {
  const rows = readJson("calendar", []);
  const idx = rows.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "행을 찾을 수 없습니다." });
  const row = rows[idx];

  try {
    let result;
    if (row.channel === "페이스북") {
      result = await publishFacebookPost({ message: row.caption, imageUrl: row.imageUrl, link: row.link });
    } else if (row.channel === "카드뉴스") {
      result = await publishInstagramImage({ imageUrl: row.imageUrl, caption: row.caption });
    } else if (row.channel === "릴스") {
      result = await publishInstagramReel({ videoUrl: row.videoUrl, caption: row.caption });
    } else {
      return res.status(400).json({ error: `자동 발행을 지원하지 않는 채널입니다: ${row.channel}` });
    }

    rows[idx] = {
      ...row,
      status: "발행",
      url: result.permalink || row.url,
      note: [row.note, `수동 발행 완료 ${new Date().toLocaleString("ko-KR")}`].filter(Boolean).join(" · "),
    };
    writeJson("calendar", rows);
    res.json(rows[idx]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 스케줄러를 즉시 1회 실행(테스트/수동 트리거용)
app.post("/api/calendar/run-scheduler", async (_req, res) => {
  await runScheduledPublishing();
  res.json(readJson("calendar", []));
});

// ---------- 09 클리핑·모니터링 자동화 ----------
app.post("/api/clipping/run", async (req, res) => {
  try {
    const keywords = req.body?.keywords?.length ? req.body.keywords : undefined;
    const rows = await runClipping(keywords);
    const log = readJson("clipping_log", []);
    const updated = [...rows, ...log].slice(0, 2000);
    writeJson("clipping_log", updated);
    res.json({ collected: rows.length, rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/clipping", (_req, res) => {
  res.json(readJson("clipping_log", []));
});

// ---------- 10 월간 리포트 자동화 ----------
app.post("/api/report/generate", async (req, res) => {
  try {
    const { month, channelMetrics } = req.body; // month: "YYYY-MM"
    if (!month) return res.status(400).json({ error: "대상 월(YYYY-MM)을 지정하세요." });

    const log = readJson("clipping_log", []).filter((r) => r.date?.startsWith(month));
    const clippingCsv = log
      .map((r) => `${r.date},${r.kind},${r.keyword},"${r.title}",${r.link}`)
      .join("\n");

    const calendar = readJson("calendar", []).filter((r) => r.datetime?.startsWith(month));
    const calendarSummary = calendar
      .map((r) => `${r.datetime} | ${r.channel} | ${r.type} | 상태:${r.status} | ${r.url}`)
      .join("\n");

    const reportText = await generateText({
      userPrompt: buildReportPrompt({ month, clippingCsv, calendarSummary, channelMetrics }),
    });

    const record = { id: randomUUID(), month, createdAt: new Date().toISOString(), reportText };
    const reports = readJson("reports", []);
    reports.unshift(record);
    writeJson("reports", reports.slice(0, 60));

    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/reports", (_req, res) => {
  res.json(readJson("reports", []));
});

app.delete("/api/reports/:id", (req, res) => {
  const reports = readJson("reports", []);
  writeJson("reports", reports.filter((r) => r.id !== req.params.id));
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  const secrets = getSecrets();
  res.json({
    ok: true,
    hasAnthropicKey: !!secrets.ANTHROPIC_API_KEY,
    hasOpenAIKey: !!secrets.OPENAI_API_KEY,
    hasGeminiKey: !!secrets.GEMINI_API_KEY,
    hasNaverKeys: !!(secrets.NAVER_ID && secrets.NAVER_SECRET),
    ...metaConnectionStatus(),
  });
});

// Electron 메인 프로세스는 이 함수를 직접 호출해 동적으로 찾은 빈 포트로 서버를 띄운다.
// 일반 웹 개발/배포(npm run dev, npm start)에서는 아래에서 즉시 자동 기동된다.
export function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, () => {
        console.log(`greenflow content automation API listening on http://localhost:${port}`);
        // 08 예약 발행 자동화 — 1분마다 예약된 SNS 게시물을 확인해 자동 발행
        startScheduler();
        resolve(server);
      })
      .on("error", reject);
  });
}

// Electron 앱에서는 main.js가 startServer()를 직접 호출하므로 여기서 자동 기동하지 않는다.
if (process.env.GREENFLOW_ELECTRON !== "1") {
  const PORT = process.env.API_PORT || 8790;
  startServer(PORT);
}
