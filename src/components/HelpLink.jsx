import React from "react";

// 각 화면에서 사용자 매뉴얼의 해당 섹션으로 바로 이동하는 버튼
export default function HelpLink({ onNavigate, anchor, label = "도움말 보기" }) {
  if (!onNavigate) return null;
  return (
    <button
      type="button"
      className="ghost"
      onClick={() => onNavigate("manual", anchor)}
      style={{ whiteSpace: "nowrap" }}
    >
      ❓ {label}
    </button>
  );
}
