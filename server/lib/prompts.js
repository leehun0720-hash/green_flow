// 매뉴얼 03·04장(생성 자동화 — 마스터 프롬프트 설계 / 채널별 변환 프롬프트 템플릿) 기반

// 화면에 표시되는 앱 이름과 색상 테마 (콘텐츠 생성 프롬프트와는 무관 — UI 전용)
export const THEMES = [
  { id: "green", label: "그린" },
  { id: "blue", label: "블루" },
  { id: "purple", label: "퍼플" },
  { id: "orange", label: "오렌지" },
  { id: "teal", label: "틸" },
  { id: "rose", label: "로즈" },
  { id: "dark", label: "다크 모드" },
];

// 콘텐츠 생성(마스터 프롬프트) · 월간 리포트에 사용할 AI 공급자 — 설정 화면에서 전환 가능
export const AI_PROVIDERS = [
  { id: "anthropic", label: "Claude (Anthropic)", defaultModel: "claude-opus-4-8" },
  { id: "openai", label: "ChatGPT (OpenAI)", defaultModel: "gpt-5.5" },
  { id: "gemini", label: "Gemini (Google)", defaultModel: "gemini-3.5-flash" },
];

export const DEFAULT_SETTINGS = {
  appName: "greenflow",
  theme: "green",
  aiProvider: "anthropic",
  aiModelAnthropic: "claude-opus-4-8",
  aiModelOpenAI: "gpt-5.5",
  aiModelGemini: "gemini-3.5-flash",
  brandName: "그린플로",
  brandDef: "AI 탄소회계 플랫폼",
  brandModifier: "지구테크",
  glossary: "Scope 1·2·3, EEIO, CBAM, 기후공시 등 표기를 통일해서 사용한다.",
  toneGuide:
    "전문적이되 쉬운 설명을 지향한다. 과장 금지 — \"업계 최고\", \"최초\", \"1위\" 등 근거 없는 최상급 표현을 쓰지 않는다.",
  forbiddenPhrases: ["업계 최고", "국내 최초", "1위", "최고의"],
  blogKeywordPool: [
    "탄소회계",
    "탄소배출량 계산",
    "Scope 3",
    "CBAM 대응",
    "기후공시 의무화",
    "ESG 보고서 작성",
    "탄소국경조정제도",
    "중소기업 ESG",
  ],
  hashtagFixed: ["그린플로", "지구테크"],
  hashtagVariable: ["탄소회계", "CBAM", "기후공시", "ESG경영"],
  // 클리핑 모니터링에서 언급을 수집할 키워드 — 클리핑 화면·자동 수집 스케줄러가 공유
  clippingKeywords: ["그린플로", "오후두시랩", "탄소회계 AI"],
  contentPillars: [
    { id: "regulation", label: "규제 해설형" },
    { id: "case", label: "고객 사례형" },
    { id: "tech", label: "기술 해설형" },
    { id: "issue", label: "이슈 연동" },
  ],
};

// 상주 지침 (Claude 프로젝트 지침에 해당) — 1회 설정 후 매 요청에 시스템 프롬프트로 재사용
export function buildSystemPrompt(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  return `당신은 "${s.brandName}"의 콘텐츠 자동화 파이프라인에서 채널별 콘텐츠 초안을 생성하는 전담 카피라이터입니다.

# 브랜드 정의
${s.brandName} = ${s.brandDef}. 고정 수식어: "${s.brandModifier}".

# 용어집
${s.glossary}

# 톤 가이드
${s.toneGuide}
금칙 표현: ${s.forbiddenPhrases.join(", ")}

# 3대 설계 원칙
1. 사람은 판단, AI는 실행 — 원본에 없는 사실·수치는 절대 추가하지 않는다.
2. 1소스 멀티유즈 — 모든 콘텐츠는 검증된 원본(기사·보도자료·인터뷰) 1건에서만 파생시킨다. 채널별로 새로 쓰지 않는다.
3. 도구 최소주의 — 과장 광고 없이 실무자 관점을 유지한다.

# 채널별 규격
- 네이버 블로그: 1,500~2,000자. 제목 3안(타깃 키워드 포함, 25자 내). 구조: 문제 제기 → 핵심 내용 → 실무 시사점 → ${s.brandName} 연결(광고성 최소화) → 요약. 소제목 3~4개. 기사 원문 그대로 복붙 금지(중복 문서 판정 위험) — 반드시 재구성.
  본문은 반드시 sections 배열(heading/paragraph 블록의 순서 있는 목록)로 반환한다 — 하나의 긴 문자열로 합치지 말 것.
  각 소제목은 type:"heading" 블록 하나, 그 아래 본문은 type:"paragraph" 블록 하나 이상(문단 하나=한 흐름의 생각, 3~5문장)으로 나눈다.
  문단 내부에서 임의로 줄바꿈을 넣지 말고(그대로 붙여넣기했을 때 어색한 개행이 생김), 한 문단은 한 줄의 이어진 문장으로 작성한다.
- LinkedIn: 대표 명의 1인칭, 600자 내외. 첫 줄은 스크롤을 멈추는 한 문장. 핵심 인사이트 3줄 요약 + 질문형 마무리. 해시태그 3개(고정 2개 ${s.hashtagFixed.map((h) => "#" + h).join(" ")} + 주제 태그 1개).
- 쇼츠 스크립트: 최종 영상 길이는 15초 이내여야 한다 — hook 1개 + scenes 2~3개 + cta로 구성하고, 자막은 소리 내어 읽었을 때 컷당 3~4초 안에 끝나는 짧은 문장으로 쓴다. hook은 영상의 첫 번째 컷에 나오는 문장이고 scenes는 그 다음부터 이어지는 장면들이다 — scenes[0]는 hook 바로 다음(두 번째 컷)이므로 hook과 똑같은 문장을 반복하지 않는다(같은 메시지를 두 번 말하지 말고, hook에서 던진 질문·후킹에 곧바로 답하거나 다음 내용으로 자연스럽게 이어간다). [자막]/[imagePrompt] 2열 구조 — imagePrompt는 이미지 생성 AI에 그대로 전달되는 프롬프트이므로 반드시: (1) 영어로만 작성한다(한글 금지), (2) "전환된다", "~에서 ~로 바뀌며" 같은 장면 전환·카메라 지시·이전 장면 언급 없이 지금 이 컷 하나의 정지된 장면만 묘사한다, (3) 인물·행동·배경 같은 시각적 요소를 구체적으로 서술한다. 1영상 1메시지만. 마지막 컷에 CTA("프로필 링크에서 확인").
- 카드뉴스: 7장 고정. 장별 헤드카피(15자 내) + 서브카피(40자 내). 1장은 숫자·질문 훅, 7장은 CTA+로고. 장당 3줄 초과 금지.

# 출력 규칙
- 원본에 없는 사실·수치·비교·최상급 표현을 추가하지 않는다.
- 보도자료체("~밝혔다") 금지, 과도한 홍보 문구 금지(정보 8 : 브랜드 2 비율 유지).
- 마지막에 [검수 포인트]로 ① 원본과 다르게 표현된 부분 ② 수치 인용 위치 ③ 단정적 표현을 스스로 나열한다.`;
}

export function buildGenerationUserPrompt({ source, purpose, keywords }) {
  return `아래 [원본]을 기반으로 4종 콘텐츠를 한 번에 작성하라. 원본에 없는 사실·수치는 절대 추가하지 말 것.

[발행 목적]: ${purpose || "(미지정)"}
[타깃 키워드]: ${keywords || "(미지정)"}
[원본]:
${source}`;
}

// Claude 구조화 출력(output_config.format)에 사용할 JSON 스키마
export const GENERATION_SCHEMA = {
  name: "greenflow_content_pipeline",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      blog: {
        type: "object",
        additionalProperties: false,
        properties: {
          titles: { type: "array", items: { type: "string" } },
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["heading", "paragraph"] },
                text: { type: "string" },
              },
              required: ["type", "text"],
            },
          },
        },
        required: ["titles", "sections"],
      },
      linkedin: {
        type: "object",
        additionalProperties: false,
        properties: {
          post: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
        },
        required: ["post", "hashtags"],
      },
      shorts: {
        type: "object",
        additionalProperties: false,
        properties: {
          hook: {
            type: "string",
            description:
              "영상의 첫 번째 컷(3~4초)에 나오는 문장. scenes[0]의 자막과 절대 동일한 문장이면 안 된다.",
          },
          scenes: {
            type: "array",
            description:
              "hook 다음(두 번째 컷)부터 이어지는 장면들. 총 2~3개로, scenes[0].caption은 hook과 다른 문장이어야 하며 hook에서 던진 훅에 이어지는 다음 내용을 담는다. 전체 영상(hook+scenes+cta)이 15초를 넘지 않도록 짧게 구성한다.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                caption: { type: "string" },
                imagePrompt: {
                  type: "string",
                  description:
                    "이 장면의 배경을 AI 이미지 생성 모델에 그대로 전달할 프롬프트. 반드시 영어로만 쓴다(한글 금지). " +
                    "'전환된다'처럼 장면이 바뀌는 카메라 지시나 이전/다음 장면 언급 없이, 지금 이 컷 하나의 정지된 " +
                    "시각 장면만 구체적으로 묘사한다.",
                },
              },
              required: ["caption", "imagePrompt"],
            },
          },
          cta: { type: "string" },
        },
        required: ["hook", "scenes", "cta"],
      },
      cardnews: {
        type: "object",
        additionalProperties: false,
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                headline: { type: "string" },
                subcopy: { type: "string" },
              },
              required: ["headline", "subcopy"],
            },
          },
        },
        required: ["cards"],
      },
      reviewPoints: {
        type: "object",
        additionalProperties: false,
        properties: {
          differencesFromSource: { type: "string" },
          numberCitations: { type: "string" },
          assertiveExpressions: { type: "string" },
        },
        required: ["differencesFromSource", "numberCitations", "assertiveExpressions"],
      },
    },
    required: ["blog", "linkedin", "shorts", "cardnews", "reviewPoints"],
  },
};

// 10 · REPORT AUTOMATION — 월간 리포트 프롬프트
export function buildReportPrompt({ month, clippingCsv, calendarSummary, channelMetrics }) {
  return `아래 3개 데이터로 월간 홍보 성과 리포트를 작성하라. 대상 월: ${month}.
양식: ① 요약(성과 하이라이트 3줄) ② 언론 노출 표(날짜·매체·제목·URL·등급) ③ 디지털 채널 표(채널별 발행 수·핵심 지표·전월 대비) ④ 베스트 콘텐츠 3선(수치 근거) ⑤ 다음 달 제안 3가지.
데이터에 없는 수치는 만들지 말고 "집계 예정"으로 표기하라. 매체 등급은 [TOP메이저/중급/전문지/기타] 기준표를 따르라.
마크다운 형식으로 작성하라.

[데이터1: clipping_log.csv 해당 월]
${clippingCsv || "(데이터 없음)"}

[데이터2: 캘린더 발행 내역]
${calendarSummary || "(데이터 없음)"}

[데이터3: 채널 인사이트 요약]
${channelMetrics || "(사람이 직접 입력 예정)"}`;
}
