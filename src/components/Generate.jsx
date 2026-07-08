import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import ReviewChecklist from "./ReviewChecklist.jsx";
import HelpLink from "./HelpLink.jsx";

const CHANNEL_MAP = {
  blog: "블로그",
  linkedin: "LinkedIn-대표",
  shorts: "쇼츠",
  cardnews: "카드뉴스",
  facebook: "페이스북",
};

export default function Generate({ onNavigate }) {
  const [source, setSource] = useState("");
  const [purpose, setPurpose] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [addedNote, setAddedNote] = useState("");

  const loadHistory = async () => {
    try {
      const list = await api.listGenerations();
      setHistory(list);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onGenerate = async () => {
    setError("");
    setLoading(true);
    try {
      const record = await api.generate({ source, purpose, keywords });
      setCurrent(record);
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const buildCaption = (channelKey) => {
    if (channelKey === "cardnews") {
      return current.result.cardnews.cards.map((c) => c.headline).join(" · ");
    }
    if (channelKey === "linkedin") {
      return `${current.result.linkedin.post}\n\n${current.result.linkedin.hashtags.map((h) => `#${h}`).join(" ")}`;
    }
    if (channelKey === "facebook") {
      // 페이스북 회사 페이지 공유용 — LinkedIn 인사이트 초안을 그대로 재사용(필요 시 수정)
      return current.result.linkedin.post;
    }
    return "";
  };

  const addToCalendar = async (channelKey) => {
    if (!current) return;
    const isSns = ["cardnews", "facebook", "릴스"].includes(channelKey);
    await api.addCalendarRow({
      channel: CHANNEL_MAP[channelKey],
      type: "규제해설",
      source: current.sourceExcerpt,
      status: current.review?.grade === "GREEN" ? "검수완료" : "초안",
      note: `생성ID ${current.id.slice(0, 8)} · 목적: ${current.purpose || "-"}`,
      ...(isSns ? { caption: buildCaption(channelKey) } : {}),
    });
    setAddedNote(
      `${CHANNEL_MAP[channelKey]} 항목을 캘린더에 추가했습니다.` +
        (isSns ? " 캘린더에서 이미지/영상 URL을 넣고 상태를 '예약됨'으로 바꾸면 자동 발행됩니다." : ""),
    );
    setTimeout(() => setAddedNote(""), 5000);
  };

  return (
    <div>
      <div className="page-header-row">
        <h2 className="page-title">콘텐츠 생성 · 검수</h2>
        <HelpLink onNavigate={onNavigate} anchor="generate" />
      </div>
      <p className="page-desc">
        1소스 멀티유즈 — 원본 기사·보도자료 1건을 넣으면 마스터 프롬프트가 네이버 블로그 · LinkedIn ·
        쇼츠 스크립트 · 카드뉴스 4종을 동시에 만듭니다. 생성 후 아래 검수 게이트를 반드시 통과시키세요.
      </p>

      <div className="card">
        <h3>실행 입력 (매회 3가지)</h3>
        <div className="field">
          <label>원본 (기사 전문 또는 보도자료 — 링크 아닌 본문 붙여넣기)</label>
          <textarea rows={8} value={source} onChange={(e) => setSource(e.target.value)} placeholder="원본 기사·보도자료·인터뷰 전문을 붙여넣으세요." />
        </div>
        <div className="row">
          <div className="field">
            <label>발행 목적</label>
            <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="예: 10월 업데이트 인지 확산" />
          </div>
          <div className="field">
            <label>타깃 키워드 (블로그 SEO용 1~2개)</label>
            <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="예: Scope 3 계산" />
          </div>
        </div>
        {error && <div className="error-box">{error}</div>}
        <button className="primary" onClick={onGenerate} disabled={loading || !source.trim()}>
          {loading ? "생성 중... (최대 1분 정도 걸릴 수 있습니다)" : "마스터 프롬프트 실행 — 4종 콘텐츠 생성"}
        </button>
      </div>

      {current && (
        <>
          {addedNote && <div className="info-box">{addedNote}</div>}
          <div className="card">
            <h3>생성 결과</h3>
            <div className="channel-grid">
              <div className="card channel-card">
                <h4>네이버 블로그</h4>
                <p className="hint">제목 3안</p>
                <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
                  {current.result.blog.titles.map((t, i) => (
                    <li key={i} style={{ fontSize: 12.5 }}>{t}</li>
                  ))}
                </ul>
                <p className="body-text">{current.result.blog.body}</p>
                <button className="ghost" style={{ marginTop: 10 }} onClick={() => addToCalendar("blog")}>
                  캘린더에 추가
                </button>
              </div>

              <div className="card channel-card">
                <h4>LinkedIn</h4>
                <p className="body-text">{current.result.linkedin.post}</p>
                <p className="hint" style={{ marginTop: 8 }}>
                  {current.result.linkedin.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="ghost" onClick={() => addToCalendar("linkedin")}>
                    캘린더에 추가
                  </button>
                  <button className="ghost" onClick={() => addToCalendar("facebook")}>
                    페이스북에 추가 (자동발행)
                  </button>
                </div>
              </div>

              <div className="card channel-card">
                <h4>쇼츠 스크립트</h4>
                <p className="hint">훅: {current.result.shorts.hook}</p>
                <table>
                  <thead>
                    <tr><th>자막</th><th>화면 지시</th></tr>
                  </thead>
                  <tbody>
                    {current.result.shorts.scenes.map((s, i) => (
                      <tr key={i}>
                        <td>{s.caption}</td>
                        <td>{s.direction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint" style={{ marginTop: 6 }}>CTA: {current.result.shorts.cta}</p>
                <button className="ghost" style={{ marginTop: 10 }} onClick={() => addToCalendar("shorts")}>
                  캘린더에 추가
                </button>
              </div>

              <div className="card channel-card">
                <h4>카드뉴스 (7장)</h4>
                {current.result.cardnews.cards.map((c, i) => (
                  <div key={i} style={{ marginBottom: 6, fontSize: 12.5 }}>
                    <strong>{i + 1}. {c.headline}</strong>
                    <div className="hint">{c.subcopy}</div>
                  </div>
                ))}
                <button className="ghost" style={{ marginTop: 10 }} onClick={() => addToCalendar("cardnews")}>
                  캘린더에 추가 (인스타 자동발행)
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ color: "var(--accent-ink)" }}>[검수 포인트] — AI 자기 보고</h4>
              <p style={{ fontSize: 12.5 }}><strong>① 원본과 다르게 표현된 부분:</strong> {current.result.reviewPoints.differencesFromSource}</p>
              <p style={{ fontSize: 12.5 }}><strong>② 수치 인용 위치:</strong> {current.result.reviewPoints.numberCitations}</p>
              <p style={{ fontSize: 12.5 }}><strong>③ 단정적 표현:</strong> {current.result.reviewPoints.assertiveExpressions}</p>
            </div>
          </div>

          <ReviewChecklist
            generation={current}
            onNavigate={onNavigate}
            onSaved={(updated) => {
              setCurrent(updated);
              loadHistory();
            }}
          />
        </>
      )}

      {history.length > 0 && (
        <div className="card">
          <h3>최근 생성 기록</h3>
          <table>
            <thead>
              <tr><th>생성일시</th><th>목적</th><th>등급</th><th></th></tr>
            </thead>
            <tbody>
              {history.slice(0, 15).map((g) => (
                <tr key={g.id}>
                  <td>{new Date(g.createdAt).toLocaleString("ko-KR")}</td>
                  <td>{g.purpose || "-"}</td>
                  <td>
                    {g.review?.grade ? (
                      <span className={`badge ${g.review.grade.toLowerCase()}`}>{g.review.grade}</span>
                    ) : (
                      <span className="badge gray">검수전</span>
                    )}
                  </td>
                  <td>
                    <button className="ghost" onClick={() => setCurrent(g)}>불러오기</button>
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
