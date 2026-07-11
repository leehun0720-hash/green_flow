import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import HelpLink from "./HelpLink.jsx";

const CHANNELS = ["블로그", "페이스북", "LinkedIn-회사", "LinkedIn-대표", "쇼츠", "릴스", "카드뉴스"];
const TYPES = ["규제해설", "고객사례", "기술해설", "이슈연동"];
const STATUSES = ["초안", "검수완료", "예약됨", "발행", "집계반영"];

// Meta Graph API로 실제 자동 발행되는 채널 — 예약됨 상태 + 예정 시각 도달 시 서버 스케줄러가 자동 게시
const AUTO_PUBLISH_CHANNELS = new Set(["페이스북", "카드뉴스", "릴스"]);

const STATUS_BADGE = {
  초안: "gray",
  검수완료: "yellow",
  예약됨: "yellow",
  발행: "green",
  집계반영: "green",
};

function emptyForm() {
  return {
    datetime: "",
    channel: CHANNELS[0],
    type: TYPES[0],
    source: "",
    status: "초안",
    url: "",
    note: "",
    caption: "",
    imageUrl: "",
    videoUrl: "",
    link: "",
  };
}

export default function Calendar({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [publishError, setPublishError] = useState("");

  const load = async () => {
    setLoading(true);
    setRows(await api.listCalendar());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await api.addCalendarRow(form);
    setForm(emptyForm());
    setShowForm(false);
    load();
  };

  const updateStatus = async (row, status) => {
    await api.updateCalendarRow(row.id, { status });
    load();
  };

  const updateUrl = async (row, url) => {
    await api.updateCalendarRow(row.id, { url });
  };

  const updateSnsField = async (row, field, value) => {
    await api.updateCalendarRow(row.id, { [field]: value });
  };

  const remove = async (id) => {
    if (!confirm("이 행을 삭제할까요?")) return;
    await api.deleteCalendarRow(id);
    load();
  };

  const publishNow = async (row) => {
    setPublishError("");
    setPublishingId(row.id);
    try {
      await api.publishCalendarRowNow(row.id);
      load();
    } catch (e) {
      setPublishError(e.message);
    } finally {
      setPublishingId(null);
    }
  };

  const isAutoChannel = AUTO_PUBLISH_CHANNELS.has(form.channel);
  const sorted = [...rows].sort((a, b) => (a.datetime || "").localeCompare(b.datetime || ""));

  // 예정 시각이 지났는데 아직 발행 전 상태(초안/검수완료)면 놓친 일정일 가능성이 높다 — 눈에 띄게 표시.
  const now = new Date();
  const isOverdue = (r) =>
    r.datetime && new Date(r.datetime) < now && (r.status === "초안" || r.status === "검수완료");
  const overdueCount = sorted.filter(isOverdue).length;

  return (
    <div>
      <div className="page-header-row">
        <h2 className="page-title">콘텐츠 캘린더</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <HelpLink onNavigate={onNavigate} anchor="calendar" />
          <HelpLink onNavigate={onNavigate} anchor="sns" label="SNS 자동 발행 가이드" />
        </div>
      </div>
      <p className="page-desc">
        발행 누락 0건의 비결은 도구가 아니라 '단일 대장'입니다. 모든 채널의 상태를 이 표 한 장에서 관리하세요.
        <strong> 페이스북·카드뉴스(인스타 피드)·릴스</strong>는 상태를 "예약됨"으로 두면 예정 시각에 서버가
        Meta Graph API로 자동 발행합니다.
      </p>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>발행 대장 ({rows.length}건)</h3>
          <button className="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "닫기" : "+ 행 추가"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} style={{ marginTop: 16 }}>
            <div className="row">
              <div className="field">
                <label>발행 예정 일시</label>
                <input
                  type="datetime-local"
                  value={form.datetime}
                  onChange={(e) => setForm({ ...form, datetime: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>채널</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>유형 (콘텐츠 기둥)</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>소스 (원본 기사·보도자료 링크 또는 요약 — 1소스 원칙 강제)</label>
              <input type="text" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} required />
            </div>
            <div className="row">
              <div className="field">
                <label>상태</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>발행 URL</label>
                <input type="text" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
            </div>

            {isAutoChannel && (
              <div className="card" style={{ background: "var(--accent-100)", borderStyle: "dashed" }}>
                <h4 style={{ margin: "0 0 10px", color: "var(--accent-ink)" }}>
                  SNS 자동 발행 설정 — Meta Graph API
                </h4>
                <div className="field">
                  <label>캡션 (실제 게시될 문구)</label>
                  <textarea rows={3} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
                </div>
                {form.channel === "릴스" ? (
                  <div className="field">
                    <label>영상 URL (공개 접근 가능한 mp4 링크)</label>
                    <input type="text" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
                  </div>
                ) : (
                  <div className="row">
                    <div className="field">
                      <label>이미지 URL (공개 접근 가능한 링크 — 카드뉴스/사진 게시물용)</label>
                      <input type="text" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                    </div>
                    {form.channel === "페이스북" && (
                      <div className="field">
                        <label>링크 (이미지 없을 때 텍스트+링크 게시물용, 선택)</label>
                        <input type="text" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                      </div>
                    )}
                  </div>
                )}
                <p className="hint">
                  이미지·영상은 Meta 서버가 직접 가져갈 수 있도록 공개 URL이어야 합니다(우리 서버가 아닌 외부에 호스팅된 링크 — 예: Canva 다운로드 링크, 이미지 호스팅 서비스).
                </p>
              </div>
            )}

            <div className="field">
              <label>메모</label>
              <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <button className="primary" type="submit">저장</button>
          </form>
        )}
      </div>

      {publishError && <div className="error-box">{publishError}</div>}
      {overdueCount > 0 && (
        <div className="error-box">
          예정 시각이 지났는데 아직 발행 전 상태인 항목이 {overdueCount}건 있습니다 — 아래 표에서
          <span className="badge red" style={{ margin: "0 4px" }}>지연</span>표시된 행을 확인하세요.
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="hint">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="hint">등록된 발행 일정이 없습니다. 콘텐츠 생성 후 "캘린더에 추가"를 누르거나 위에서 직접 추가하세요.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>일시</th><th>채널</th><th>유형</th><th>소스</th><th>상태</th><th>발행 URL</th><th>메모</th><th>SNS 자동발행</th><th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isAuto = AUTO_PUBLISH_CHANNELS.has(r.channel);
                const overdue = isOverdue(r);
                return (
                  <React.Fragment key={r.id}>
                    <tr style={overdue ? { background: "var(--red-bg)" } : undefined}>
                      <td>
                        {r.datetime ? new Date(r.datetime).toLocaleString("ko-KR") : "-"}
                        {overdue && (
                          <div><span className="badge red">지연</span></div>
                        )}
                      </td>
                      <td>{r.channel}</td>
                      <td>{r.type}</td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{r.source}</td>
                      <td>
                        <select
                          className={`status-select status-${STATUS_BADGE[r.status] || "gray"}`}
                          value={r.status}
                          onChange={(e) => updateStatus(r, e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          defaultValue={r.url}
                          placeholder="발행 후 URL"
                          onBlur={(e) => updateUrl(r, e.target.value)}
                          style={{ width: 140 }}
                        />
                      </td>
                      <td style={{ maxWidth: 140 }}>{r.note}</td>
                      <td>
                        {isAuto ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span className="badge green">자동 발행 대상</span>
                            <button className="ghost" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                              {expandedId === r.id ? "설정 닫기" : "SNS 설정"}
                            </button>
                            <button
                              className="ghost"
                              onClick={() => publishNow(r)}
                              disabled={publishingId === r.id}
                            >
                              {publishingId === r.id ? "발행 중..." : "지금 발행"}
                            </button>
                          </div>
                        ) : (
                          <span className="hint">해당 없음</span>
                        )}
                      </td>
                      <td>
                        <button className="danger" onClick={() => remove(r.id)}>삭제</button>
                      </td>
                    </tr>
                    {isAuto && expandedId === r.id && (
                      <tr>
                        <td colSpan={9} style={{ background: "var(--surface-subtle)" }}>
                          <div className="row" style={{ padding: "8px 4px" }}>
                            <div className="field">
                              <label>캡션</label>
                              <textarea
                                rows={2}
                                defaultValue={r.caption}
                                onBlur={(e) => updateSnsField(r, "caption", e.target.value)}
                              />
                            </div>
                            {r.channel === "릴스" ? (
                              <div className="field">
                                <label>영상 URL</label>
                                <input
                                  type="text"
                                  defaultValue={r.videoUrl}
                                  onBlur={(e) => updateSnsField(r, "videoUrl", e.target.value)}
                                />
                              </div>
                            ) : (
                              <div className="field">
                                <label>이미지 URL</label>
                                <input
                                  type="text"
                                  defaultValue={r.imageUrl}
                                  onBlur={(e) => updateSnsField(r, "imageUrl", e.target.value)}
                                />
                              </div>
                            )}
                            {r.channel === "페이스북" && (
                              <div className="field">
                                <label>링크 (선택)</label>
                                <input
                                  type="text"
                                  defaultValue={r.link}
                                  onBlur={(e) => updateSnsField(r, "link", e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
