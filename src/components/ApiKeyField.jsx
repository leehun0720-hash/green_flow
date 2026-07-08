import React, { useState } from "react";

export default function ApiKeyField({ label, hint, status, onSave, onClear }) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(value.trim());
      setValue("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (!confirm(`${label} 키를 지울까요? (.env에 값이 있다면 그 값으로 되돌아갑니다)`)) return;
    await onClear();
  };

  return (
    <div className="field" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ marginBottom: 0 }}>{label}</label>
        <div>
          {status?.set ? (
            <span className="badge green">연결됨{status.preview ? ` · ${status.preview}` : ""}</span>
          ) : (
            <span className="badge red">미설정</span>
          )}
        </div>
      </div>
      {hint && <p className="hint" style={{ marginTop: 2 }}>{hint}</p>}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          type={reveal ? "text" : "password"}
          placeholder={status?.set ? "새 값 입력 시에만 변경됩니다" : "키 값을 붙여넣으세요"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="button" className="ghost" onClick={() => setReveal((v) => !v)}>
          {reveal ? "숨기기" : "보기"}
        </button>
        <button type="button" className="primary" onClick={save} disabled={saving || !value.trim()}>
          {saving ? "저장 중..." : "저장"}
        </button>
        {status?.set && (
          <button type="button" className="danger" onClick={clear}>지우기</button>
        )}
      </div>
      {savedFlash && <p className="hint" style={{ color: "var(--accent-ink)" }}>저장했습니다.</p>}
    </div>
  );
}
