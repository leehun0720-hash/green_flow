import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

import { readJson, writeJson } from "./lib/store.js";
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
import { generateImage } from "./lib/openaiImage.js";
import { composeCard } from "./lib/cardCompose.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, "data", "images");
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use("/generated-images", express.static(IMAGES_DIR));

// ---------- 설정 (상주 지침: 브랜드/용어집/톤/키워드 풀) ----------
app.get("/api/settings", (_req, res) => {
  res.json(readJson("settings", DEFAULT_SETTINGS));
});

app.put("/api/settings", (req, res) => {
  const merged = { ...DEFAULT_SETTINGS, ...readJson("settings", {}), ...req.body };
  writeJson("settings", merged);
  res.json(merged);
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

// ---------- 05 사람 검수 게이트 ----------
app.put("/api/generations/:id/review", (req, res) => {
  const generations = readJson("generations", []);
  const idx = generations.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "생성 기록을 찾을 수 없습니다." });
  generations[idx].review = { ...generations[idx].review, ...req.body };
  writeJson("generations", generations);
  res.json(generations[idx]);
});

// ---------- 이미지 생성 — 블로그 대표 이미지 · 카드뉴스 배경(OpenAI 키 필요) ----------
app.post("/api/images/blog", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "이미지로 표현할 주제를 입력하세요." });
    }
    const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
    const fullPrompt = `${prompt.trim()}. 브랜드 톤: ${settings.brandDef}. 사진 같은 고품질 블로그 대표 이미지. 텍스트·글자·워터마크·로고는 절대 포함하지 않는다.`;

    const buffer = await generateImage({ prompt: fullPrompt, size: "1536x1024" });
    const filename = `blog-${randomUUID()}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
    res.json({ url: `/generated-images/${filename}` });
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
    }. 세로형 소셜미디어 카드뉴스용 배경 이미지. 텍스트·글자·숫자·워터마크·로고는 절대 포함하지 않는다 — 순수 배경 그래픽만.`;

    const backgroundBuffer = await generateImage({ prompt: bgPrompt, size: "1024x1024" });

    const urls = [];
    for (let i = 0; i < cards.length; i++) {
      const composed = await composeCard({
        backgroundBuffer,
        headline: cards[i].headline,
        subcopy: cards[i].subcopy,
        cardIndex: i + 1,
        totalCards: cards.length,
        brandLabel: settings.brandName,
      });
      const filename = `card-${randomUUID()}-${i + 1}.png`;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), composed);
      urls.push(`/generated-images/${filename}`);
    }
    res.json({ urls });
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

const PORT = process.env.API_PORT || 8790;
app.listen(PORT, () => {
  console.log(`greenflow content automation API listening on http://localhost:${PORT}`);
  // 08 예약 발행 자동화 — 1분마다 예약된 SNS 게시물을 확인해 자동 발행
  startScheduler();
});
