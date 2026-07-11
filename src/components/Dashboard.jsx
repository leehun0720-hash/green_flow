import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import HelpLink from "./HelpLink.jsx";

const TIMETABLE = [
  { day: "월", task: "카드뉴스 (인스타 11:00)", work: "주간 배치 검수(50분) → 전 채널 예약 등록" },
  { day: "화", task: "블로그① 07:30 · LinkedIn 회사 08:30", work: "차주 소재 선정 + 마스터 프롬프트 실행(30분)" },
  { day: "수", task: "쇼츠 12:00", work: "클리핑 결과 확인 · 캘린더 상태 정리(15분)" },
  { day: "목", task: "블로그② 17:30 · LinkedIn 대표 08:30", work: "" },
  { day: "금", task: "릴스 19:00", work: "모니터링 정리(15분)" },
];

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

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

  const thisWeek = calendar.filter((r) => {
    if (!r.datetime) return false;
    const d = new Date(r.datetime);
    return d >= weekStart && d < weekEnd;
  });
  const published = thisWeek.filter((r) => r.status === "발행" || r.status === "집계반영").length;
  const pendingReview = generations.filter((g) => !g.review?.grade).length;
  const missingUrl = calendar.filter((r) => r.status === "발행" && !r.url).length;
  const recentErrors = clipping.filter((r) => r.title?.startsWith("ERROR")).length;

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
        <div className="kpi-card">
          <div className="value">{thisWeek.length}</div>
          <div className="label">이번 주 예정 발행</div>
        </div>
        <div className="kpi-card">
          <div className="value">{published}</div>
          <div className="label">이번 주 발행 완료</div>
        </div>
        <div className="kpi-card">
          <div className="value">{pendingReview}</div>
          <div className="label">검수 대기 생성물</div>
        </div>
        <div className="kpi-card">
          <div className="value" style={{ color: recentErrors ? "var(--red)" : undefined }}>{recentErrors}</div>
          <div className="label">클리핑 ERROR 누적</div>
        </div>
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
        <h3>주간 운영 루틴 (사람의 일은 주 2시간)</h3>
        <table>
          <thead><tr><th>요일</th><th>발행</th><th>내부 작업</th></tr></thead>
          <tbody>
            {TIMETABLE.map((r) => (
              <tr key={r.day}>
                <td>{r.day}</td>
                <td>{r.task}</td>
                <td>{r.work}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>
          매일 09:00 발행 누락 경고 확인 · 월 1회 리포트 생성 + 키워드 갱신(40분) — 나머지 전 과정은 자동
        </p>
      </div>
    </div>
  );
}
