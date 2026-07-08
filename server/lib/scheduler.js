// 08 · SCHEDULING SYSTEM — 예약 발행 자동화
// 캘린더에서 '예약됨' 상태이고 예정 시각이 지난 SNS 행(페이스북·카드뉴스·릴스)을 찾아 Meta Graph API로 자동 발행한다.

import { readJson, writeJson } from "./store.js";
import { publishFacebookPost, publishInstagramImage, publishInstagramReel } from "./meta.js";

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

export function startScheduler(intervalMs = 60_000) {
  runScheduledPublishing();
  return setInterval(runScheduledPublishing, intervalMs);
}
