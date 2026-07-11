import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import ApiKeyField from "./ApiKeyField.jsx";
import HelpLink from "./HelpLink.jsx";

// 서버 lib/prompts.js 의 THEMES 와 동일한 목록(표시용)
const THEMES = [
  { id: "green", label: "그린" },
  { id: "blue", label: "블루" },
  { id: "purple", label: "퍼플" },
  { id: "orange", label: "오렌지" },
  { id: "teal", label: "틸" },
  { id: "rose", label: "로즈" },
  { id: "dark", label: "다크 모드" },
];
const THEME_SWATCH = {
  green: "#21895f",
  blue: "#2170b8",
  purple: "#7440ad",
  orange: "#b8661d",
  teal: "#1d9199",
  rose: "#b81d5e",
  dark: "#101820",
};

// 서버 lib/prompts.js 의 AI_PROVIDERS 와 동일한 목록(표시용)
const AI_PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)", defaultModel: "claude-opus-4-8", healthKey: "hasAnthropicKey" },
  { id: "openai", label: "ChatGPT (OpenAI)", defaultModel: "gpt-5.5", healthKey: "hasOpenAIKey" },
  { id: "gemini", label: "Gemini (Google)", defaultModel: "gemini-3.5-flash", healthKey: "hasGeminiKey" },
];
const MODEL_FIELD = { anthropic: "aiModelAnthropic", openai: "aiModelOpenAI", gemini: "aiModelGemini" };

function toCsv(arr) {
  return (arr || []).join(", ");
}
function fromCsv(str) {
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function Settings({ onNavigate, onSettingsSaved, persistedTheme }) {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState(null);
  const [secrets, setSecrets] = useState(null);
  const [logo, setLogo] = useState(null);
  const [logoError, setLogoError] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");

  const loadHealth = () => api.health().then(setHealth).catch(() => {});
  const loadSecrets = () => api.getSecretsStatus().then(setSecrets).catch(() => {});
  const loadLogo = () =>
    api
      .getLogo()
      .then((res) => setLogo({ ...res, url: api.mediaUrl(res.url) }))
      .catch(() => {});

  // 저장된 테마를 항상 최신값으로 참조하기 위한 ref — 클로저에 갇힌 값이 아니라
  // 언마운트 시점의 실제 최신 persistedTheme를 읽어야 저장 직후 이동에도 정확히 반영된다.
  const persistedThemeRef = useRef(persistedTheme);
  useEffect(() => {
    persistedThemeRef.current = persistedTheme;
  }, [persistedTheme]);

  useEffect(() => {
    api.getSettings().then(setSettings);
    loadHealth();
    loadSecrets();
    loadLogo();
  }, []);

  const onLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError("");
    setLogoUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await api.uploadLogo(dataUrl);
      setLogo({ ...res, url: api.mediaUrl(res.url) });
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const onLogoDelete = async () => {
    await api.deleteLogo();
    setLogo({ exists: false, url: null });
  };

  const downloadBackup = async () => {
    setBackupMsg("");
    try {
      const res = await api.downloadBackup();
      if (!res.ok) throw new Error(`백업 생성 실패 (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `greenflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMsg("백업 파일을 다운로드했습니다. 안전한 곳에 보관하세요 (API 키가 포함되어 있습니다).");
    } catch (e) {
      setBackupMsg(`백업 실패: ${e.message}`);
    }
  };

  const onRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("복원하면 현재 설정·API 키·생성 기록·캘린더가 백업 파일 내용으로 덮어쓰기됩니다.\n계속할까요?")) return;
    setBackupMsg("");
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await api.restoreBackup(backup);
      setBackupMsg("복원이 완료됐습니다. 화면을 새로고침합니다...");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setBackupMsg(`복원 실패: ${err.message}`);
    }
  };

  // 테마 실시간 미리보기 — 저장 전에도 바로 눈으로 확인, 저장 안 하고 화면을 벗어나면 원래 테마로 복귀
  useEffect(() => {
    if (!settings) return;
    document.documentElement.setAttribute("data-theme", settings.theme || "green");
    return () => {
      document.documentElement.setAttribute("data-theme", persistedThemeRef.current || "green");
    };
  }, [settings?.theme]);

  if (!settings) return <p className="hint">불러오는 중...</p>;

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    await api.saveSettings(settings);
    setSaved(true);
    onSettingsSaved?.();
    setTimeout(() => setSaved(false), 2500);
  };

  const saveSecret = async (key, value) => {
    await api.saveSecrets({ [key]: value });
    await loadSecrets();
    await loadHealth();
  };

  const clearSecret = async (key) => {
    await api.clearSecret(key);
    await loadSecrets();
    await loadHealth();
  };

  return (
    <div>
      <div className="page-header-row">
        <h2 className="page-title">설정 — 상주 지침</h2>
        <HelpLink onNavigate={onNavigate} anchor="settings" />
      </div>
      <p className="page-desc">
        여기서 설정한 브랜드 정의·용어집·톤 가이드·키워드 풀이 매 생성 요청에 시스템 프롬프트로
        자동 적용됩니다(Claude 프로젝트 지침과 동일한 역할). 실행 시에는 원본만 넣어도 규칙이 그대로 반영됩니다.
      </p>

      <div className="card">
        <h3>일반 설정</h3>
        <div className="field">
          <label>앱 이름 (사이드바·브라우저 탭 제목에 표시)</label>
          <input type="text" value={settings.appName} onChange={(e) => set("appName", e.target.value)} placeholder="greenflow" />
        </div>
        <div className="field">
          <label>테마</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => set("theme", t.id)}
                title={t.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: settings.theme === t.id ? "2px solid var(--accent-600)" : "1px solid var(--border)",
                  background: settings.theme === t.id ? "var(--accent-100)" : "var(--card)",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: THEME_SWATCH[t.id],
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.label}</span>
              </button>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            클릭하면 바로 미리보기가 적용됩니다. 화면 아래 "설정 저장"을 눌러야 계속 유지됩니다.
          </p>
        </div>

        <div className="field">
          <label>브랜드 로고</label>
          <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
            업로드하면 이후 생성되는 <strong>카드뉴스 7장</strong>과 <strong>블로그 대표 이미지</strong>
            우측/우하단에 이 로고가 자동으로 합성됩니다(투명 배경 PNG 권장). 즉시 저장되며 별도로
            "설정 저장"을 누를 필요는 없습니다.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {logo?.exists && (
              <img
                src={logo.url}
                alt="브랜드 로고"
                style={{ width: 64, height: 64, objectFit: "contain", background: "#20242a", borderRadius: 8, padding: 6 }}
              />
            )}
            <input type="file" accept="image/*" onChange={onLogoFileChange} disabled={logoUploading} />
            {logo?.exists && (
              <button type="button" className="ghost" onClick={onLogoDelete}>
                로고 삭제
              </button>
            )}
          </div>
          {logoUploading && <p className="hint" style={{ marginTop: 6 }}>업로드 중...</p>}
          {logoError && <div className="error-box" style={{ marginTop: 8 }}>{logoError}</div>}
        </div>
      </div>

      <div className="card">
        <h3>AI 공급자</h3>
        <p className="hint">
          콘텐츠 생성(4채널 동시 생성)과 월간 리포트에 사용할 AI를 고릅니다. 고른 공급자의 API 키가 아래
          "API 키 관리"에 설정되어 있어야 실제로 동작합니다.
        </p>
        <div className="field">
          <label>공급자</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={settings.aiProvider === p.id ? "primary" : "ghost"}
                onClick={() => set("aiProvider", p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>모델명 (비워두면 기본값 사용)</label>
          <input
            type="text"
            value={settings[MODEL_FIELD[settings.aiProvider]] || ""}
            onChange={(e) => set(MODEL_FIELD[settings.aiProvider], e.target.value)}
            placeholder={AI_PROVIDERS.find((p) => p.id === settings.aiProvider)?.defaultModel}
          />
        </div>
        <p className="hint">
          현재 선택:{" "}
          <span className="badge green">{AI_PROVIDERS.find((p) => p.id === settings.aiProvider)?.label}</span>{" "}
          연결 상태:{" "}
          {health?.[AI_PROVIDERS.find((p) => p.id === settings.aiProvider)?.healthKey] ? (
            <span className="badge green">연결됨</span>
          ) : (
            <span className="badge red">API 키 미설정 — 아래에서 입력하세요</span>
          )}
        </p>
      </div>

      <div className="card">
        <div className="page-header-row">
          <h3 style={{ margin: 0 }}>API 키 관리</h3>
          <HelpLink onNavigate={onNavigate} anchor="setup" label="키 발급 방법 보기" />
        </div>
        <p className="hint">
          여기서 입력한 키는 즉시 적용되며(서버 재시작 불필요), 서버에만 저장되고 화면에는 마스킹되어 표시됩니다.
          자세한 발급 방법은 <strong>사용자 매뉴얼 → 최초 설정</strong>을 참고하세요.
        </p>

        <ApiKeyField
          label="Claude API 키 (Anthropic)"
          hint="console.anthropic.com → API Keys 에서 발급"
          status={secrets?.ANTHROPIC_API_KEY}
          onSave={(v) => saveSecret("ANTHROPIC_API_KEY", v)}
          onClear={() => clearSecret("ANTHROPIC_API_KEY")}
        />
        <ApiKeyField
          label="ChatGPT API 키 (OpenAI)"
          hint="platform.openai.com → API keys 에서 발급"
          status={secrets?.OPENAI_API_KEY}
          onSave={(v) => saveSecret("OPENAI_API_KEY", v)}
          onClear={() => clearSecret("OPENAI_API_KEY")}
        />
        <ApiKeyField
          label="Gemini API 키 (Google)"
          hint="aistudio.google.com/apikey 에서 발급"
          status={secrets?.GEMINI_API_KEY}
          onSave={(v) => saveSecret("GEMINI_API_KEY", v)}
          onClear={() => clearSecret("GEMINI_API_KEY")}
        />
        <ApiKeyField
          label="네이버 Client ID (클리핑 모니터링)"
          hint="developers.naver.com → Application 등록 → 검색 API 사용"
          status={secrets?.NAVER_ID}
          onSave={(v) => saveSecret("NAVER_ID", v)}
          onClear={() => clearSecret("NAVER_ID")}
        />
        <ApiKeyField
          label="네이버 Client Secret"
          status={secrets?.NAVER_SECRET}
          onSave={(v) => saveSecret("NAVER_SECRET", v)}
          onClear={() => clearSecret("NAVER_SECRET")}
        />
        <ApiKeyField
          label="Meta 페이지 ID (페이스북 자동 발행)"
          hint="발행할 페이스북 페이지의 ID"
          status={secrets?.META_PAGE_ID}
          onSave={(v) => saveSecret("META_PAGE_ID", v)}
          onClear={() => clearSecret("META_PAGE_ID")}
        />
        <ApiKeyField
          label="Meta 인스타그램 비즈니스 계정 ID (인스타 자동 발행)"
          hint="페이스북 페이지에 연결된 인스타그램 비즈니스/크리에이터 계정 ID"
          status={secrets?.META_IG_USER_ID}
          onSave={(v) => saveSecret("META_IG_USER_ID", v)}
          onClear={() => clearSecret("META_IG_USER_ID")}
        />
        <ApiKeyField
          label="Meta 페이지 액세스 토큰"
          hint="developers.facebook.com 앱 → 장기(long-lived) 페이지 액세스 토큰"
          status={secrets?.META_PAGE_ACCESS_TOKEN}
          onSave={(v) => saveSecret("META_PAGE_ACCESS_TOKEN", v)}
          onClear={() => clearSecret("META_PAGE_ACCESS_TOKEN")}
        />

        <div style={{ marginTop: 8 }}>
          <span className="hint">연결 요약 — </span>
          Claude: {health?.hasAnthropicKey ? <span className="badge green">연결됨</span> : <span className="badge red">미설정</span>}{" "}
          ChatGPT: {health?.hasOpenAIKey ? <span className="badge green">연결됨</span> : <span className="badge red">미설정</span>}{" "}
          Gemini: {health?.hasGeminiKey ? <span className="badge green">연결됨</span> : <span className="badge red">미설정</span>}{" "}
          네이버: {health?.hasNaverKeys ? <span className="badge green">연결됨</span> : <span className="badge red">미설정</span>}{" "}
          페이스북: {health?.hasFacebook ? <span className="badge green">연결됨</span> : <span className="badge red">미설정</span>}{" "}
          인스타그램: {health?.hasInstagram ? <span className="badge green">연결됨</span> : <span className="badge red">미설정</span>}
        </div>
      </div>

      <div className="card">
        <h3>브랜드 정의</h3>
        <div className="row">
          <div className="field">
            <label>브랜드명</label>
            <input type="text" value={settings.brandName} onChange={(e) => set("brandName", e.target.value)} />
          </div>
          <div className="field">
            <label>브랜드 정의</label>
            <input type="text" value={settings.brandDef} onChange={(e) => set("brandDef", e.target.value)} />
          </div>
          <div className="field">
            <label>고정 수식어</label>
            <input type="text" value={settings.brandModifier} onChange={(e) => set("brandModifier", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3>용어집 · 톤 가이드</h3>
        <div className="field">
          <label>용어집 (표기 통일 규칙)</label>
          <textarea rows={2} value={settings.glossary} onChange={(e) => set("glossary", e.target.value)} />
        </div>
        <div className="field">
          <label>톤 가이드</label>
          <textarea rows={2} value={settings.toneGuide} onChange={(e) => set("toneGuide", e.target.value)} />
        </div>
        <div className="field">
          <label>금칙 표현 (쉼표 구분)</label>
          <input type="text" value={toCsv(settings.forbiddenPhrases)} onChange={(e) => set("forbiddenPhrases", fromCsv(e.target.value))} />
        </div>
      </div>

      <div className="card">
        <h3>키워드 · 해시태그 풀</h3>
        <div className="field">
          <label>블로그 타깃 키워드 풀 (쉼표 구분 — 월 2회 네이버 검색광고 키워드도구로 갱신 권장)</label>
          <textarea rows={2} value={toCsv(settings.blogKeywordPool)} onChange={(e) => set("blogKeywordPool", fromCsv(e.target.value))} />
        </div>
        <div className="row">
          <div className="field">
            <label>SNS 해시태그 — 고정 (쉼표 구분)</label>
            <input type="text" value={toCsv(settings.hashtagFixed)} onChange={(e) => set("hashtagFixed", fromCsv(e.target.value))} />
          </div>
          <div className="field">
            <label>SNS 해시태그 — 가변 (쉼표 구분)</label>
            <input type="text" value={toCsv(settings.hashtagVariable)} onChange={(e) => set("hashtagVariable", fromCsv(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>클리핑 키워드 (쉼표 구분 — 클리핑 모니터링·자동 수집이 이 키워드로 언급을 검색)</label>
          <input
            type="text"
            value={toCsv(settings.clippingKeywords)}
            onChange={(e) => set("clippingKeywords", fromCsv(e.target.value))}
          />
        </div>
      </div>

      <div className="card">
        <h3>백업 · 복원</h3>
        <p className="hint">
          설정·API 키·생성 기록·캘린더·클리핑 로그·리포트·로고를 JSON 파일 하나로 내보내고, PC 교체나
          재설치 후 그대로 되돌릴 수 있습니다. <strong>백업 파일에는 API 키가 포함되니</strong> 안전한 곳에
          보관하세요.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <button className="ghost" onClick={downloadBackup}>⬇ 백업 파일 다운로드</button>
          <label className="ghost" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: 12.5 }}>
            ⬆ 백업에서 복원
            <input type="file" accept="application/json,.json" onChange={onRestoreFile} style={{ display: "none" }} />
          </label>
        </div>
        {backupMsg && (
          <p className="hint" style={{ marginTop: 8, color: backupMsg.includes("실패") ? "var(--red)" : undefined }}>
            {backupMsg}
          </p>
        )}
      </div>

      <div className="save-bar">
        {saved && <span className="badge green">설정을 저장했습니다</span>}
        <button className="primary" onClick={save}>설정 저장</button>
      </div>
    </div>
  );
}
