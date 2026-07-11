// 09 · MONITORING AUTOMATION — 클리핑·모니터링 자동화 (clipping.py 를 Node로 이식)

import { getSecret } from "./secrets.js";
import { readJson } from "./store.js";
import { DEFAULT_SETTINGS } from "./prompts.js";

async function search(kind, query) {
  const url = new URL(`https://openapi.naver.com/v1/search/${kind}.json`);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "50");
  url.searchParams.set("sort", "date");

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": getSecret("NAVER_ID"),
      "X-Naver-Client-Secret": getSecret("NAVER_SECRET"),
    },
  });
  if (!res.ok) {
    throw new Error(`Naver API ${kind} 검색 실패 (${res.status})`);
  }
  const data = await res.json();
  return data.items || [];
}

// 지정 키워드로 뉴스·블로그를 수집한다. 실패한 키워드/종류는 rows에 ERROR로 기록한다(자가 오류 감지).
// 키워드를 넘기지 않으면 설정 화면에서 저장한 클리핑 키워드를 사용한다.
export async function runClipping(keywords) {
  if (!keywords || keywords.length === 0) {
    const settings = { ...DEFAULT_SETTINGS, ...readJson("settings", {}) };
    keywords = settings.clippingKeywords?.length ? settings.clippingKeywords : DEFAULT_SETTINGS.clippingKeywords;
  }
  if (!getSecret("NAVER_ID") || !getSecret("NAVER_SECRET")) {
    throw new Error("NAVER_ID / NAVER_SECRET이 설정되지 않았습니다. 설정 화면 또는 .env 파일을 확인하세요.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  const seen = new Set();

  for (const kw of keywords) {
    for (const kind of ["news", "blog"]) {
      try {
        const items = await search(kind, kw);
        for (const it of items) {
          if (seen.has(it.link)) continue; // 키워드 간 중복 제거
          seen.add(it.link);
          const title = it.title.replace(/<b>/g, "").replace(/<\/b>/g, "");
          rows.push({ date: today, kind, keyword: kw, title, link: it.link });
        }
      } catch (e) {
        rows.push({ date: today, kind, keyword: kw, title: `ERROR: ${e.message}`, link: "" });
      }
    }
  }

  return rows;
}
