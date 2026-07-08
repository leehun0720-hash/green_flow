import React, { useState, useEffect } from "react";
import { api } from "../api.js";
import HelpLink from "./HelpLink.jsx";

// 05 · HUMAN REVIEW GATE — 발행 전 전 채널 공통 체크리스트
const CHECKLIST_ITEMS = [
  { key: "factNumbers", group: "팩트", label: "수치(배출량·고객 수·날짜)가 원본과 일치하는가" },
  { key: "factClaims", group: "팩트", label: "원본에 없는 주장·비교·최상급 표현이 추가되지 않았는가" },
  { key: "factCustomer", group: "팩트", label: "고객사 실명·사례가 공개 승인 범위 내인가" },
  { key: "brandTerms", group: "브랜드", label: "고정 수식어가 유지되고 용어 표기가 용어집과 일치하는가" },
  { key: "brandTone", group: "브랜드", label: "톤이 과장·공포 조장 없이 실무자 관점을 유지하는가" },
  { key: "legalCompete", group: "법·윤리", label: "경쟁사 비방·타사 저작물 무단 사용이 없는가" },
  { key: "legalAd", group: "법·윤리", label: "광고성 콘텐츠 표기(협찬·광고 고지 등)가 필요 시 포함됐는가" },
  { key: "techLinks", group: "기술", label: "링크 작동, 이미지 해상도, 예약 시간·채널이 캘린더와 일치하는가" },
];

const GRADES = [
  { id: "GREEN", label: "GREEN · 즉시 통과", hint: "수정 0~1곳. 그대로 예약 발행." },
  { id: "YELLOW", label: "YELLOW · 수정 후 발행", hint: "표현·구조 수정 필요. 반복 패턴이면 상주 지침에 규칙 추가." },
  { id: "RED", label: "RED · 발행 중단", hint: "팩트 오류·법적 리스크. 폐기 후 원본부터 재확인, 발주사에 공유." },
];

export default function ReviewChecklist({ generation, onSaved, onNavigate }) {
  const [checklist, setChecklist] = useState(generation.review?.checklist || {});
  const [grade, setGrade] = useState(generation.review?.grade || null);
  const [note, setNote] = useState(generation.review?.reviewerNote || "");
  const [reviewerInitial, setReviewerInitial] = useState(generation.review?.reviewerInitial || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChecklist(generation.review?.checklist || {});
    setGrade(generation.review?.grade || null);
    setNote(generation.review?.reviewerNote || "");
    setReviewerInitial(generation.review?.reviewerInitial || "");
  }, [generation.id]);

  const toggle = (key) => setChecklist((c) => ({ ...c, [key]: !c[key] }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.reviewGeneration(generation.id, {
        checklist,
        grade,
        reviewerNote: note,
        reviewerInitial,
        reviewedAt: new Date().toISOString(),
      });
      onSaved?.(updated);
    } finally {
      setSaving(false);
    }
  };

  const groups = [...new Set(CHECKLIST_ITEMS.map((i) => i.group))];

  return (
    <div className="card">
      <div className="page-header-row">
        <h3 style={{ margin: 0 }}>사람 검수 게이트 — 10분 체크리스트</h3>
        <HelpLink onNavigate={onNavigate} anchor="review" />
      </div>
      <p className="hint">발행 전 전 채널 공통 확인 항목. 등급별 처리 기준에 따라 판정하세요.</p>

      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-ink)", margin: "10px 0 2px" }}>
            {g}
          </div>
          {CHECKLIST_ITEMS.filter((i) => i.group === g).map((item) => (
            <label key={item.key} className="checklist-item" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!checklist[item.key]}
                onChange={() => toggle(item.key)}
              />
              {item.label}
            </label>
          ))}
        </div>
      ))}

      <div className="field" style={{ marginTop: 14 }}>
        <label>등급 판정</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {GRADES.map((g) => (
            <button
              key={g.id}
              className={grade === g.id ? "primary" : "ghost"}
              type="button"
              onClick={() => setGrade(g.id)}
              title={g.hint}
            >
              {g.label}
            </button>
          ))}
        </div>
        {grade && <p className="hint" style={{ marginTop: 6 }}>{GRADES.find((g) => g.id === grade)?.hint}</p>}
      </div>

      <div className="row">
        <div className="field">
          <label>검수자 이니셜</label>
          <input type="text" value={reviewerInitial} onChange={(e) => setReviewerInitial(e.target.value)} placeholder="예: KH" />
        </div>
      </div>

      <div className="field">
        <label>수정 메모 (반복되면 상주 지침에 규칙 추가)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: '~에요체' 금지 등" />
      </div>

      <button className="primary" onClick={save} disabled={saving || !grade}>
        {saving ? "저장 중..." : "검수 결과 저장"}
      </button>
    </div>
  );
}
