# greenflow 콘텐츠 자동화

`greenflow_content_automation_manual` (TEN AI × greenflow 운영 매뉴얼 v1.0)을 그대로 구현한 콘텐츠 자동화 웹앱입니다.
기사·보도자료 1건을 넣으면 마스터 프롬프트가 **네이버 블로그 · LinkedIn · 쇼츠 스크립트 · 카드뉴스** 4종 콘텐츠를 동시에 생성하고,
사람 검수 게이트 → 콘텐츠 캘린더 → 클리핑 모니터링 → 월간 리포트까지 매뉴얼의 전체 파이프라인을 하나의 앱으로 운영합니다.

## 기능 (매뉴얼 장 대응)

| 매뉴얼 장 | 앱 화면 |
|---|---|
| 01 자동화 기획서 / 11 주간 SOP | 대시보드 — 이번 주 발행 현황, 주간 운영 루틴 |
| 02 도구 스택 & 계정 준비 | 설정 — AI 공급자/API 키 연결 상태 |
| 03·04 생성 자동화 · 채널별 템플릿 | 콘텐츠 생성 · 검수 — 마스터 프롬프트 실행 (**Claude·ChatGPT·Gemini 중 선택**) |
| 05 사람 검수 게이트 | 콘텐츠 생성 · 검수 — 10분 체크리스트, GREEN/YELLOW/RED 등급 |
| 06·07 배포 매뉴얼 / 08 예약 발행 | 콘텐츠 캘린더 — 발행 대장 단일 관리 + **페이스북·인스타그램(카드뉴스/릴스) 실제 자동 발행(Meta Graph API)** |
| 09 클리핑·모니터링 자동화 | 클리핑 모니터링 — 네이버 검색 API 실행 |
| 10 월간 리포트 자동화 | 월간 리포트 — Claude 기반 리포트 생성 |

## 아키텍처

- **프런트엔드**: React + Vite
- **백엔드**: Express (`/api/*`) — AI API 키는 서버에서만 사용되며 브라우저에 노출되지 않습니다.
- **LLM**: Claude(Anthropic) · ChatGPT(OpenAI) · Gemini(Google) 중 설정 화면에서 선택 — 모두 구조화 출력(JSON
  스키마)으로 4채널 콘텐츠를 생성합니다. 기본 모델: `claude-opus-4-8` / `gpt-5.5` / `gemini-3.5-flash`
  (설정 화면에서 모델명을 직접 바꿀 수 있습니다).
- **SNS 자동 발행**: Meta Graph API (Facebook Page API / Instagram Graph API) — 서버가 1분마다 캘린더를 확인해
  "예약됨" 상태이고 예정 시각이 지난 페이스북·카드뉴스(인스타 피드)·릴스 게시물을 자동으로 발행합니다.
- **저장소**: 별도 DB 없이 `server/data/*.json` 파일 기반 저장(도구 최소주의 원칙에 맞춤)

## 사전 준비

- Node.js 18 이상
- AI 공급자 API 키 — 아래 중 **하나 이상**:
  - Claude ([console.anthropic.com](https://console.anthropic.com))
  - ChatGPT ([platform.openai.com](https://platform.openai.com))
  - Gemini ([aistudio.google.com/apikey](https://aistudio.google.com/apikey), 무료 등급 제공)
- (선택) 네이버 검색 API Client ID/Secret ([developers.naver.com](https://developers.naver.com) → 애플리케이션 등록 → 검색)
- (선택, SNS 자동 발행용) Meta 개발자 계정 — 아래 "SNS 자동 발행 설정" 참고

각 키를 발급받는 상세한 단계별 방법은 앱 안의 **"사용자 매뉴얼" → "2. 최초 설정"** 탭에 그대로 정리되어 있습니다.

## 설치 및 실행

```bash
npm install
npm run dev
```

`npm run dev`는 프런트엔드(Vite, http://localhost:5180)와 백엔드 API(Express, http://localhost:8790)를 동시에 실행합니다.
브라우저에서 http://localhost:5180 접속.

### API 키 입력

**앱을 실행한 뒤 "설정" 화면 → "API 키 관리"에서 바로 입력할 수 있습니다.** `.env` 파일을 편집하고 서버를 재시작할 필요가
없습니다 — 값을 붙여넣고 저장하면 즉시 반영되며, 화면에는 항상 마스킹되어 표시됩니다.

`.env` 파일(`cp .env.example .env`)에 값을 넣어두는 방식도 계속 지원됩니다 — 설정 화면에서 별도로 입력하지 않은 키는
`.env` 값을 그대로 사용합니다. 여러 환경(개발/운영)에서 동일한 키를 반복 배포하고 싶다면 `.env` 방식이, 사내 담당자가
직접 키를 관리·교체하는 경우라면 설정 화면 방식이 더 편리합니다.

### 프로덕션 빌드

```bash
npm run build     # dist/ 에 정적 파일 생성
npm run start      # API 서버만 실행 (정적 파일은 별도 호스팅 또는 리버스 프록시로 서빙)
```

## 폴더 구조

```
index.html
src/
  App.jsx                 # 탭 내비게이션
  components/
    Dashboard.jsx          # 대시보드 (KPI + 주간 SOP)
    Generate.jsx            # 콘텐츠 생성 (마스터 프롬프트)
    ReviewChecklist.jsx     # 사람 검수 게이트 체크리스트
    Calendar.jsx             # 콘텐츠 캘린더 (발행 대장)
    Clipping.jsx             # 클리핑·모니터링
    Report.jsx                # 월간 리포트
    Settings.jsx               # API 키 관리 + 상주 지침(브랜드/용어집/톤/키워드)
    ApiKeyField.jsx             # API 키 입력/마스킹 표시 컴포넌트
    Manual.jsx                   # 앱 내 사용자 매뉴얼
server/
  index.js                # Express API
  lib/
    prompts.js              # 마스터 프롬프트 · 리포트 프롬프트 · 상주 지침 빌더
    aiProvider.js            # AI 공급자 디스패처 — 설정의 aiProvider에 따라 아래 셋 중 하나로 위임
    claude.js                 # Anthropic SDK 래퍼 (구조화 출력)
    openai.js                 # OpenAI SDK 래퍼 (구조화 출력)
    gemini.js                 # Gemini(@google/genai) SDK 래퍼 (구조화 출력)
    naver.js                 # 네이버 검색 API 클리핑 로직
    meta.js                  # Meta Graph API — 페이스북/인스타그램 발행
    scheduler.js             # 예약된 SNS 게시물 자동 발행 스케줄러(1분 주기)
    secrets.js                # API 키 저장소(server/data/secrets.json, .env보다 우선)
    store.js                 # JSON 파일 저장소
```

## SNS 자동 발행 설정 (페이스북 · 인스타그램)

기존에 "Meta Business Suite에서 사람이 예약 게시 버튼을 누르던" 단계를 Graph API 호출로 대체해 완전 자동화했습니다.

1. [developers.facebook.com](https://developers.facebook.com) → 앱 생성 (유형: 비즈니스)
2. 앱에 **페이스북 페이지**와, 그 페이지에 연결된 **인스타그램 비즈니스/크리에이터 계정**을 연결
3. Graph API 탐색기 또는 시스템 사용자 토큰으로 다음 권한을 가진 **장기 페이지 액세스 토큰**을 발급:
   `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management`
4. **설정 → API 키 관리**에서 다음 3가지를 입력하고 저장(또는 `.env`에 `META_PAGE_ID` / `META_IG_USER_ID` /
   `META_PAGE_ACCESS_TOKEN`으로 입력해도 됩니다):
   - Meta 페이지 ID — 발행할 페이스북 페이지 ID
   - Meta 인스타그램 비즈니스 계정 ID — 페이지에 연결된 인스타그램 비즈니스 계정 ID
   - Meta 페이지 액세스 토큰 — 위에서 발급한 장기 페이지 액세스 토큰
5. 저장 즉시(재시작 불필요) 설정 화면 하단 "연결 요약"에서 "페이스북/인스타그램: 연결됨" 확인

### 사용 방법

- **콘텐츠 생성** 화면에서 카드뉴스는 "캘린더에 추가 (인스타 자동발행)", LinkedIn 카드 옆에는 "페이스북에 추가 (자동발행)" 버튼을 누르면
  캘린더에 채널·캡션이 채워진 상태로 등록됩니다.
- **콘텐츠 캘린더**에서 해당 행의 "SNS 설정"을 눌러 이미지 URL(카드뉴스/페이스북) 또는 영상 URL(릴스)을 입력합니다.
  - 이미지·영상은 **공개적으로 접근 가능한 URL**이어야 합니다(Meta 서버가 직접 가져갑니다) — Canva 다운로드 링크를 이미지 호스팅에
    올리거나, 자체 웹 호스팅/이미지 CDN 링크를 사용하세요. `localhost` 주소는 Meta가 접근할 수 없어 동작하지 않습니다.
  - 상태를 **"예약됨"**으로 바꾸면 예정 일시가 지나는 순간 서버가 자동으로 발행하고, 상태를 "발행"으로 바꾸며 실제 게시물 URL을
    발행 URL 칸에 채웁니다.
  - 지금 바로 올리고 싶다면 "지금 발행" 버튼으로 예정 시각과 무관하게 즉시 게시할 수 있습니다.
- 릴스(영상)는 Instagram이 영상을 처리(FINISHED)할 때까지 최대 2분간 자동으로 기다렸다가 발행합니다. 처리에 더 오래 걸리면
  다음 스케줄러 실행(1분 뒤)에서 자동으로 재시도합니다.
- 서버가 켜져 있는 동안에만 자동 발행이 동작합니다(로컬 PC에서 상시 운영하거나, 실제 배포 시 클라우드 서버에 올려두세요).

## AI 공급자 선택 (Claude · ChatGPT · Gemini)

**설정 → AI 공급자**에서 콘텐츠 생성·월간 리포트에 사용할 AI를 고를 수 있습니다.

1. 사용하려는 공급자의 API 키를 **설정 → API 키 관리**에 입력합니다(하나만 있어도 됩니다).
2. **설정 → AI 공급자**에서 해당 공급자를 클릭해 선택합니다.
3. 필요하면 모델명을 직접 입력합니다(비워두면 기본 모델 사용):

   | 공급자 | 기본 모델 |
   |---|---|
   | Claude (Anthropic) | `claude-opus-4-8` |
   | ChatGPT (OpenAI) | `gpt-5.5` |
   | Gemini (Google) | `gemini-3.5-flash` |

4. "설정 저장"을 누르면 이후 모든 생성 요청이 선택한 공급자로 실행됩니다.

브랜드 정의·용어집·톤 가이드 등 "상주 지침"은 공급자와 무관하게 동일하게 적용되므로, 공급자를 바꿔도 결과의
일관성은 유지됩니다. 세 공급자 모두 구조화 출력(JSON 스키마)을 지원하는 모델을 사용해 4채널 콘텐츠를 안정적인
형식으로 생성합니다.

## 화면 커스터마이징 (앱 이름 · 테마)

**설정 → 일반 설정**에서:
- **앱 이름** — 사이드바 상단과 브라우저 탭 제목에 표시되는 이름을 자유롭게 바꿀 수 있습니다.
- **테마** — 그린(기본) · 블루 · 퍼플 · 오렌지 · 틸 · 로즈 · 다크 모드 7가지 색상 테마 중 선택할 수 있습니다.
  클릭하면 바로 미리보기가 적용되고, "설정 저장"을 눌러야 계속 유지됩니다(저장하지 않고 다른 화면으로 이동하면
  원래 테마로 되돌아갑니다).

## 운영 팁

- **설정 → 상주 지침**을 한 번만 다듬어두면 이후 매 생성 요청에 자동 반영됩니다(매뉴얼의 "Claude 프로젝트 지침" 개념).
- 생성된 콘텐츠는 반드시 **검수 체크리스트**를 통과(GREEN/YELLOW)한 뒤 캘린더에 등록하세요. RED 등급은 발행하지 않습니다.
- 클리핑 자동 실행은 Windows 작업 스케줄러 등으로 `POST /api/clipping/run`을 매일 09:00에 호출하도록 등록하면 완전 자동화됩니다.
- API 키·비밀번호는 `.env`에만 보관하고 절대 프런트엔드 코드나 프롬프트에 넣지 마세요(`.env`는 `.gitignore`에 포함됨).
