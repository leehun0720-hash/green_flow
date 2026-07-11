import React, { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import Dashboard from "./components/Dashboard.jsx";
import Generate from "./components/Generate.jsx";
import Calendar from "./components/Calendar.jsx";
import Clipping from "./components/Clipping.jsx";
import Report from "./components/Report.jsx";
import Settings from "./components/Settings.jsx";
import Manual from "./components/Manual.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const TABS = [
  { id: "dashboard", label: "대시보드", icon: "🏠" },
  { id: "generate", label: "콘텐츠 생성 · 검수", icon: "✍️" },
  { id: "calendar", label: "콘텐츠 캘린더", icon: "🗓️" },
  { id: "clipping", label: "클리핑 모니터링", icon: "📰" },
  { id: "report", label: "월간 리포트", icon: "📊" },
  { id: "settings", label: "설정", icon: "⚙️" },
  { id: "manual", label: "사용자 매뉴얼", icon: "📘" },
];

const DEFAULT_UI = { appName: "greenflow", theme: "green" };

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [manualAnchor, setManualAnchor] = useState(null);
  const [ui, setUi] = useState(DEFAULT_UI);

  const loadUi = () => {
    api
      .getSettings()
      .then((s) => setUi({ appName: s.appName || DEFAULT_UI.appName, theme: s.theme || DEFAULT_UI.theme }))
      .catch(() => {});
  };

  useEffect(() => {
    loadUi();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", ui.theme);
    document.title = `${ui.appName} 콘텐츠 자동화`;
  }, [ui]);

  // 콘텐츠 생성·영상 렌더링이 진행 중일 때 화면을 이동하면 결과를 잃는다 — 이동 전에 확인을 받는다.
  const busyRef = useRef(false);
  const onBusyChange = (b) => {
    busyRef.current = b;
  };

  // 탭 이동 + (매뉴얼 탭이면) 해당 섹션으로 바로 스크롤 이동
  const goTo = (tabId, anchor) => {
    if (busyRef.current && tabId !== tab) {
      const ok = confirm("생성 작업이 진행 중입니다. 지금 이동하면 진행 중인 결과를 잃습니다.\n그래도 이동할까요?");
      if (!ok) return;
      busyRef.current = false;
    }
    setTab(tabId);
    if (tabId === "manual") setManualAnchor(anchor || null);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>{ui.appName}</h1>
        <p className="subtitle">콘텐츠 자동화 · TEN AI</p>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => goTo(t.id)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </aside>
      <main className="main">
        <ErrorBoundary key={tab}>
          {tab === "dashboard" && <Dashboard onNavigate={goTo} />}
          {tab === "generate" && <Generate onNavigate={goTo} onBusyChange={onBusyChange} />}
          {tab === "calendar" && <Calendar onNavigate={goTo} />}
          {tab === "clipping" && <Clipping onNavigate={goTo} />}
          {tab === "report" && <Report onNavigate={goTo} />}
          {tab === "settings" && (
            <Settings onNavigate={goTo} onSettingsSaved={loadUi} persistedTheme={ui.theme} />
          )}
          {tab === "manual" && <Manual anchor={manualAnchor} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
