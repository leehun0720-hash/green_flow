import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import ReviewChecklist from "./ReviewChecklist.jsx";
import HelpLink from "./HelpLink.jsx";
import CopyButton from "./CopyButton.jsx";

const CHANNEL_MAP = {
  blog: "블로그",
  linkedin: "LinkedIn-대표",
  shorts: "쇼츠",
  cardnews: "카드뉴스",
  facebook: "페이스북",
};

// sections 스키마 도입 전(구버전)에 생성된 기록은 subheadings + 마크다운 문자열 body를 갖고 있다.
// 신버전 sections 배열이 없으면 body를 문단 단위로 쪼개 같은 모양으로 변환해 화면이 깨지지 않게 한다.
function getBlogSections(blog) {
  if (Array.isArray(blog.sections)) return blog.sections;
  if (typeof blog.body === "string") {
    return blog.body
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const heading = block.match(/^#{1,6}\s*(.+)$/) || block.match(/^\*\*(.+)\*\*$/);
        return heading ? { type: "heading", text: heading[1].trim() } : { type: "paragraph", text: block };
      });
  }
  return [];
}

// 네이버 블로그 등 외부 에디터에 붙여넣을 본문을 문단 배열로 재구성한다.
function buildBlogPlainText(blog) {
  return getBlogSections(blog).map((s) => s.text).join("\n\n");
}

function buildLinkedinPlainText(linkedin) {
  return `${linkedin.post}\n\n${linkedin.hashtags.map((h) => `#${h}`).join(" ")}`;
}

function buildShortsPlainText(shorts) {
  const scenes = shorts.scenes.map((s, i) => `${i + 1}. [자막] ${s.caption}\n   [화면 지시] ${s.direction}`).join("\n\n");
  return `훅: ${shorts.hook}\n\n${scenes}\n\nCTA: ${shorts.cta}`;
}

function buildCardnewsPlainText(cardnews) {
  return cardnews.cards.map((c, i) => `${i + 1}장 — ${c.headline}\n${c.subcopy}`).join("\n\n");
}

export default function Generate({ onNavigate }) {
  const [source, setSource] = useState("");
  const [purpose, setPurpose] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [addedNote, setAddedNote] = useState("");

  const [blogImagePrompt, setBlogImagePrompt] = useState("");
  const [blogImage, setBlogImage] = useState({ url: "", loading: false, error: "" });
  const [cardImages, setCardImages] = useState({ urls: [], loading: false, error: "" });

  // 새 생성물을 불러오면 이전 생성물의 이미지 상태는 초기화한다.
  useEffect(() => {
    setBlogImagePrompt("");
    setBlogImage({ url: "", loading: false, error: "" });
    setCardImages({ urls: [], loading: false, error: "" });
  }, [current?.id]);

  const generateBlogImage = async () => {
    setBlogImage({ url: "", loading: true, error: "" });
    try {
      const prompt = blogImagePrompt.trim() || current.result.blog.titles[0];
      const res = await api.generateBlogImage(prompt);
      setBlogImage({ url: res.url, loading: false, error: "" });
    } catch (e) {
      setBlogImage({ url: "", loading: false, error: e.message });
    }
  };

  const generateCardImages = async () => {
    setCardImages({ urls: [], loading: true, error: "" });
    try {
      const res = await api.generateCardnewsImages(current.result.cardnews.cards);
      setCardImages({ urls: res.urls, loading: false, error: "" });
    } catch (e) {
      setCardImages({ urls: [], loading: false, error: e.message });
    }
  };

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
                {getBlogSections(current.result.blog).map((s, i) =>
                  s.type === "heading" ? (
                    <p key={i} className="body-text" style={{ fontWeight: 700, marginTop: i ? 12 : 0 }}>{s.text}</p>
                  ) : (
                    <p key={i} className="body-text" style={{ marginTop: 8 }}>{s.text}</p>
                  ),
                )}
                <p className="hint" style={{ marginTop: 8 }}>
                  "복사"는 서식 없는 텍스트만 복사합니다 — 스마트에디터에 붙여넣은 뒤 소제목 줄만 선택해
                  "소제목" 서식으로 지정하세요.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <CopyButton getText={() => buildBlogPlainText(current.result.blog)} label="본문 복사" />
                  <button className="ghost" onClick={() => addToCalendar("blog")}>
                    캘린더에 추가
                  </button>
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                  <label>대표 이미지 설명 (비워두면 제목 기반 자동 생성)</label>
                  <input
                    type="text"
                    value={blogImagePrompt}
                    onChange={(e) => setBlogImagePrompt(e.target.value)}
                    placeholder={current.result.blog.titles[0]}
                  />
                  <button
                    className="ghost"
                    style={{ marginTop: 8 }}
                    onClick={generateBlogImage}
                    disabled={blogImage.loading}
                  >
                    {blogImage.loading ? "이미지 생성 중..." : "🖼️ 대표 이미지 생성 (OpenAI 또는 Gemini 키 필요)"}
                  </button>
                  {blogImage.error && <div className="error-box" style={{ marginTop: 8 }}>{blogImage.error}</div>}
                  {blogImage.url && (
                    <div style={{ marginTop: 10 }}>
                      <img src={blogImage.url} alt="블로그 대표 이미지" style={{ width: "100%", borderRadius: 8, display: "block" }} />
                      <a
                        href={blogImage.url}
                        download
                        className="ghost"
                        style={{ display: "inline-block", marginTop: 6, textDecoration: "none", textAlign: "center" }}
                      >
                        ⬇ 다운로드
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="card channel-card">
                <h4>LinkedIn</h4>
                <p className="body-text">{current.result.linkedin.post}</p>
                <p className="hint" style={{ marginTop: 8 }}>
                  {current.result.linkedin.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <CopyButton getText={() => buildLinkedinPlainText(current.result.linkedin)} />
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
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <CopyButton getText={() => buildShortsPlainText(current.result.shorts)} />
                  <button className="ghost" onClick={() => addToCalendar("shorts")}>
                    캘린더에 추가
                  </button>
                </div>
              </div>

              <div className="card channel-card">
                <h4>카드뉴스 (7장)</h4>
                {current.result.cardnews.cards.map((c, i) => (
                  <div key={i} style={{ marginBottom: 6, fontSize: 12.5 }}>
                    <strong>{i + 1}. {c.headline}</strong>
                    <div className="hint">{c.subcopy}</div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <CopyButton getText={() => buildCardnewsPlainText(current.result.cardnews)} />
                  <button className="ghost" onClick={() => addToCalendar("cardnews")}>
                    캘린더에 추가 (인스타 자동발행)
                  </button>
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                  <button className="ghost" onClick={generateCardImages} disabled={cardImages.loading}>
                    {cardImages.loading ? "이미지 생성 중... (최대 1분)" : "🖼️ 카드뉴스 이미지 생성 (OpenAI 또는 Gemini 키 필요)"}
                  </button>
                  <p className="hint" style={{ marginTop: 6 }}>
                    배경 1장을 AI로 생성해 7장에 재사용하고, 헤드카피·서브카피는 정확한 한글로 자동 합성합니다.
                  </p>
                  {cardImages.error && <div className="error-box" style={{ marginTop: 8 }}>{cardImages.error}</div>}
                  {cardImages.urls.length > 0 && (
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10, paddingBottom: 6 }}>
                      {cardImages.urls.map((url, i) => (
                        <div key={i} style={{ flexShrink: 0, width: 120 }}>
                          <img
                            src={url}
                            alt={`카드뉴스 ${i + 1}장`}
                            style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 6, display: "block" }}
                          />
                          <a href={url} download style={{ display: "block", textAlign: "center", fontSize: 11, marginTop: 4 }}>
                            ⬇ {i + 1}장
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
