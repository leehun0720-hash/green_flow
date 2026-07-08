import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import HelpLink from "./HelpLink.jsx";

export default function Clipping({ onNavigate }) {
  const [log, setLog] = useState([]);
  const [keywords, setKeywords] = useState("그린플로, 오후두시랩, 탄소회계 AI");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);

  const load = async () => {
    setLog(await api.listClipping());
  };

  useEffect(() => {
    load();
  }, []);

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
          .env 에 NAVER_ID / NAVER_SECRET 을 설정해야 합니다 (developers.naver.com → 애플리케이션 등록 → 검색 API).
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
