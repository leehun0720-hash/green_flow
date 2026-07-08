// 07 · DISTRIBUTION ② SNS — 인스타그램·페이스북 자동 발행 (Meta Graph API)
// Meta Business Suite에서 사람이 클릭하던 예약 게시를 Graph API 호출로 대체한다.

import { getSecret } from "./secrets.js";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function requireMetaEnv() {
  if (!getSecret("META_PAGE_ID") || !getSecret("META_PAGE_ACCESS_TOKEN")) {
    throw new Error(
      "META_PAGE_ID / META_PAGE_ACCESS_TOKEN이 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.",
    );
  }
}

function requireInstagramEnv() {
  if (!getSecret("META_IG_USER_ID") || !getSecret("META_PAGE_ACCESS_TOKEN")) {
    throw new Error(
      "META_IG_USER_ID / META_PAGE_ACCESS_TOKEN이 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.",
    );
  }
}

async function graphPost(path, params) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: "POST", body });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Meta Graph API 오류: ${data.error.message} (code ${data.error.code})`);
  }
  return data;
}

async function graphGet(path, params) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Meta Graph API 오류: ${data.error.message} (code ${data.error.code})`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 페이스북 페이지 피드 발행 — 이미지가 있으면 사진 게시물, 없으면 텍스트/링크 게시물
export async function publishFacebookPost({ message, imageUrl, link }) {
  requireMetaEnv();
  const pageId = getSecret("META_PAGE_ID");
  const access_token = getSecret("META_PAGE_ACCESS_TOKEN");

  let result;
  if (imageUrl) {
    result = await graphPost(`/${pageId}/photos`, { url: imageUrl, caption: message || "", access_token });
  } else {
    result = await graphPost(`/${pageId}/feed`, { message: message || "", ...(link ? { link } : {}), access_token });
  }
  const postId = result.post_id || result.id;
  return { id: postId, permalink: `https://www.facebook.com/${postId}` };
}

// 인스타그램 피드 이미지 게시 (카드뉴스)
export async function publishInstagramImage({ imageUrl, caption }) {
  requireInstagramEnv();
  if (!imageUrl) throw new Error("인스타그램 피드 게시에는 이미지 URL이 필요합니다.");
  const igUserId = getSecret("META_IG_USER_ID");
  const access_token = getSecret("META_PAGE_ACCESS_TOKEN");

  const container = await graphPost(`/${igUserId}/media`, { image_url: imageUrl, caption: caption || "", access_token });
  const publish = await graphPost(`/${igUserId}/media_publish`, { creation_id: container.id, access_token });
  return getInstagramPermalink(publish.id);
}

// 인스타그램 릴스 영상 게시 — 처리 완료(FINISHED)까지 폴링 후 발행
export async function publishInstagramReel({ videoUrl, caption }) {
  requireInstagramEnv();
  if (!videoUrl) throw new Error("릴스 게시에는 영상 URL이 필요합니다.");
  const igUserId = getSecret("META_IG_USER_ID");
  const access_token = getSecret("META_PAGE_ACCESS_TOKEN");

  const container = await graphPost(`/${igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption || "",
    access_token,
  });

  const maxAttempts = 24; // 5초 간격 최대 2분
  for (let i = 0; i < maxAttempts; i++) {
    const status = await graphGet(`/${container.id}`, { fields: "status_code", access_token });
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`릴스 영상 처리 실패 (status_code: ${status.status_code})`);
    }
    if (i === maxAttempts - 1) {
      throw new Error("릴스 영상 처리가 시간 내에 끝나지 않았습니다. 다음 스케줄러 실행에서 재시도하세요.");
    }
    await sleep(5000);
  }

  const publish = await graphPost(`/${igUserId}/media_publish`, { creation_id: container.id, access_token });
  return getInstagramPermalink(publish.id);
}

async function getInstagramPermalink(mediaId) {
  const access_token = getSecret("META_PAGE_ACCESS_TOKEN");
  try {
    const info = await graphGet(`/${mediaId}`, { fields: "permalink", access_token });
    return { id: mediaId, permalink: info.permalink };
  } catch {
    return { id: mediaId, permalink: null };
  }
}

export function metaConnectionStatus() {
  return {
    hasFacebook: !!(getSecret("META_PAGE_ID") && getSecret("META_PAGE_ACCESS_TOKEN")),
    hasInstagram: !!(getSecret("META_IG_USER_ID") && getSecret("META_PAGE_ACCESS_TOKEN")),
  };
}
