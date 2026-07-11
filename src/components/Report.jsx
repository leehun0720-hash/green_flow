import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import HelpLink from "./HelpLink.jsx";
import CopyButton from "./CopyButton.jsx";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Report({ onNavigate }) {
  const [month, setMonth] = useState(currentMonth());
  const [channelMetrics, setChannelMetrics] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [reports, setReports] = useState([]);

  const load = async () => setReports(await api.listReports());

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setError("");
    setLoading(true);
    try {
      const record = await api.generateReport({ month, channelMetrics });
      setCurrent(record);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const removeReport = async (r) => {
    if (!confirm(`${r.month} 리포트를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await api.deleteReport(r.id);
    if (current?.id === r.id) setCurrent(null);
    load();
  };

  return (
    <div>
      <div className="page-header-row">
        <h2 className="page-title">월간 리포트 자동화</h2>
        <HelpLink onNavigate={onNavigate} anchor="report" />
      </div>
      <p className="page-desc">
        클리핑 로그 + 콘텐츠 캘린더 발행 내역 + 채널 지표(수동 입력)를 합쳐 월간 리포트를 자동 생성합니다.
        사람은 마지막 '한 줄 총평'만 더하면 됩니다.
      </p>

      <div className="card">
        <div className="row">
          <div className="field">
            <label>대상 월</label>
            <input type="text" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="YYYY-MM" />
          </div>
        </div>
        <div className="field">
          <label>채널 인사이트 요약 (각 플랫폼 인사이트를 월 1회 다운로드해 붙여넣기)</label>
          <textarea
            rows={5}
            value={channelMetrics}
            onChange={(e) => setChannelMetrics(e.target.value)}
            placeholder="예: 블로그 유입 1,200(전월대비 +8%), LinkedIn 도달 3,400 / 팔로워 +45, 쇼츠 조회 9,800 / 완주율 32%"
          />
        </div>
        {error && <div className="error-box">{error}</div>}
        <button className="primary" onClick={generate} disabled={loading}>
          {loading ? "생성 중..." : "월간 리포트 생성"}
        </button>
      </div>

      {current && (
        <div className="card">
          <div className="page-header-row">
            <h3 style={{ margin: 0 }}>{current.month} 리포트</h3>
            <CopyButton getText={() => current.reportText} label="리포트 복사" />
          </div>
          <div className="report-output" style={{ marginTop: 10 }}>{current.reportText}</div>
        </div>
      )}

      {reports.length > 0 && (
        <div className="card">
          <h3>이전 리포트</h3>
          <table>
            <thead><tr><th>월</th><th>생성일</th><th></th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.month}</td>
                  <td>{new Date(r.createdAt).toLocaleString("ko-KR")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="ghost" onClick={() => setCurrent(r)}>보기</button>{" "}
                    <button className="danger" onClick={() => removeReport(r)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
