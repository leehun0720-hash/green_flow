import React, { useState } from "react";

// 순수 텍스트(text/plain)만 클립보드에 씁니다 — 브라우저 기본 복사(Ctrl+C)는 이 페이지의
// HTML/CSS(폰트·자간·장평 등)까지 함께 복사되어, 네이버 블로그 스마트에디터 등에 붙여넣을 때
// 서식이 충돌해 깨지는 원인이 됩니다. writeText()는 그 문제를 원천적으로 피합니다.
export default function CopyButton({ getText, label = "복사" }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 클립보드 API를 쓸 수 없는 환경(구형 브라우저 등) — 대체 방식
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" className="ghost" onClick={copy}>
      {copied ? "✔ 복사됨" : `📋 ${label}`}
    </button>
  );
}
