const BASE = "/api";

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

export const api = {
  health: () => request("/health"),

  getSettings: () => request("/settings"),
  saveSettings: (settings) =>
    request("/settings", { method: "PUT", body: JSON.stringify(settings) }),

  getSecretsStatus: () => request("/secrets"),
  saveSecrets: (values) => request("/secrets", { method: "PUT", body: JSON.stringify(values) }),
  clearSecret: (key) => request(`/secrets/${key}`, { method: "DELETE" }),

  generate: (payload) =>
    request("/generate", { method: "POST", body: JSON.stringify(payload) }),
  listGenerations: () => request("/generations"),
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
};
