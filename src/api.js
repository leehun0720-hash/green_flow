// Electron 패키징 앱은 preload.js가 window.__API_BASE__ 로 실제 백엔드 origin(예:
// http://localhost:53214)을 주입한다 — 렌더러가 file:// 로 로드되어 상대 경로("/api")로는
// 백엔드에 도달할 수 없기 때문이다. 웹 개발/배포 환경에서는 이 값이 없으므로 기존처럼 동작한다.
const API_ORIGIN = (typeof window !== "undefined" && window.__API_BASE__) || "";
const BASE = `${API_ORIGIN}/api`;

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

// 서버가 돌려주는 /generated-images, /branding 같은 상대 경로를 실제 백엔드 origin과 합쳐준다.
function mediaUrl(p) {
  if (!p) return p;
  return `${API_ORIGIN}${p}`;
}

export const api = {
  mediaUrl,
  health: () => request("/health"),

  getSettings: () => request("/settings"),
  saveSettings: (settings) =>
    request("/settings", { method: "PUT", body: JSON.stringify(settings) }),

  getLogo: () => request("/settings/logo"),
  uploadLogo: (dataUrl) => request("/settings/logo", { method: "POST", body: JSON.stringify({ dataUrl }) }),
  deleteLogo: () => request("/settings/logo", { method: "DELETE" }),

  getSecretsStatus: () => request("/secrets"),
  saveSecrets: (values) => request("/secrets", { method: "PUT", body: JSON.stringify(values) }),
  clearSecret: (key) => request(`/secrets/${key}`, { method: "DELETE" }),

  generate: (payload) =>
    request("/generate", { method: "POST", body: JSON.stringify(payload) }),
  listGenerations: () => request("/generations"),
  deleteGeneration: (id) => request(`/generations/${id}`, { method: "DELETE" }),

  generateBlogImage: (prompt) =>
    request("/images/blog", { method: "POST", body: JSON.stringify({ prompt }) }),
  generateCardnewsImages: (cards, stylePrompt) =>
    request("/images/cardnews", { method: "POST", body: JSON.stringify({ cards, stylePrompt }) }),
  generateShortsImages: (prompts) =>
    request("/images/shorts", { method: "POST", body: JSON.stringify({ prompts }) }),
  generateNarration: (texts) =>
    request("/audio/narration", { method: "POST", body: JSON.stringify({ texts }) }),
  reviewGeneration: (id, review) =>
    request(`/generations/${id}/review`, { method: "PUT", body: JSON.stringify(review) }),

  listCalendar: () => request("/calendar"),
  addCalendarRow: (row) => request("/calendar", { method: "POST", body: JSON.stringify(row) }),
  updateCalendarRow: (id, row) =>
    request(`/calendar/${id}`, { method: "PUT", body: JSON.stringify(row) }),
  deleteCalendarRow: (id) => request(`/calendar/${id}`, { method: "DELETE" }),
  publishCalendarRowNow: (id) => request(`/calendar/${id}/publish-now`, { method: "POST" }),
  runScheduler: () => request("/calendar/run-scheduler", { method: "POST" }),

  runClipping: (keywords) =>
    request("/clipping/run", { method: "POST", body: JSON.stringify({ keywords }) }),
  listClipping: () => request("/clipping"),

  generateReport: (payload) =>
    request("/report/generate", { method: "POST", body: JSON.stringify(payload) }),
  listReports: () => request("/reports"),
  deleteReport: (id) => request(`/reports/${id}`, { method: "DELETE" }),
};
