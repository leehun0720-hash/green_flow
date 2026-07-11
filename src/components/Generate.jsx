import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { api } from "../api.js";
import { generateShortsVideo } from "../shortsVideo.js";
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

// 생성 결과를 채널 탭으로 전환해 보여준다 — 4채널을 세로로 전부 나열하면 화면이 수천 px로 길어져
// 검수 게이트·최근 기록까지 도달하기 어렵기 때문.
const CHANNEL_TABS = [
  { id: "blog", label: "네이버 블로그" },
  { id: "linkedin", label: "LinkedIn · 페이스북" },
  { id: "shorts", label: "쇼츠" },
  { id: "cardnews", label: "카드뉴스" },
];

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
  const scenes = shorts.scenes.map((s, i) => `${i + 1}. [자막] ${s.caption}\n   [이미지 프롬프트] ${s.imagePrompt}`).join("\n\n");
  return `훅: ${shorts.hook}\n\n${scenes}\n\nCTA: ${shorts.cta}`;
}

function buildCardnewsPlainText(cardnews) {
  return cardnews.cards.map((c, i) => `${i + 1}장 — ${c.headline}\n${c.subcopy}`).join("\n\n");
}

export default function Generate({ onNavigate, onBusyChange }) {
  const [source, setSource] = useState("");
  const [purpose, setPurpose] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [addedNote, setAddedNote] = useState("");
  const [activeChannel, setActiveChannel] = useState("blog");

  const [blogImagePrompt, setBlogImagePrompt] = useState("");
  const [blogImage, setBlogImage] = useState({ url: "", loading: false, error: "" });
  const [cardImages, setCardImages] = useState({ urls: [], loading: false, error: "" });
  const [zipDownloading, setZipDownloading] = useState(false);
  const [shortsVideo, setShortsVideo] = useState({ url: "", loading: false, error: "", progress: "" });
  const [bgmFile, setBgmFile] = useState(null);
  const [bgmVolume, setBgmVolume] = useState(60);
  const [narrationEnabled, setNarrationEnabled] = useState(false);

  // 새 생성물을 불러오면 이전 생성물의 이미지 상태는 초기화한다.
  useEffect(() => {
    setActiveChannel("blog");
    setBlogImagePrompt("");
    setBlogImage({ url: "", loading: false, error: "" });
    setCardImages({ urls: [], loading: false, error: "" });
    setShortsVideo({ url: "", loading: false, error: "", progress: "" });
    setBgmFile(null);
    setNarrationEnabled(false);
  }, [current?.id]);

  // 생성·렌더링이 진행 중일 때 다른 화면으로 이동하면 결과를 잃는다 —
  // App 셸에 busy 상태를 알려 이동 전 확인을 받게 하고, 창 닫기에도 경고를 띄운다.
  const busy = loading || blogImage.loading || cardImages.loading || shortsVideo.loading || zipDownloading;
  useEffect(() => {
    onBusyChange?.(busy);
    const beforeUnload = (e) => {
      if (busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      onBusyChange?.(false);
    };
  }, [busy, onBusyChange]);

  const generateBlogImage = async () => {
    setBlogImage({ url: "", loading: true, error: "" });
    try {
      const prompt = blogImagePrompt.trim() || current.result.blog.titles[0];
      const res = await api.generateBlogImage(prompt);
      setBlogImage({ url: api.mediaUrl(res.url), loading: false, error: "" });
    } catch (e) {
      setBlogImage({ url: "", loading: false, error: e.message });
    }
  };

  const generateCardImages = async () => {
    setCardImages({ urls: [], loading: true, error: "" });
    try {
      const res = await api.generateCardnewsImages(current.result.cardnews.cards);
      setCardImages({ urls: res.urls.map(api.mediaUrl), loading: false, error: "" });
    } catch (e) {
      setCardImages({ urls: [], loading: false, error: e.message });
    }
  };

  // 쇼츠 대본(훅·장면·CTA)을 장면별 배경 이미지 + 자막을 합성한 세로형(9:16) 영상으로 만든다.
  const generateShortsVideoHandler = async () => {
    setShortsVideo({ url: "", loading: true, error: "", progress: "장면별 배경 이미지를 생성하는 중... (최대 1~2분)" });
    try {
      const shorts = current.result.shorts;
      const beatsInput = [
        { text: shorts.hook, prompt: shorts.scenes[0]?.imagePrompt || "Opening shot introducing the core message, cinematic still" },
        ...shorts.scenes.map((s) => ({ text: s.caption, prompt: s.imagePrompt })),
        { text: shorts.cta, prompt: "Bright, trustworthy closing shot, cinematic still" },
      ];
      // 전체 영상은 15초를 넘지 않아야 하므로, 내레이션이 없을 때는 장면 수에 맞춰 컷당 길이를 동적으로 줄인다.
      const maxTotalSeconds = 15;
      const secondsPerBeat = Math.min(4, maxTotalSeconds / beatsInput.length);

      const res = await api.generateShortsImages(beatsInput.map((b) => b.prompt));
      const imageUrls = res.urls.map(api.mediaUrl);
      const beats = beatsInput.map((b, i) => ({ text: b.text, imageUrl: imageUrls[i] }));

      let narrationClipUrls;
      if (narrationEnabled) {
        setShortsVideo((prev) => ({ ...prev, progress: "AI 음성 내레이션을 생성하는 중..." }));
        const narrationRes = await api.generateNarration(beats.map((b) => b.text));
        narrationClipUrls = narrationRes.clips.map((c) => api.mediaUrl(c.url));
      }

      const [logo, settings] = await Promise.all([
        api.getLogo().catch(() => ({ exists: false, url: null })),
        api.getSettings().catch(() => ({})),
      ]);

      const videoUrl = await generateShortsVideo({
        beats,
        logoUrl: logo.exists ? api.mediaUrl(logo.url) : null,
        brandName: settings.brandName || "",
        secondsPerBeat,
        narrationClipUrls,
        bgmFile: bgmFile || undefined,
        bgmVolume: bgmVolume / 100,
        onProgress: (msg) => setShortsVideo((prev) => ({ ...prev, progress: msg })),
      });

      setShortsVideo({ url: videoUrl, loading: false, error: "", progress: "" });
    } catch (e) {
      setShortsVideo({ url: "", loading: false, error: e.message, progress: "" });
    }
  };

  // 카드 이미지 전체를 zip 하나로 묶어 한 번에 다운로드한다(개별 파일 저장 없이 폴더처럼 받을 수 있게).
  const downloadCardImagesZip = async () => {
    setZipDownloading(true);
    try {
      const zip = new JSZip();
      const results = await Promise.all(
        cardImages.urls.map(async (url, i) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${i + 1}장 다운로드 실패 (${res.status})`);
          return { i, blob: await res.blob() };
        }),
      );
      results.forEach(({ i, blob }) => zip.file(`카드뉴스_${String(i + 1).padStart(2, "0")}.png`, blob));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `카드뉴스_${current.id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(zipUrl);
    } catch (e) {
      setCardImages((prev) => ({ ...prev, error: e.message }));
    } finally {
      setZipDownloading(false);
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

  const deleteHistoryItem = async (g) => {
    if (!confirm("이 생성 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    await api.deleteGeneration(g.id);
    if (current?.id === g.id) setCurrent(null);
    loadHistory();
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
            <div className="channel-tabs">
              {CHANNEL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`channel-tab ${activeChannel === t.id ? "active" : ""}`}
                  onClick={() => setActiveChannel(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeChannel === "blog" && (
              <div className="channel-pane">
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
            )}

            {activeChannel === "linkedin" && (
              <div className="channel-pane">
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
                <p className="hint" style={{ marginTop: 6 }}>
                  회사 페이스북 페이지는 별도 콘텐츠를 만들지 않고, 위 LinkedIn 원고를 그대로 캡션으로 재사용해
                  자동 발행합니다("페이스북에 추가"를 누르면 캘린더에 페이스북 행이 별도로 생깁니다 — LinkedIn
                  게시물과는 별개로 발행 예약·URL을 관리할 수 있습니다).
                </p>
              </div>
            )}

            {activeChannel === "shorts" && (
              <div className="channel-pane">
                <p className="hint">훅: {current.result.shorts.hook}</p>
                <table>
                  <thead>
                    <tr><th>자막</th><th>이미지 프롬프트 (영문)</th></tr>
                  </thead>
                  <tbody>
                    {current.result.shorts.scenes.map((s, i) => (
                      <tr key={i}>
                        <td>{s.caption}</td>
                        <td>{s.imagePrompt}</td>
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

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={narrationEnabled}
                      onChange={(e) => setNarrationEnabled(e.target.checked)}
                      disabled={shortsVideo.loading}
                    />
                    AI 음성 내레이션 추가 (자막을 AI 목소리로 읽어줍니다)
                  </label>
                  <p className="hint" style={{ marginTop: 4 }}>
                    켜면 각 장면 노출 시간이 해당 내레이션 길이에 맞춰 자동으로 조정됩니다(장면당 4초 고정 대신).
                  </p>

                  <label style={{ marginTop: 10, display: "block" }}>배경음악 (선택 — mp3/wav 등 가지고 계신 파일)</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setBgmFile(e.target.files?.[0] || null)}
                    disabled={shortsVideo.loading}
                  />
                  {bgmFile && (
                    <div style={{ marginTop: 8 }}>
                      <label>배경음악 볼륨 ({bgmVolume}%)</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={bgmVolume}
                        onChange={(e) => setBgmVolume(Number(e.target.value))}
                        disabled={shortsVideo.loading}
                        style={{ width: "100%" }}
                      />
                      <p className="hint" style={{ marginTop: 4 }}>
                        선택한 곡: {bgmFile.name} — 영상 길이에 맞춰 자동으로 반복 재생됩니다.
                      </p>
                    </div>
                  )}
                  <button className="ghost" style={{ marginTop: 10 }} onClick={generateShortsVideoHandler} disabled={shortsVideo.loading}>
                    {shortsVideo.loading ? "영상 생성 중..." : "🎬 쇼츠 영상 생성 (OpenAI 또는 Gemini 키 필요)"}
                  </button>
                  <p className="hint" style={{ marginTop: 6 }}>
                    장면마다 AI 배경 이미지를 만들어 자막·로고와 함께 세로형(9:16) 영상으로 합성합니다.
                    브라우저에서 직접 녹화하는 방식이라 결과물은 WebM 형식입니다 — 대부분의 플랫폼에서
                    업로드되지만, MP4가 꼭 필요하면 무료 변환 도구로 한 번 더 변환해주세요. 저작권이 있는
                    음원은 사용하지 마시고, 직접 소유했거나 로열티 프리 음원만 배경음악으로 사용하세요.
                  </p>
                  {shortsVideo.loading && shortsVideo.progress && (
                    <p className="hint" style={{ marginTop: 4 }}>{shortsVideo.progress}</p>
                  )}
                  {shortsVideo.error && <div className="error-box" style={{ marginTop: 8 }}>{shortsVideo.error}</div>}
                  {shortsVideo.url && (
                    <div style={{ marginTop: 10 }}>
                      <video
                        src={shortsVideo.url}
                        controls
                        style={{ width: "100%", maxWidth: 260, borderRadius: 8, display: "block", background: "#000" }}
                      />
                      <a
                        href={shortsVideo.url}
                        download={`쇼츠영상_${current.id.slice(0, 8)}.webm`}
                        className="ghost"
                        style={{ display: "inline-block", marginTop: 6, textDecoration: "none", textAlign: "center" }}
                      >
                        ⬇ 다운로드 (.webm)
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeChannel === "cardnews" && (
              <div className="channel-pane">
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
                    <>
                      <button
                        className="ghost"
                        style={{ marginTop: 10 }}
                        onClick={downloadCardImagesZip}
                        disabled={zipDownloading}
                      >
                        {zipDownloading ? "압축 중..." : `⬇ 전체 ${cardImages.urls.length}장 zip으로 다운로드`}
                      </button>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10, paddingBottom: 6 }}>
                        {cardImages.urls.map((url, i) => (
                          <div key={i} style={{ flexShrink: 0, width: 120 }}>
                            <img
                              src={url}
                              alt={`카드뉴스 ${i + 1}장`}
                              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 6, display: "block" }}
                            />
                            <a href={url} download style={{ display: "block", textAlign: "center", fontSize: 11, marginTop: 4 }}>
                              ⬇ {i + 1}장만
                            </a>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
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
              <tr><th>생성일시</th><th>제목</th><th>목적</th><th>등급</th><th></th></tr>
            </thead>
            <tbody>
              {history.slice(0, 15).map((g) => (
                <tr key={g.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(g.createdAt).toLocaleString("ko-KR")}</td>
                  <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {g.result?.blog?.titles?.[0] || g.sourceExcerpt?.slice(0, 40) || "-"}
                  </td>
                  <td>{g.purpose || "-"}</td>
                  <td>
                    {g.review?.grade ? (
                      <span className={`badge ${g.review.grade.toLowerCase()}`}>{g.review.grade}</span>
                    ) : (
                      <span className="badge gray">검수전</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="ghost" onClick={() => setCurrent(g)}>불러오기</button>{" "}
                    <button className="danger" onClick={() => deleteHistoryItem(g)}>삭제</button>
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
