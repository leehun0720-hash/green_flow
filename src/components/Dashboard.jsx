import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import HelpLink from "./HelpLink.jsx";

const STATUS_BADGE = {
  초안: "gray",
  검수완료: "yellow",
  예약됨: "yellow",
  발행: "green",
  집계반영: "green",
};

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

export default function Dashboard({ onNavigate }) {
  const [calendar, setCalendar] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [clipping, setClipping] = useState([]);
  const [clippingRunning, setClippingRunning] = useState(false);
  const [clippingResult, setClippingResult] = useState("");

  useEffect(() => {
    api.listCalendar().then(setCalendar);
    api.listGenerations().then(setGenerations);
    api.listClipping().then(setClipping);
  }, []);

  // 빠른 실행의 "클리핑 실행"은 이름 그대로 실제 수집을 돌린다(설정의 클리핑 키워드 사용).
  const runClippingNow = async () => {
    setClippingRunning(true);
    setClippingResult("");
    try {
      const res = await api.runClipping([]);
      setClippingResult(`클리핑 수집 완료 — ${res.collected}건을 새로 수집했습니다.`);
      api.listClipping().then(setClipping);
    } catch (e) {
      setClippingResult(`클리핑 실행 실패: ${e.message}`);
    } finally {
      setClippingRunning(false);
    }
  };

  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const thisWeek = calendar
    .filter((r) => {
      if (!r.datetime) return false;
      const d = new Date(r.datetime);
      return d >= weekStart && d < weekEnd;
    })
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
  const published = thisWeek.filter((r) => r.status === "발행" || r.status === "집계반영").length;
  const pendingReview = generations.filter((g) => !g.review?.grade).length;
  const missingUrl = calendar.filter((r) => r.status === "발행" && !r.url).length;
  const recentErrors = clipping.filter((r) => r.title?.startsWith("ERROR")).length;
  const recentGenerations = generations.slice(0, 5);

  const generationTitle = (g) =>
    g.result?.blog?.titles?.[0] || g.purpose || g.sourceExcerpt?.slice(0, 40) || "-";

  return (
    <div>
      <div className="page-header-row">
        <h2 className="page-title">대시보드</h2>
        <HelpLink onNavigate={onNavigate} anchor="overview" />
      </div>
      <p className="page-desc">
        "사람은 판단, AI는 실행" — 자동화 이후 사람에게 남는 업무는 주 2시간이 전부입니다.
      </p>

      <div className="kpi-grid">
        <button className="kpi-card clickable" onClick={() => onNavigate("calendar")}>
          <div className="value">{thisWeek.length}</div>
          <div className="label">이번 주 예정 발행</div>
        </button>
        <button className="kpi-card clickable" onClick={() => onNavigate("calendar")}>
          <div className="value">{published}</div>
          <div className="label">이번 주 발행 완료</div>
        </button>
        <button className="kpi-card clickable" onClick={() => onNavigate("generate")}>
          <div className="value">{pendingReview}</div>
          <div className="label">검수 대기 생성물</div>
        </button>
        <button className="kpi-card clickable" onClick={() => onNavigate("clipping")}>
          <div className="value" style={{ color: recentErrors ? "var(--red)" : undefined }}>{recentErrors}</div>
          <div className="label">클리핑 ERROR 누적</div>
        </button>
      </div>

      {(missingUrl > 0 || recentErrors >= 2) && (
        <div className="error-box">
          {missingUrl > 0 && <div>발행 상태인데 URL이 비어 있는 항목이 {missingUrl}건 있습니다 — 캘린더에서 확인하세요.</div>}
          {recentErrors >= 2 && <div>클리핑 ERROR가 반복되고 있습니다 — 클리핑 페이지에서 API 키를 점검하세요.</div>}
        </div>
      )}

      <div className="card">
        <h3>빠른 실행</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="primary" onClick={() => onNavigate("generate")}>+ 콘텐츠 생성</button>
          <button className="ghost" onClick={() => onNavigate("calendar")}>캘린더 보기</button>
          <button className="ghost" onClick={runClippingNow} disabled={clippingRunning}>
            {clippingRunning ? "수집 중..." : "클리핑 실행"}
          </button>
          <button className="ghost" onClick={() => onNavigate("report")}>월간 리포트</button>
        </div>
        {clippingResult && (
          <p className="hint" style={{ marginTop: 8, color: clippingResult.includes("실패") ? "var(--red)" : undefined }}>
            {clippingResult}
          </p>
        )}
      </div>

      <div className="card">
        <div className="page-header-row">
          <h3 style={{ margin: 0 }}>이번 주 발행 일정</h3>
          <HelpLink onNavigate={onNavigate} anchor="routine" label="권장 주간 루틴 보기" />
        </div>
        {thisWeek.length === 0 ? (
          <p className="hint" style={{ marginTop: 10 }}>
            이번 주에 등록된 발행 일정이 없습니다 — 콘텐츠 생성 후 "캘린더에 추가"로 등록하세요.
          </p>
        ) : (
          <table style={{ marginTop: 6 }}>
            <thead><tr><th>일시</th><th>채널</th><th>유형</th><th>상태</th></tr></thead>
            <tbody>
              {thisWeek.map((r) => {
                const d = new Date(r.datetime);
                return (
                  <tr key={r.id}>
                    <td>
                      {DAY_LABEL[d.getDay()]}{" "}
                      {String(d.getHours()).padStart(2, "0")}:{String(d.getMinutes()).padStart(2, "0")}
                    </td>
                    <td>{r.channel}</td>
                    <td>{r.type}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] || "gray"}`}>{r.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>최근 생성 콘텐츠</h3>
        {recentGenerations.length === 0 ? (
          <p className="hint">아직 생성한 콘텐츠가 없습니다.</p>
        ) : (
          <table>
            <thead><tr><th>생성일</th><th>제목</th><th>검수</th></tr></thead>
            <tbody>
              {recentGenerations.map((g) => (
                <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => onNavigate("generate")}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(g.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td style={{ maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {generationTitle(g)}
                  </td>
                  <td>
                    {g.review?.grade ? (
                      <span className={`badge ${g.review.grade === "GREEN" ? "green" : g.review.grade === "YELLOW" ? "yellow" : "red"}`}>
                        {g.review.grade}
                      </span>
                    ) : (
                      <span className="badge gray">검수전</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="hint" style={{ marginTop: 8 }}>
          행을 누르면 콘텐츠 생성·검수 화면으로 이동합니다 — "최근 생성 기록"에서 불러와 검수하세요.
        </p>
      </div>
    </div>
  );
}
