# 멀티채널 AI 마케팅 스튜디오

React + Vite 프론트엔드와 Cloudflare Pages Functions 백엔드를 사용하는 마케팅 자동화 MVP입니다.  
사용자가 타겟 고객, 메인 키워드, 상품/서비스명, CTA 링크를 입력하면 Gemini `gemini-2.5-flash`를 통해 아래 채널용 문안을 한 번에 생성합니다.

- 네이버/티스토리 블로그 본문
- 인스타그램 피드 캡션 + 해시태그
- 스레드 메인 포스트 + 후속 리플
- 유튜브 제목 + 설명 + 태그 + 썸네일 문구
- 쇼츠/릴스 훅 + 대본 + 장면 구성

제휴 링크 기본값:
`https://2026-nexo-polic-y-fund.netlify.app/?partner_code=johanju`

## API

- `/api/generate`
  - 기존 블로그 생성 엔드포인트
- `/api/generate-campaign`
  - 멀티채널 캠페인 생성 엔드포인트
- `/api/integration-status`
  - Gemini / Threads / Instagram / YouTube 연동 준비 상태 확인
- `/api/discover-offers`
  - 쿠팡/텐핑 오퍼 검색 및 공통 포맷 정규화
- `/api/generate-offer-campaign`
  - 선택한 오퍼를 기반으로 멀티채널 캠페인 생성
- `/api/publish-threads`
  - Threads 텍스트 발행 엔드포인트
- `/api/publish-instagram`
  - Instagram 이미지/릴스 게시 엔드포인트
- `/api/generate-video-package`
  - 쇼츠 대본을 SRT / 장면 프롬프트 / ffmpeg 명령 예시로 변환
- `/api/youtube-status`
  - refresh token 유효성 및 채널 조회 가능 여부 확인
- `/api/upload-youtube`
  - 공개 video URL 기반 YouTube 업로드 엔드포인트

## 프로젝트 구조

```text
.
├── functions
│   ├── _lib
│   │   └── gemini.js
│   └── api
│       ├── generate-campaign.js
│       └── generate.js
├── src
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── index.html
├── package.json
├── vite.config.js
└── wrangler.toml
```

## 로컬 실행

1. 의존성 설치

```bash
npm install
```

2. 환경 변수 준비

```bash
cp .dev.vars.example .dev.vars
```

3. `.dev.vars` 또는 `.env`에 실제 환경 변수 입력

```bash
GEMINI_API_KEY=your_gemini_api_key
THREADS_ACCESS_TOKEN=your_threads_access_token
THREADS_USER_ID=your_threads_user_id
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_USER_ID=your_instagram_user_id
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REFRESH_TOKEN=your_youtube_refresh_token
COUPANG_ACCESS_KEY=your_coupang_access_key
COUPANG_SECRET_KEY=your_coupang_secret_key
COUPANG_PARTNER_ID=your_coupang_partner_id
TENPING_MEMBER_ID=your_tenping_member_id
```

4. 프론트엔드 빌드

```bash
npm run build
```

5. Pages Functions 포함 로컬 실행

```bash
npm run pages:dev
```

브라우저에서 `http://127.0.0.1:8788`로 접속하면 됩니다.  
포트가 이미 사용 중이면 `./node_modules/.bin/wrangler pages dev dist --port 8791`처럼 다른 포트로 실행하면 됩니다.

## 현재 구현 범위

- Gemini 기반 멀티채널 카피 생성
- 쿠팡/텐핑 오퍼 검색 어댑터
- 오퍼 메타데이터 기반 멀티채널 캠페인 생성
- Threads / Instagram 발행 준비 상태 확인
- Threads 텍스트 발행 스캐폴드
- Instagram 이미지/릴스 게시 스캐폴드
- YouTube refresh token 확인 및 URL 기반 업로드 스캐폴드
- 블로그용 태그 포맷 자동 정규화
  - 네이버: `#태그 #태그`
  - 티스토리: `태그, 태그, 태그`
- 쇼츠/릴스용 대본 및 장면 구성 자동 생성
- 쇼츠용 SRT / 장면 프롬프트 / ffmpeg 명령 예시 생성
- 채널별 결과 편집 및 복사 UI

## 다음 단계

- YouTube OAuth 업로드 연결
- TTS 생성 연동
- ffmpeg 렌더 스크립트 자동 실행
- 게시 예약 / 큐 관리
- Notion 검수 큐

## 오퍼 연동 예시

쿠팡/텐핑 오퍼 후보를 먼저 찾고, 선택한 오퍼를 다시 캠페인 생성으로 넘기는 식으로 사용할 수 있습니다.

1. 오퍼 후보 조회

```bash
curl -X POST http://127.0.0.1:8788/api/discover-offers \
  -H "content-type: application/json" \
  -d '{
    "provider": "all",
    "keyword": "학원 운영비 절감",
    "categoryName": "교육",
    "limit": 6
  }'
```

2. 선택한 오퍼로 캠페인 생성

```bash
curl -X POST http://127.0.0.1:8788/api/generate-offer-campaign \
  -H "content-type: application/json" \
  -d '{
    "audience": "학원장",
    "keyword": "학원 운영비 절감",
    "tone": "정보형이지만 신뢰감 있는 톤",
    "objective": "링크 클릭과 상담 전환",
    "offer": {
      "provider": "coupang",
      "title": "예시 오퍼 제목",
      "summary": "예시 오퍼 요약",
      "category": "교육",
      "link": "https://example.com/affiliate-link"
    }
  }'
```

## YouTube 참고

- `youtube-status`에서 채널명이 안 보이고 scope 경고만 나온다면 refresh token은 유효하지만 `youtube.readonly` 또는 `youtube` scope 없이 `youtube.upload`만 받은 상태일 수 있습니다.
- 업로드 자체는 `youtube.upload` scope만으로도 가능할 수 있지만, 채널 조회까지 하려면 다시 동의를 받아 refresh token을 재발급하는 편이 안전합니다.
