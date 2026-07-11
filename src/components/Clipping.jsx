import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import HelpLink from "./HelpLink.jsx";

export default function Clipping({ onNavigate }) {
  const [log, setLog] = useState([]);
  const [keywords, setKeywords] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoTime, setAutoTime] = useState("09:00");
  const [autoSaved, setAutoSaved] = useState(false);

  const load = async () => {
    setLog(await api.listClipping());
  };

  useEffect(() => {
    load();
    // 설정 화면에서 저장한 클리핑 키워드·자동 수집 설정을 불러온다 (하드코딩 금지)
    api
      .getSettings()
      .then((s) => {
        setKeywords((s.clippingKeywords || []).join(", "));
        setAutoEnabled(!!s.clippingAutoEnabled);
        setAutoTime(s.clippingAutoTime || "09:00");
      })
      .catch(() => {});
  }, []);

  const saveAuto = async (enabled, time) => {
    setAutoEnabled(enabled);
    setAutoTime(time);
    await api.saveSettings({ clippingAutoEnabled: enabled, clippingAutoTime: time });
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2000);
  };

  const run = async () => {
    setError("");
    setRunning(true);
    setLastResult(null);
    try {
      const kwList = keywords.split(",").map((k) => k.trim()).filter(Boolean);
      const res = await api.runClipping(kwList);
      setLastResult(res);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const errorRows = log.filter((r) => r.title?.startsWith("ERROR"));

  return (
    <div>
      <div className="page-header-row">
        <h2 className="page-title">클리핑 · 모니터링 자동화</h2>
        <HelpLink onNavigate={onNavigate} anchor="clipping" />
      </div>
      <p className="page-desc">
        네이버 검색 API로 언급 뉴스·블로그를 수집합니다. PC 스케줄러(작업 스케줄러/cron)에 매일 09:00
        1회 실행을 등록하면 자동화가 완성됩니다. 네이버 밖 웹은 Google Alerts로 보완하세요.
      </p>

      {errorRows.length >= 2 && (
        <div className="error-box">
          ERROR 행이 연속 기록되고 있습니다. API 키 만료·한도 초과를 점검하세요 (developers.naver.com).
        </div>
      )}

      <div className="card">
        <h3>수집 실행</h3>
        <div className="field">
          <label>키워드 (쉼표로 구분)</label>
          <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
        {error && <div className="error-box">{error}</div>}
        {lastResult && <div className="info-box">이번 실행에서 {lastResult.collected}건을 새로 수집했습니다.</div>}
        <button className="primary" onClick={run} disabled={running}>
          {running ? "수집 중..." : "지금 수집 실행"}
        </button>
        <p className="hint" style={{ marginTop: 8 }}>
          네이버 Client ID/Secret이 필요합니다 — <strong>설정 → API 키 관리</strong>에서 입력하세요
          (developers.naver.com → 애플리케이션 등록 → 검색 API). 기본 키워드는 설정 화면의
          "클리핑 키워드"에서 바꿀 수 있습니다.
        </p>
      </div>

      <div className="card">
        <h3>매일 자동 수집</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={autoEnabled}
            onChange={(e) => saveAuto(e.target.checked, autoTime)}
          />
          매일 지정 시각에 자동으로 수집 실행
        </label>
        {autoEnabled && (
          <div className="field" style={{ marginTop: 10, maxWidth: 200 }}>
            <label>수집 시각</label>
            <input
              type="time"
              value={autoTime}
              onChange={(e) => saveAuto(autoEnabled, e.target.value)}
            />
          </div>
        )}
        {autoSaved && <p className="hint" style={{ marginTop: 6 }}>✔ 저장됨 — 즉시 적용됩니다.</p>}
        <p className="hint" style={{ marginTop: 8 }}>
          앱(서버)이 켜져 있는 동안 동작합니다 — 트레이에 상주 중이면 창을 닫아도 수집됩니다. 지정
          시각에 앱이 꺼져 있었다면, 그날 중 다시 켜졌을 때 한 번 따라잡아 수집합니다. 외부 작업
          스케줄러(cron 등)는 더 이상 필요 없습니다.
        </p>
      </div>

      <div className="card">
        <h3>클리핑 로그 ({log.length}건)</h3>
        {log.length === 0 ? (
          <p className="hint">아직 수집된 데이터가 없습니다.</p>
        ) : (
          <table>
            <thead>
              <tr><th>날짜</th><th>종류</th><th>키워드</th><th>제목</th><th>링크</th></tr>
            </thead>
            <tbody>
              {log.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.kind}</td>
                  <td>{r.keyword}</td>
                  <td style={{ color: r.title?.startsWith("ERROR") ? "var(--red)" : "inherit" }}>{r.title}</td>
                  <td>
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noreferrer">보기</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
