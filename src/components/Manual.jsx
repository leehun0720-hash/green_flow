import React, { useEffect, useState } from "react";

const SECTIONS = [
  { id: "overview", label: "1. 전체 개요" },
  { id: "setup", label: "2. 최초 설정 — API 키 발급" },
  { id: "generate", label: "3. 콘텐츠 생성 사용법" },
  { id: "review", label: "4. 사람 검수 게이트" },
  { id: "calendar", label: "5. 콘텐츠 캘린더" },
  { id: "sns", label: "6. SNS 자동 발행 상세 가이드" },
  { id: "clipping", label: "7. 클리핑 모니터링" },
  { id: "report", label: "8. 월간 리포트" },
  { id: "settings", label: "9. 설정 — 상주 지침" },
  { id: "routine", label: "10. 주간 운영 루틴" },
  { id: "troubleshoot", label: "11. 트러블슈팅" },
  { id: "security", label: "12. 보안 유의사항" },
];

export default function Manual({ anchor }) {
  const [highlighted, setHighlighted] = useState(null);

  useEffect(() => {
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlighted(anchor);
    const t = setTimeout(() => setHighlighted(null), 1800);
    return () => clearTimeout(t);
  }, [anchor]);

  return (
    <div>
      <h2 className="page-title">사용자 매뉴얼</h2>
      <p className="page-desc">
        greenflow 콘텐츠 자동화 앱의 전체 사용법입니다. 처음 쓰는 경우 <strong>2. 최초 설정</strong>부터
        순서대로 따라 하세요.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>목차</h3>
        <ul className="manual-toc">
          {SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`}>{s.label}</a></li>
          ))}
        </ul>
      </div>

      {/* 1. 개요 */}
      <div className={`card manual-section ${highlighted === "overview" ? "manual-highlight-active" : ""}`} id="overview">
        <h3>1. 전체 개요</h3>
        <p>
          이 앱은 기사·보도자료 <strong>1건</strong>을 넣으면 <strong>네이버 블로그·LinkedIn·쇼츠 스크립트·카드뉴스</strong>
          4종 콘텐츠를 동시에 만들고, 사람 검수 → 캘린더 등록 → (페이스북/인스타그램은) 자동 발행 → 클리핑 수집 →
          월간 리포트까지 하나의 흐름으로 이어줍니다. 핵심 원칙은 "사람은 판단, AI는 실행"입니다 — 주제 선정과
          최종 승인만 사람이 하고, 초안 작성·채널 변환·발행·집계는 시스템이 처리합니다.
        </p>
        <h4>전체 흐름 (5단계)</h4>
        <ol>
          <li><strong>소스</strong> — 기사·보도자료·인터뷰 원문을 준비합니다.</li>
          <li><strong>생성</strong> — "콘텐츠 생성" 화면에서 마스터 프롬프트를 실행해 4채널 초안을 한 번에 만듭니다.</li>
          <li><strong>검수</strong> — 10분 체크리스트로 사람이 확인하고 GREEN/YELLOW/RED 등급을 매깁니다.</li>
          <li><strong>배포</strong> — "콘텐츠 캘린더"에 등록합니다. 페이스북·카드뉴스(인스타)·릴스는 예약 시각에
            서버가 자동으로 발행하고, 블로그·LinkedIn·쇼츠는 원고를 각 플랫폼에 붙여넣어 발행합니다.</li>
          <li><strong>측정</strong> — "클리핑 모니터링"이 언급을 매일 수집하고, "월간 리포트"가 이를 모아 성과
            보고서를 자동으로 만듭니다.</li>
        </ol>
        <div className="manual-note">
          이 앱을 처음 쓰는 것이라면 왼쪽 메뉴 순서(대시보드 → 콘텐츠 생성 · 검수 → 콘텐츠 캘린더 → 클리핑
          모니터링 → 월간 리포트 → 설정)대로 한 번씩 훑어보는 것을 권장합니다.
        </div>
      </div>

      {/* 2. 최초 설정 */}
      <div className={`card manual-section ${highlighted === "setup" ? "manual-highlight-active" : ""}`} id="setup">
        <h3>2. 최초 설정 — API 키 발급 및 입력</h3>
        <p>
          모든 키는 <strong>설정 → API 키 관리</strong> 화면에 붙여넣으면 됩니다. 서버 재시작이 필요 없고,
          입력한 값은 마스킹되어 화면에 표시되며 서버에만 저장됩니다. 아래 순서대로 진행하세요.
        </p>

        <h4>2-1. AI 공급자 키 — Claude · ChatGPT · Gemini 중 하나 (필수)</h4>
        <p>
          콘텐츠 생성과 월간 리포트는 Claude(Anthropic) · ChatGPT(OpenAI) · Gemini(Google) 중 <strong>하나만
          연결하면</strong> 바로 쓸 수 있습니다. 셋 다 연결해두고 설정 화면의 "AI 공급자"에서 필요할 때마다
          바꿔가며 쓸 수도 있습니다.
        </p>
        <p><strong>Claude (Anthropic)</strong></p>
        <ol>
          <li><a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>에 가입/로그인합니다.</li>
          <li>왼쪽 메뉴에서 <code className="kbd">API Keys</code>로 이동합니다.</li>
          <li><code className="kbd">Create Key</code>를 눌러 새 키를 발급받습니다. (표시되는 순간만 전체 값을 볼 수
            있으니 즉시 복사하세요.)</li>
          <li>결제 수단을 등록하고 사용량 한도를 설정합니다 (사용한 만큼만 과금되는 종량제입니다).</li>
          <li>이 앱의 <strong>설정 → API 키 관리 → Claude API 키</strong> 입력란에 붙여넣고 저장합니다.</li>
        </ol>
        <p><strong>ChatGPT (OpenAI)</strong></p>
        <ol>
          <li><a href="https://platform.openai.com" target="_blank" rel="noreferrer">platform.openai.com</a>에 가입/로그인합니다.</li>
          <li>오른쪽 위 메뉴에서 <code className="kbd">API keys</code>로 이동해 <code className="kbd">Create new secret key</code>를 누릅니다.</li>
          <li>결제 수단을 등록합니다(종량제).</li>
          <li>이 앱의 <strong>설정 → API 키 관리 → ChatGPT API 키</strong>에 붙여넣고 저장합니다.</li>
        </ol>
        <p><strong>Gemini (Google)</strong></p>
        <ol>
          <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>에서
            구글 계정으로 로그인합니다.</li>
          <li><code className="kbd">Create API key</code>를 눌러 키를 발급받습니다(무료 등급 제공).</li>
          <li>이 앱의 <strong>설정 → API 키 관리 → Gemini API 키</strong>에 붙여넣고 저장합니다.</li>
        </ol>
        <p className="hint">
          연결한 뒤에는 <strong>설정 → AI 공급자</strong>에서 실제로 사용할 공급자를 고르고, 필요하면 모델명도
          바꿀 수 있습니다(비워두면 각 공급자의 기본 모델을 사용합니다).
        </p>
        <p className="hint">
          블로그 대표 이미지·카드뉴스 이미지 <strong>자동 생성 기능</strong>을 쓰려면 <strong>OpenAI(ChatGPT)
          또는 Gemini(Google) 키</strong> 중 하나가 있어야 합니다(3장 참고). 둘 다 연결돼 있으면 설정 →
          AI 공급자에서 고른 공급자를 우선 사용하고, 그 공급자에 이미지 생성이 안 되면(예: Claude만 있는 경우)
          연결된 다른 하나를 자동으로 사용합니다.
        </p>

        <h4>2-2. 네이버 검색 API (클리핑 모니터링 — 선택, 무료)</h4>
        <ol>
          <li><a href="https://developers.naver.com" target="_blank" rel="noreferrer">developers.naver.com</a>에서
            네이버 계정으로 로그인합니다.</li>
          <li><code className="kbd">Application → 애플리케이션 등록</code>으로 이동합니다.</li>
          <li>애플리케이션 이름을 입력하고, 사용 API에서 <strong>검색</strong>을 체크합니다.</li>
          <li>비로그인 오픈 API 서비스 환경에 <strong>웹 서비스 URL</strong>을 등록합니다(로컬 개발 중이라면
            <code className="kbd">http://localhost</code>를 등록해도 됩니다).</li>
          <li>등록 완료 후 발급되는 <strong>Client ID</strong>와 <strong>Client Secret</strong>을 복사합니다.</li>
          <li>설정 화면의 <strong>네이버 Client ID</strong> / <strong>네이버 Client Secret</strong> 칸에 각각
            붙여넣고 저장합니다.</li>
        </ol>
        <p className="hint">일 25,000회까지 무료입니다. 클리핑 자동 실행 정도로는 충분합니다.</p>

        <h4>2-3. Meta (페이스북·인스타그램 자동 발행 — 선택)</h4>
        <p>가장 단계가 많은 설정입니다. 순서대로 차근차근 진행하세요.</p>
        <ol>
          <li><a href="https://developers.facebook.com" target="_blank" rel="noreferrer">developers.facebook.com</a>에서
            개발자 계정으로 전환하고 로그인합니다.</li>
          <li><code className="kbd">내 앱 → 앱 만들기</code>에서 앱 유형을 <strong>"비즈니스"</strong>로 선택해
            생성합니다.</li>
          <li>앱 대시보드에서 <strong>Facebook 로그인</strong>과 <strong>Instagram Graph API</strong> 제품을
            추가합니다.</li>
          <li>발행할 <strong>페이스북 페이지</strong>가 없다면 먼저 페이스북에서 페이지를 만듭니다. 이미 있다면
            그 페이지를 사용합니다.</li>
          <li>해당 페이지에 <strong>인스타그램 비즈니스(또는 크리에이터) 계정</strong>을 연결합니다
            (인스타그램 앱 → 설정 → 계정 → 프로페셔널 계정으로 전환 → 페이스북 페이지와 연결).</li>
          <li>앱 대시보드의 <strong>도구 → Graph API 탐색기</strong>로 이동합니다.</li>
          <li>사용자 또는 페이지 토큰을 선택하고, 다음 권한을 체크한 뒤 <code className="kbd">토큰 생성</code>을
            누릅니다:
            <ul>
              <li><code className="kbd">pages_manage_posts</code></li>
              <li><code className="kbd">pages_read_engagement</code></li>
              <li><code className="kbd">instagram_basic</code></li>
              <li><code className="kbd">instagram_content_publish</code></li>
              <li><code className="kbd">business_management</code></li>
            </ul>
          </li>
          <li>발급된 토큰은 유효기간이 짧은 단기 토큰입니다. <code className="kbd">도구 → 액세스 토큰 디버거</code>에서
            <strong>"장기(long-lived) 액세스 토큰으로 변환"</strong>을 실행해 60일짜리 토큰으로 바꿉니다
            (페이지 토큰은 이 과정을 거치면 사실상 만료되지 않는 페이지 토큰이 됩니다).</li>
          <li>페이지 ID 확인: Graph API 탐색기에서 <code className="kbd">GET /me/accounts</code>를 호출하면
            내가 관리하는 페이지 목록과 각 페이지의 <strong>id</strong>, 그리고 페이지 전용
            <strong>access_token</strong>이 함께 나옵니다. 이 페이지 access_token을 사용하는 것이 가장 안정적입니다.</li>
          <li>인스타그램 비즈니스 계정 ID 확인: <code className="kbd">GET /{"{page-id}"}?fields=instagram_business_account</code>
            를 호출하면 연결된 인스타그램 계정 ID가 반환됩니다.</li>
          <li>이제 얻은 3가지 값을 설정 화면에 입력합니다:
            <ul>
              <li><strong>Meta 페이지 ID</strong> — 위에서 확인한 페이지 id</li>
              <li><strong>Meta 인스타그램 비즈니스 계정 ID</strong> — 위에서 확인한 instagram_business_account id</li>
              <li><strong>Meta 페이지 액세스 토큰</strong> — 장기로 변환한 페이지 access_token</li>
            </ul>
          </li>
        </ol>
        <div className="manual-note">
          페이지 액세스 토큰은 시간이 지나면 만료될 수 있습니다. 자동 발행이 갑자기 실패하기 시작하면 가장 먼저
          토큰을 재발급해 설정 화면에 다시 입력하세요 (트러블슈팅 섹션 참고).
        </div>

        <h4>2-4. 브랜드 상주 지침 설정</h4>
        <p>
          <strong>설정</strong> 화면 아래쪽의 브랜드 정의·용어집·톤 가이드·키워드 풀을 우리 회사에 맞게 한 번
          다듬어 두세요. 이후 모든 생성 요청에 자동으로 적용됩니다.
        </p>
      </div>

      {/* 3. 콘텐츠 생성 */}
      <div className={`card manual-section ${highlighted === "generate" ? "manual-highlight-active" : ""}`} id="generate">
        <h3>3. 콘텐츠 생성 사용법</h3>
        <ol>
          <li><strong>원본</strong> 칸에 기사 전문·보도자료·인터뷰 녹취 등 검증된 원본 1건 전체를 붙여넣습니다
            (링크가 아니라 본문 텍스트여야 합니다).</li>
          <li><strong>발행 목적</strong>(예: "10월 업데이트 인지 확산")과 <strong>타깃 키워드</strong>
            (예: "Scope 3 계산")를 입력합니다. 비워도 생성은 되지만, 채워두면 결과 품질이 올라갑니다.</li>
          <li><strong>"마스터 프롬프트 실행"</strong> 버튼을 누릅니다. 4종 콘텐츠를 한 번에 만들기 때문에
            최대 1분 정도 걸릴 수 있습니다.</li>
          <li>결과로 네이버 블로그(제목 3안 + 본문), LinkedIn 포스트, 쇼츠 스크립트(자막/이미지 프롬프트 2열,
            15초 이내 분량), 카드뉴스(7장 헤드카피/서브카피)가 각각 카드로 표시됩니다.</li>
          <li>맨 아래 <strong>[검수 포인트]</strong>는 AI가 스스로 "이 부분은 원본과 다르게 표현했다",
            "이 수치는 여기서 인용했다" 등을 보고하는 영역입니다. 검수 시간을 줄여주는 핵심 장치이니 꼭 읽어보세요.</li>
          <li>각 채널 카드 하단의 <strong>"캘린더에 추가"</strong> 버튼으로 원하는 채널만 골라 캘린더에
            등록합니다. 카드뉴스와 LinkedIn(→페이스북) 버튼은 자동 발행에 필요한 캡션까지 채워서 등록해줍니다.</li>
        </ol>
        <div className="manual-note">
          <strong>📋 복사 버튼을 꼭 사용하세요.</strong> 브라우저에서 텍스트를 마우스로 드래그해 Ctrl+C로
          복사하면, 이 화면의 글꼴·자간·줄간격 같은 서식(HTML)까지 함께 복사되어 네이버 블로그 스마트에디터
          등에 붙여넣을 때 서식이 충돌해 장평·자간이 흐트러지는 경우가 많습니다. 각 카드의 <strong>"복사"</strong>
          버튼은 서식 없는 순수 텍스트만 클립보드에 담아서 이 문제를 원천적으로 피합니다. 블로그 본문은
          문단·소제목이 구분된 상태로 복사되니, 스마트에디터에 붙여넣은 뒤 소제목 줄만 선택해 에디터의
          "소제목" 서식으로 지정해주세요.
        </div>

        <h4>이미지 자동 생성 (블로그 대표 이미지 · 카드뉴스 배경)</h4>
        <p>
          텍스트만으로는 표현력이 떨어지고 주목도가 낮기 때문에, 블로그 카드와 카드뉴스 카드에는 각각
          <strong>이미지 생성 버튼</strong>이 있습니다. 이미지 생성에는 <strong>OpenAI(ChatGPT) 또는
          Gemini(Google) API 키</strong>가 필요합니다(Claude는 이미지 생성을 지원하지 않습니다). 설정 →
          AI 공급자에서 고른 공급자(OpenAI 또는 Gemini)가 있으면 그것을 우선 사용하고, 없거나 Claude를
          쓰고 있다면 연결된 다른 하나(OpenAI 또는 Gemini)를 자동으로 사용합니다. 즉 콘텐츠 텍스트를
          Gemini로 생성하고 있다면 <strong>같은 Gemini 키로 이미지까지</strong> 바로 생성할 수 있습니다 —
          OpenAI 키가 따로 없어도 됩니다.
        </p>
        <ul>
          <li><strong>블로그 대표 이미지</strong> — 블로그 카드의 이미지 프롬프트 칸에 원하는 이미지 설명을
            입력(비워두면 제목·본문 요약으로 자동 구성)하고 <strong>"🖼️ 대표 이미지 생성"</strong>을 누르면
            1장을 생성합니다. 생성된 이미지는 미리보기로 표시되고, 다운로드해서 블로그 본문 상단에 직접
            삽입하면 됩니다.</li>
          <li><strong>카드뉴스 이미지</strong> — 카드뉴스 카드의 <strong>"🖼️ 카드뉴스 이미지 생성"</strong>을
            누르면, AI가 배경 이미지 1장을 생성한 뒤 그 위에 7장 각각의 헤드카피·서브카피·카드 번호·브랜드
            표기를 서버가 코드로 합성해 7장의 완성된 카드 이미지를 만들어줍니다(장마다 다른 배경을 새로
            생성하지 않고 같은 배경을 재사용해 세트로서의 통일감을 유지합니다). 완성된 이미지는 가로 스크롤
            갤러리로 표시되며, 각 카드를 개별적으로 다운로드해 인스타그램에 업로드하거나 캘린더 자동 발행의
            이미지 URL로 사용할 수 있습니다.</li>
          <li><strong>쇼츠 영상 생성</strong> — 쇼츠 스크립트 카드의 <strong>"🎬 쇼츠 영상 생성"</strong>을
            누르면, 훅·각 장면·CTA마다 AI 배경 이미지를 만든 뒤 자막과 브랜드 로고(업로드해뒀다면)를
            입혀 세로형(9:16) 영상 하나로 자동 합성합니다. 대본 자체가 <strong>총 15초 이내</strong>가
            되도록 생성되므로(hook 1개 + 장면 2~3개 + CTA), 컷당 길이도 그 안에서 자동으로 맞춰집니다.
            표에 보이는 "이미지 프롬프트" 열은 화면에는 표시되지 않고 AI 이미지 생성에만 쓰이는 영문
            설명입니다(사람이 읽는 자막과 별개). 영상 녹화는 서버가 아니라 브라우저에서 직접 처리되어
            결과물이 <strong>WebM</strong> 형식으로 나옵니다 — 인스타그램·유튜브 대부분 업로드는 되지만,
            특정 플랫폼에서 MP4를 요구하면 무료 온라인 변환기로 한 번 변환해서 쓰세요.</li>
          <li><strong>AI 음성 내레이션</strong> — "AI 음성 내레이션 추가" 체크박스를 켜면 각 장면 자막을
            OpenAI 또는 Gemini의 음성 합성으로 실제 사람 목소리처럼 읽어줍니다. 이 경우 장면 노출 시간이
            고정 4초가 아니라 <strong>해당 장면 내레이션의 실제 길이</strong>에 맞춰 자동으로 늘어나므로,
            음성과 자막이 어긋나지 않습니다. 내레이션 생성에도 이미지 생성과 같은 OpenAI/Gemini 키가
            필요합니다.</li>
          <li><strong>배경음악(BGM)</strong> — 가지고 계신 mp3/wav 파일을 "배경음악" 칸에서 선택하면 영상
            길이에 맞춰 자동으로 반복 재생되며 함께 녹화됩니다(볼륨 조절 가능). 내레이션을 함께 켜면 음성이
            묻히지 않도록 배경음악 볼륨이 자동으로 더 낮아집니다. 반드시 직접 소유했거나 로열티 프리인
            음원만 사용하세요 — 저작권이 있는 음악을 무단으로 쓰면 안 됩니다.</li>
        </ul>
        <p className="hint">
          아래쪽 "최근 생성 기록"에서 과거 생성물을 다시 불러와 검수하거나 캘린더에 추가할 수 있습니다.
        </p>
      </div>

      {/* 4. 검수 게이트 */}
      <div className={`card manual-section ${highlighted === "review" ? "manual-highlight-active" : ""}`} id="review">
        <h3>4. 사람 검수 게이트</h3>
        <p>자동화 파이프라인에서 유일하게 사람이 반드시 통과시켜야 하는 단계입니다.</p>
        <h4>체크리스트 4개 그룹</h4>
        <ul>
          <li><strong>팩트</strong> — 수치가 원본과 일치하는지, 원본에 없는 주장·최상급 표현이 추가되지
            않았는지, 고객사 실명이 공개 승인 범위 내인지.</li>
          <li><strong>브랜드</strong> — 고정 수식어·용어집 표기가 유지되는지, 톤이 과장 없이 실무자 관점을
            유지하는지.</li>
          <li><strong>법·윤리</strong> — 경쟁사 비방·저작물 무단 사용이 없는지, 광고 표기가 필요 시 포함됐는지.</li>
          <li><strong>기술</strong> — 링크·이미지·예약 시간이 캘린더와 일치하는지.</li>
        </ul>
        <h4>등급 판정</h4>
        <ul>
          <li><span className="badge green">GREEN</span> 즉시 통과 — 오탈자 수준. 그대로 예약 발행.</li>
          <li><span className="badge yellow">YELLOW</span> 수정 후 발행 — 표현·구조 수정 필요. 같은 문제가
            반복되면 설정의 "상주 지침"(톤 가이드·금칙 표현)에 규칙을 추가하세요.</li>
          <li><span className="badge red">RED</span> 발행 중단 — 팩트 오류·법적 리스크. 폐기 후 원본부터
            재확인하고 발주사에 공유하세요.</li>
        </ul>
        <p>
          체크박스와 등급을 선택하고 <strong>검수자 이니셜</strong>을 남긴 뒤 <strong>"검수 결과 저장"</strong>을
          누르면 기록이 남습니다. 대시보드의 "검수 대기 생성물" 카운트가 이 기록을 기준으로 계산됩니다.
        </p>
      </div>

      {/* 5. 캘린더 */}
      <div className={`card manual-section ${highlighted === "calendar" ? "manual-highlight-active" : ""}`} id="calendar">
        <h3>5. 콘텐츠 캘린더</h3>
        <p>모든 채널의 발행 상태를 이 표 하나로 관리합니다. 상태는 5단계로 흘러갑니다:</p>
        <p>
          <span className="badge gray">초안</span> → <span className="badge yellow">검수완료</span> →
          <span className="badge yellow">예약됨</span> → <span className="badge green">발행</span> →
          <span className="badge green">집계반영</span>
        </p>
        <h4>행 추가</h4>
        <ol>
          <li>"+ 행 추가"를 눌러 발행 예정 일시·채널·유형(콘텐츠 기둥)·소스를 입력합니다.</li>
          <li>채널을 <strong>페이스북 / 카드뉴스 / 릴스</strong> 중 하나로 선택하면 "SNS 자동 발행 설정"
            패널이 나타납니다 — 6장의 자동 발행 가이드를 참고하세요.</li>
          <li>블로그·LinkedIn·쇼츠는 자동 발행 대상이 아니므로, 원고를 복사해 각 플랫폼(네이버 블로그 스마트에디터,
            LinkedIn, YouTube Studio)에 직접 붙여넣고 예약 발행한 뒤 이 표의 <strong>발행 URL</strong> 칸에
            게시물 링크를 기록하면 됩니다.</li>
        </ol>
        <h4>상태·URL 수정</h4>
        <p>표에서 바로 상태 드롭다운과 발행 URL 입력칸을 수정할 수 있습니다(포커스를 벗어나면 자동 저장).</p>
      </div>

      {/* 6. SNS 자동 발행 상세 가이드 */}
      <div className={`card manual-section ${highlighted === "sns" ? "manual-highlight-active" : ""}`} id="sns">
        <h3>6. SNS 자동 발행 상세 가이드 (페이스북 · 인스타그램)</h3>
        <p>
          기존에 Meta Business Suite에서 사람이 예약 게시 버튼을 누르던 과정을, Graph API 호출로 완전히
          대체했습니다. 서버가 <strong>1분마다</strong> 캘린더를 확인해 조건에 맞는 게시물을 자동으로 올립니다.
        </p>
        <h4>자동 발행 조건</h4>
        <ol>
          <li>채널이 <strong>페이스북 / 카드뉴스 / 릴스</strong> 중 하나</li>
          <li>상태가 <strong>"예약됨"</strong></li>
          <li>발행 예정 일시가 현재 시각을 지났을 때</li>
        </ol>
        <p>세 조건이 모두 맞으면 서버가 자동으로 게시하고, 상태를 "발행"으로 바꾸며 실제 게시물 URL을 기록합니다.</p>

        <h4>이미지·영상 URL은 어떻게 준비하나요?</h4>
        <p>
          Meta 서버가 <strong>직접 그 주소로 접속해서</strong> 이미지·영상을 가져가기 때문에, 우리 PC나 로컬
          서버 주소(<code className="kbd">localhost</code>)는 사용할 수 없습니다. 아래 중 편한 방법을 쓰세요.
        </p>
        <ul>
          <li><strong>Canva</strong>에서 카드뉴스를 만든 뒤 "공유 → 더보기 → 퍼블릭 링크 생성"으로 이미지의
            공개 URL을 받습니다.</li>
          <li>무료 이미지 호스팅(예: imgur.com)에 업로드하고 "직접 링크(다이렉트 링크)"를 복사합니다.</li>
          <li>회사 자체 웹사이트나 클라우드 스토리지(구글 드라이브 "링크가 있는 모든 사용자" 공개 설정 등)에
            올린 뒤 그 공개 링크를 사용합니다.</li>
        </ul>

        <h4>채널별 필요한 값</h4>
        <ul>
          <li><strong>카드뉴스</strong>(인스타그램 피드) — 캡션 + 이미지 URL 필수</li>
          <li><strong>페이스북</strong> — 캡션 + (이미지 URL 있으면 사진 게시물, 없으면 텍스트/링크 게시물)</li>
          <li><strong>릴스</strong>(인스타그램) — 캡션 + 영상 URL(mp4) 필수. 영상 처리에 시간이 걸릴 수 있어
            최대 2분간 자동으로 기다렸다가 발행하고, 그래도 안 끝나면 다음 1분 뒤 스케줄러 실행에서 자동 재시도합니다.</li>
        </ul>

        <h4>단계별 사용법</h4>
        <ol>
          <li>콘텐츠 생성 화면에서 카드뉴스는 "캘린더에 추가 (인스타 자동발행)", LinkedIn 카드 옆의
            "페이스북에 추가 (자동발행)" 버튼으로 캘린더에 캡션이 채워진 채로 등록합니다.</li>
          <li>콘텐츠 캘린더에서 해당 행의 <strong>"SNS 설정"</strong>을 눌러 이미지 URL(또는 영상 URL)을
            입력합니다.</li>
          <li>내용이 준비됐다면 상태를 <strong>"예약됨"</strong>으로 바꿉니다. 예정 시각이 되면 자동 발행됩니다.</li>
          <li>바로 지금 올리고 싶다면 예정 시각과 상관없이 <strong>"지금 발행"</strong> 버튼을 누르면 즉시
            게시됩니다.</li>
        </ol>
        <div className="manual-note">
          앱(서버)이 켜져 있는 동안에만 자동 발행이 동작합니다. 예약 발행을 안정적으로 쓰려면 사무실 PC를
          상시 켜두거나, 클라우드 서버(예: 저렴한 VPS)에 앱을 올려 24시간 구동하는 것을 권장합니다.
        </div>
      </div>

      {/* 7. 클리핑 */}
      <div className={`card manual-section ${highlighted === "clipping" ? "manual-highlight-active" : ""}`} id="clipping">
        <h3>7. 클리핑 모니터링</h3>
        <ol>
          <li>키워드(쉼표 구분)를 확인하거나 수정합니다 — 기본값은 <strong>설정 → 키워드·해시태그 풀 →
            클리핑 키워드</strong>에서 관리합니다.</li>
          <li>"지금 수집 실행"을 누르면 네이버 뉴스·블로그에서 해당 키워드 언급을 수집해 로그에 쌓습니다.
            대시보드의 빠른 실행 "클리핑 실행" 버튼으로도 동일한 수집을 돌릴 수 있습니다.</li>
          <li>ERROR 행이 연속 2건 이상 보이면 화면 상단에 경고가 뜹니다 — 네이버 API 키 만료·한도 초과를
            의심하고 설정 화면에서 키를 다시 확인하세요.</li>
        </ol>
        <h4>매일 자동으로 실행하려면</h4>
        <p>
          클리핑 화면의 <strong>"매일 자동 수집"</strong> 카드에서 토글을 켜고 시각을 지정하면, 앱(서버)이
          켜져 있는 동안 매일 그 시각에 자동으로 수집합니다 — 외부 작업 스케줄러(cron 등)는 필요 없습니다.
          지정 시각에 앱이 꺼져 있었다면 그날 중 다시 켜졌을 때 한 번 따라잡아 수집합니다. 네이버 검색에
          잡히지 않는 언급은 Google Alerts로 보완하는 것을 권장합니다.
        </p>
      </div>

      {/* 8. 월간 리포트 */}
      <div className={`card manual-section ${highlighted === "report" ? "manual-highlight-active" : ""}`} id="report">
        <h3>8. 월간 리포트</h3>
        <ol>
          <li>대상 월(YYYY-MM)을 확인합니다(기본값: 이번 달).</li>
          <li>각 플랫폼(블로그, LinkedIn, 인스타 등)에서 월 1회 다운로드한 인사이트 요약을
            "채널 인사이트 요약" 칸에 붙여넣습니다(선택 사항 — 비워도 생성은 됩니다).</li>
          <li>"월간 리포트 생성"을 누르면 클리핑 로그 + 캘린더 발행 내역 + 채널 지표를 합쳐 표준 양식
            (하이라이트·언론 클리핑·디지털 지표·베스트 콘텐츠·차월 계획)의 리포트를 자동으로 만듭니다.</li>
          <li>데이터에 없는 수치는 임의로 만들지 않고 "집계 예정"으로 표기되니, 필요하면 사람이 마지막에
            한 줄 총평만 추가하면 됩니다.</li>
        </ol>
      </div>

      {/* 9. 설정 */}
      <div className={`card manual-section ${highlighted === "settings" ? "manual-highlight-active" : ""}`} id="settings">
        <h3>9. 설정 — 상주 지침</h3>
        <p>설정 화면은 네 부분으로 나뉩니다.</p>
        <ul>
          <li><strong>일반 설정</strong> — 사이드바·브라우저 탭에 표시되는 <strong>앱 이름</strong>을 자유롭게
            바꿀 수 있고, <strong>테마</strong>를 그린·블루·퍼플·오렌지·틸·로즈·다크 모드 7가지 중 골라 앱 전체
            색상을 바꿀 수 있습니다. 테마는 클릭 즉시 미리보기가 적용되고, "설정 저장"을 눌러야 계속 유지됩니다
            (저장하지 않고 다른 화면으로 이동하면 원래 테마로 되돌아갑니다). <strong>브랜드 로고</strong>를
            업로드하면(파일 선택 즉시 저장, "설정 저장" 불필요) 이후 생성하는 카드뉴스 7장 우측 상단과 블로그
            대표 이미지 우측 하단에 실제 로고 이미지가 자동으로 합성됩니다 — 로고를 올리지 않은 상태라면
            카드뉴스에는 대신 브랜드명 텍스트가 표시됩니다. 투명 배경 PNG를 권장합니다.</li>
          <li><strong>AI 공급자</strong> — 콘텐츠 생성·월간 리포트에 쓸 AI를 Claude·ChatGPT·Gemini 중에서
            고르고, 필요하면 모델명을 직접 입력합니다(비워두면 기본 모델 사용). 여러 개를 연결해두고 상황에 따라
            바꿔가며 쓸 수 있습니다 — 예를 들어 평소엔 Claude를 쓰다가 한도가 찼을 때 잠깐 ChatGPT로 전환하는
            식입니다.</li>
          <li><strong>API 키 관리</strong> — Claude·ChatGPT·Gemini·네이버·Meta 키를 입력/교체/삭제합니다. 값은
            항상 마스킹되어 표시되고, 새 값을 입력해야만 변경됩니다(빈 칸으로 저장해도 기존 값은 지워지지 않습니다).</li>
          <li><strong>상주 지침</strong> — 브랜드 정의, 고정 수식어, 용어집, 톤 가이드, 금칙 표현, 블로그
            키워드 풀, SNS 해시태그 풀, 클리핑 키워드. 이 내용은 매 생성 요청마다 시스템 프롬프트로 자동
            포함되어, 매번 새로 지시하지 않아도 일관된 톤과 표기를 유지해줍니다. 공급자를 바꿔도 이 지침은
            동일하게 적용됩니다.</li>
          <li><strong>백업 · 복원</strong> — 설정·API 키·생성 기록·캘린더·클리핑 로그·리포트·로고를 JSON 파일
            하나로 내보낼 수 있습니다. PC를 바꾸거나 앱을 재설치할 때 "백업에서 복원"으로 그대로 되돌립니다.
            <strong> 백업 파일에는 API 키가 포함되므로</strong> 반드시 안전한 곳에 보관하세요.</li>
        </ul>
        <div className="manual-note">
          디스크 관리: 생성된 이미지·영상·내레이션 파일은 <strong>30일이 지나면 자동으로 정리</strong>됩니다.
          계속 보관할 결과물은 생성 직후 다운로드해 별도 폴더에 저장해두세요 (설정·생성 기록 텍스트는
          삭제되지 않습니다).
        </div>
        <p className="hint">
          검수 중 같은 유형의 수정이 반복된다면, 콘텐츠를 직접 고치기보다 이곳의 톤 가이드·금칙 표현에
          규칙을 추가하는 것이 근본적인 해결책입니다.
        </p>
      </div>

      {/* 10. 주간 운영 루틴 */}
      <div className={`card manual-section ${highlighted === "routine" ? "manual-highlight-active" : ""}`} id="routine">
        <h3>10. 주간 운영 루틴 (권장)</h3>
        <table>
          <thead><tr><th>시점</th><th>업무</th><th>소요</th></tr></thead>
          <tbody>
            <tr><td>월 오전</td><td>지난주 생성분 검수 → GREEN/YELLOW 처리 → 전 채널 예약 등록</td><td>50분</td></tr>
            <tr><td>수 오후</td><td>차주 소재 선정 → 마스터 프롬프트 실행</td><td>30분</td></tr>
            <tr><td>금 오후</td><td>클리핑 ERROR 확인, 발행 URL 누락분 보완</td><td>15분</td></tr>
            <tr><td>매일</td><td>발행 누락 여부만 대시보드에서 확인</td><td>5분</td></tr>
            <tr><td>월 1회</td><td>월간 리포트 생성 + 총평 작성 + 키워드 풀 갱신</td><td>40분</td></tr>
          </tbody>
        </table>
        <p className="hint">합계 주당 약 2시간 + 월 40분 — 나머지는 전부 자동입니다.</p>
      </div>

      {/* 11. 트러블슈팅 */}
      <div className={`card manual-section ${highlighted === "troubleshoot" ? "manual-highlight-active" : ""}`} id="troubleshoot">
        <h3>11. 트러블슈팅</h3>
        <table>
          <thead><tr><th>증상</th><th>원인</th><th>조치</th></tr></thead>
          <tbody>
            <tr>
              <td>콘텐츠 생성 시 "[Claude(Anthropic)] ANTHROPIC_API_KEY가 설정되지 않았습니다" 등</td>
              <td>설정 → AI 공급자에서 고른 공급자의 API 키 미입력/오타/만료</td>
              <td>설정 → API 키 관리에서 <strong>현재 선택된 공급자</strong>의 키를 다시 발급해 입력
                (다른 공급자로 잠시 바꿔 써도 됩니다)</td>
            </tr>
            <tr>
              <td>클리핑 실행 시 "NAVER_ID / NAVER_SECRET이 설정되지 않았습니다"</td>
              <td>네이버 키 미입력</td>
              <td>설정 화면에서 네이버 Client ID/Secret 입력</td>
            </tr>
            <tr>
              <td>클리핑 로그에 ERROR가 연속 기록</td>
              <td>네이버 API 키 만료·한도 초과·네트워크 문제</td>
              <td>developers.naver.com에서 키 상태 확인 후 재발급</td>
            </tr>
            <tr>
              <td>SNS 자동 발행이 "META_..이 설정되지 않았습니다" 오류</td>
              <td>Meta 키 미입력</td>
              <td>설정 화면에서 3개 Meta 값 모두 입력했는지 확인</td>
            </tr>
            <tr>
              <td>SNS 자동 발행이 "Meta Graph API 오류: ..." 로 실패</td>
              <td>토큰 만료, 권한 부족, 이미지 URL이 비공개/접근 불가</td>
              <td>토큰 재발급(장기 토큰으로 재교환), 권한 재확인, 이미지 URL을 브라우저 시크릿창에서
                직접 열어 공개 접근 가능한지 확인</td>
            </tr>
            <tr>
              <td>예약된 SNS 게시물이 예정 시각이 지나도 발행 안 됨</td>
              <td>서버(앱)가 꺼져 있었음</td>
              <td>서버를 켜두거나, 캘린더에서 "지금 발행"으로 수동 발행. 서버 재시작 시 밀린 예약 건은
                다음 1분 주기 확인에서 자동 처리됩니다.</td>
            </tr>
            <tr>
              <td>블로그 검색 노출 급감</td>
              <td>기사 원문 복붙(중복 문서 판정), 발행 주기 불규칙</td>
              <td>재구성 원고만 사용, 2주간 정보성 글만 발행하며 회복 관찰</td>
            </tr>
            <tr>
              <td>AI 산출물 톤이 이상함(과장·장황)</td>
              <td>상주 지침(톤 가이드)이 부실하거나 원본이 부실</td>
              <td>설정 화면 톤 가이드·금칙 표현 보강, 같은 문제 2회 반복 시 반드시 규칙 추가</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 12. 보안 */}
      <div className={`card manual-section ${highlighted === "security" ? "manual-highlight-active" : ""}`} id="security">
        <h3>12. 보안 유의사항</h3>
        <ul>
          <li>API 키는 설정 화면 또는 <code className="kbd">.env</code> 파일에만 보관하세요. 캘린더 메모나
            프롬프트, 채팅 등에 절대 붙여넣지 마세요.</li>
          <li>설정 화면에 입력한 키는 서버의 <code className="kbd">server/data/secrets.json</code>에 저장됩니다
            (이 파일은 <code className="kbd">.gitignore</code>에 포함되어 커밋되지 않습니다). 여러 사람이
            서버 파일에 접근할 수 있는 환경이라면 서버 접근 권한 관리에 유의하세요.</li>
          <li>Meta 페이지 액세스 토큰은 페이지 게시 권한을 가진 강력한 자격 증명입니다. 필요 이상으로
            공유하지 말고, 담당자 교체 시 즉시 재발급하세요.</li>
          <li>앱을 외부에 공개된 서버에 배포할 경우, API 라우트(특히 설정·발행 관련)에 별도의 로그인/접근
            제어를 추가하는 것을 권장합니다(현재 버전은 사내 단독 사용을 전제로 합니다).</li>
        </ul>
      </div>
    </div>
  );
}
