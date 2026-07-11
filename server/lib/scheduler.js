// 08 · SCHEDULING SYSTEM — 예약 발행 자동화 + 클리핑 자동 수집 + 오래된 미디어 정리
// 캘린더에서 '예약됨' 상태이고 예정 시각이 지난 SNS 행(페이스북·카드뉴스·릴스)을 찾아 Meta Graph API로 자동 발행한다.

import fs from "fs";
import path from "path";
import { readJson, writeJson, DATA_DIR } from "./store.js";
import { publishFacebookPost, publishInstagramImage, publishInstagramReel } from "./meta.js";
import { runClipping } from "./naver.js";
import { DEFAULT_SETTINGS } from "./prompts.js";

const AUTO_PUBLISH_CHANNELS = new Set(["페이스북", "카드뉴스", "릴스"]);
let running = false;

async function publishRow(row) {
  if (row.channel === "페이스북") {
    return publishFacebookPost({ message: row.caption, imageUrl: row.imageUrl, link: row.link });
  }
  if (row.channel === "카드뉴스") {
    return publishInstagramImage({ imageUrl: row.imageUrl, caption: row.caption });
  }
  if (row.channel === "릴스") {
    return publishInstagramReel({ videoUrl: row.videoUrl, caption: row.caption });
  }
  throw new Error(`자동 발행을 지원하지 않는 채널입니다: ${row.channel}`);
}

export async function runScheduledPublishing() {
  if (running) return; // 중복 실행 방지
  running = true;
  try {
    const rows = readJson("calendar", []);
    const now = new Date();
    let changed = false;

    for (const row of rows) {
      if (!AUTO_PUBLISH_CHANNELS.has(row.channel)) continue;
      if (row.status !== "예약됨") continue;
      if (!row.datetime || new Date(row.datetime) > now) continue;

      try {
        const result = await publishRow(row);
        row.status = "발행";
        row.url = result.permalink || row.url;
        row.note = [row.note, `자동 발행 완료 ${new Date().toISOString()}`].filter(Boolean).join(" · ");
      } catch (e) {
        row.note = [row.note, `자동 발행 실패(${new Date().toLocaleString("ko-KR")}): ${e.message}`]
          .filter(Boolean)
          .join(" · ");
      }
      changed = true;
    }

    if (changed) writeJson("calendar", rows);
  } finally {
    running = false;
  }
}

// 클리핑 자동 수집 — 설정에서 켜두면 매일 지정 시각(HH:MM)에 1회 수집한다.
// 외부 작업 스케줄러(cron/작업 스케줄러) 없이 앱이 상시 구동(Electron 트레이)되는 것을 활용한다.
export async function runAutoClipping() {
  const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
  if (!settings.clippingAutoEnabled) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const target = settings.clippingAutoTime || "09:00";

  // 아직 지정 시각 전이거나 오늘 이미 실행했으면 건너뛴다.
  // (같다가 아니라 이상 비교 — 지정 시각에 앱이 꺼져 있었다가 나중에 켜져도 그날 안에 따라잡는다)
  if (hhmm < target) return;
  const state = readJson("clipping_auto_state", {});
  if (state.lastRunDate === today) return;

  writeJson("clipping_auto_state", { lastRunDate: today, lastRunAt: now.toISOString() });
  try {
    const rows = await runClipping(); // 키워드 미지정 → 설정의 clippingKeywords 사용
    const log = readJson("clipping_log", []);
    writeJson("clipping_log", [...rows, ...log].slice(0, 2000));
    console.log(`[auto-clipping] ${today} ${hhmm} — ${rows.length}건 수집`);
  } catch (e) {
    console.error(`[auto-clipping] 실패: ${e.message}`);
  }
}

// 생성 이미지·영상·내레이션 파일이 무한히 쌓이지 않도록 30일 지난 파일을 정리한다.
// (설정·생성 기록 JSON은 건드리지 않는다 — 디스크를 실제로 차지하는 미디어 파일만)
const MEDIA_RETENTION_DAYS = 30;
export function cleanupOldMedia() {
  const imagesDir = path.join(DATA_DIR, "images");
  if (!fs.existsSync(imagesDir)) return;
  const cutoff = Date.now() - MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const file of fs.readdirSync(imagesDir)) {
    const p = path.join(imagesDir, file);
    try {
      if (fs.statSync(p).mtimeMs < cutoff) {
        fs.unlinkSync(p);
        removed++;
      }
    } catch {
      /* 사용 중인 파일 등은 건너뛴다 */
    }
  }
  if (removed > 0) console.log(`[media-cleanup] ${MEDIA_RETENTION_DAYS}일 지난 파일 ${removed}개 정리`);
}

export function startScheduler(intervalMs = 60_000) {
  runScheduledPublishing();
  cleanupOldMedia();
  setInterval(cleanupOldMedia, 24 * 60 * 60 * 1000);
  return setInterval(() => {
    runScheduledPublishing();
    runAutoClipping();
  }, intervalMs);
}
