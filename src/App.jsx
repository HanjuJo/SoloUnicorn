import { useEffect, useMemo, useState } from "react";

const PARTNER_LINK =
  "https://2026-nexo-polic-y-fund.netlify.app/?partner_code=johanju";

const CHANNELS = [
  {
    id: "blog",
    label: "Blog",
    title: "네이버/티스토리 블로그",
    description: "정보성 본문, 네이버 해시태그, 티스토리 콤마 태그를 함께 관리합니다.",
  },
  {
    id: "instagram",
    label: "Instagram",
    title: "인스타 피드 캡션",
    description: "캡션, 해시태그, 이미지 오버레이 문구를 한 번에 만듭니다.",
  },
  {
    id: "threads",
    label: "Threads",
    title: "스레드 홍보 포스트",
    description: "메인 포스트와 후속 리플 아이디어까지 같이 생성합니다.",
  },
  {
    id: "youtube",
    label: "YouTube",
    title: "유튜브 롱폼 패키지",
    description: "제목, 설명, 태그, 썸네일 문구를 구성합니다.",
  },
  {
    id: "shorts",
    label: "Shorts",
    title: "쇼츠/릴스 대본",
    description: "훅, 짧은 대본, 장면 구성까지 자동으로 만듭니다.",
  },
];

const INITIAL_FORM = {
  audience: "",
  keyword: "",
  productName: "전자칠판 자동 홍보 시스템",
  offerLink: PARTNER_LINK,
  tone: "전문적이지만 친근한 톤",
  objective: "문의 전환",
  instagramMediaUrl: "",
  instagramMediaType: "IMAGE",
  youtubeVideoUrl: "",
  youtubePrivacyStatus: "private",
};

function createInitialCampaign() {
  return {
    campaignAngle:
      "상품/서비스와 핵심 키워드를 입력하면 블로그, 인스타, 스레드, 유튜브, 쇼츠 패키지가 생성됩니다.",
    blog: {
      title: "블로그 제목이 여기에 표시됩니다.",
      body: "블로그 본문이 여기에 생성됩니다.",
      naverTags: ["#네이버태그", "#블로그마케팅"],
      tistoryTags: ["티스토리태그", "콘텐츠자동화"],
      fullText: `블로그 제목이 여기에 표시됩니다.

블로그 본문이 여기에 생성됩니다.

네이버 태그: #네이버태그 #블로그마케팅
티스토리 태그: 티스토리태그, 콘텐츠자동화`,
    },
    instagram: {
      caption: "인스타그램 피드용 캡션이 여기에 생성됩니다.",
      hashtags: ["#인스타마케팅", "#브랜드홍보"],
      imageOverlay: "이미지 오버레이 문구",
      fullText: `인스타그램 피드용 캡션이 여기에 생성됩니다.

#인스타마케팅 #브랜드홍보`,
    },
    threads: {
      post: "스레드용 짧은 문제 제기형 포스트가 여기에 생성됩니다.",
      followUpReplies: ["후속 리플 1", "후속 리플 2", "후속 리플 3"],
      fullText: `스레드용 짧은 문제 제기형 포스트가 여기에 생성됩니다.

후속 리플 아이디어
1. 후속 리플 1
2. 후속 리플 2
3. 후속 리플 3`,
    },
    youtube: {
      title: "유튜브 제목이 여기에 생성됩니다.",
      description: "유튜브 설명문이 여기에 생성됩니다.",
      tags: ["유튜브태그", "영상마케팅"],
      thumbnailCopy: "썸네일 문구",
      fullText: `제목: 유튜브 제목이 여기에 생성됩니다.

설명:
유튜브 설명문이 여기에 생성됩니다.

태그: 유튜브태그, 영상마케팅

썸네일 문구:
썸네일 문구`,
    },
    shorts: {
      title: "쇼츠 제목이 여기에 생성됩니다.",
      hook: "첫 3초를 잡는 훅 문구",
      caption: "쇼츠 캡션이 여기에 생성됩니다.",
      script: "쇼츠/릴스용 짧은 대본이 여기에 생성됩니다.",
      scenes: [
        {
          time: "00:00-00:05",
          visual: "장면 예시",
          narration: "내레이션 예시",
          caption: "자막 예시",
        },
      ],
      fullText: `제목: 쇼츠 제목이 여기에 생성됩니다.
훅: 첫 3초를 잡는 훅 문구

캡션:
쇼츠 캡션이 여기에 생성됩니다.

대본:
쇼츠/릴스용 짧은 대본이 여기에 생성됩니다.`,
    },
  };
}

const EMPTY_INTEGRATIONS = {
  gemini: { ready: false, label: "Gemini", detail: "확인 중" },
  threads: { ready: false, label: "Threads", detail: "확인 중" },
  instagram: { ready: false, label: "Instagram", detail: "확인 중" },
  youtube: { ready: false, label: "YouTube", detail: "확인 중" },
};

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [campaign, setCampaign] = useState(createInitialCampaign);
  const [integrations, setIntegrations] = useState(EMPTY_INTEGRATIONS);
  const [activeChannel, setActiveChannel] = useState("blog");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const [operationState, setOperationState] = useState({
    status: "idle",
    title: "",
    message: "",
  });
  const [videoPackage, setVideoPackage] = useState(null);
  const [youtubeChannel, setYouTubeChannel] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPackagingVideo, setIsPackagingVideo] = useState(false);

  const activeOutput = campaign[activeChannel];
  const activeChannelMeta = CHANNELS.find((channel) => channel.id === activeChannel);

  const isReadyToSubmit = useMemo(
    () =>
      form.audience.trim().length > 1 &&
      form.keyword.trim().length > 1 &&
      form.productName.trim().length > 1,
    [form],
  );

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  async function loadIntegrationStatus() {
    try {
      const response = await fetch("/api/integration-status");
      const data = await response.json();

      if (response.ok && data?.integrations) {
        setIntegrations(data.integrations);
      }
    } catch {
      setIntegrations(EMPTY_INTEGRATIONS);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();

    if (!isReadyToSubmit) {
      setError("타겟 고객, 메인 키워드, 상품/서비스명을 모두 입력해 주세요.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setCopyState("idle");
    setOperationState({ status: "idle", title: "", message: "" });

    try {
      const response = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience: form.audience.trim(),
          keyword: form.keyword.trim(),
          productName: form.productName.trim(),
          offerLink: form.offerLink.trim(),
          tone: form.tone.trim(),
          objective: form.objective.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "캠페인 생성 중 오류가 발생했습니다.");
      }

      setCampaign(data.campaign);
      setActiveChannel("blog");
      setVideoPackage(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!activeOutput?.fullText?.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeOutput.fullText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  async function handlePublishThreads() {
    setIsPublishing(true);
    setOperationState({
      status: "working",
      title: "Threads 게시",
      message: "Threads 포스트를 발행 중입니다.",
    });

    try {
      const response = await fetch("/api/publish-threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: campaign.threads.post,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Threads 게시에 실패했습니다.");
      }

      setOperationState({
        status: "success",
        title: "Threads 게시 완료",
        message: `publish id: ${data?.result?.publishId || "확인 필요"}`,
      });
    } catch (publishError) {
      setOperationState({
        status: "error",
        title: "Threads 게시 실패",
        message:
          publishError instanceof Error
            ? publishError.message
            : "Threads 게시 중 오류가 발생했습니다.",
      });
    } finally {
      setIsPublishing(false);
      loadIntegrationStatus();
    }
  }

  async function handlePublishInstagram() {
    setIsPublishing(true);
    setOperationState({
      status: "working",
      title: "Instagram 게시",
      message: "Instagram media container를 생성하고 있습니다.",
    });

    try {
      const response = await fetch("/api/publish-instagram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaUrl: form.instagramMediaUrl.trim(),
          caption: campaign.instagram.caption,
          mediaType: form.instagramMediaType,
          shareToFeed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Instagram 게시에 실패했습니다.");
      }

      setOperationState({
        status: "success",
        title: "Instagram 게시 완료",
        message: `publish id: ${data?.result?.publishId || "확인 필요"}`,
      });
    } catch (publishError) {
      setOperationState({
        status: "error",
        title: "Instagram 게시 실패",
        message:
          publishError instanceof Error
            ? publishError.message
            : "Instagram 게시 중 오류가 발생했습니다.",
      });
    } finally {
      setIsPublishing(false);
      loadIntegrationStatus();
    }
  }

  async function handleGenerateVideoPackage() {
    setIsPackagingVideo(true);
    setOperationState({
      status: "working",
      title: "영상 제작 패키지 생성",
      message: "쇼츠 대본을 기준으로 자막과 렌더 가이드를 만들고 있습니다.",
    });

    try {
      const response = await fetch("/api/generate-video-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience: form.audience.trim(),
          keyword: form.keyword.trim(),
          productName: form.productName.trim(),
          shorts: campaign.shorts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "영상 제작 패키지 생성에 실패했습니다.");
      }

      setVideoPackage(data.videoPackage);
      setOperationState({
        status: "success",
        title: "영상 제작 패키지 생성 완료",
        message: `${data.videoPackage.fileBase}.srt / ffmpeg 명령 예시를 준비했습니다.`,
      });
    } catch (videoError) {
      setOperationState({
        status: "error",
        title: "영상 제작 패키지 생성 실패",
        message:
          videoError instanceof Error
            ? videoError.message
            : "영상 제작 패키지 생성 중 오류가 발생했습니다.",
      });
    } finally {
      setIsPackagingVideo(false);
    }
  }

  async function handleCheckYouTubeChannel() {
    setIsPublishing(true);
    setOperationState({
      status: "working",
      title: "YouTube 채널 확인",
      message: "refresh token으로 채널 정보를 조회 중입니다.",
    });

    try {
      const response = await fetch("/api/youtube-status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "YouTube 채널 확인에 실패했습니다.");
      }

      if (data.channel) {
        setYouTubeChannel(data.channel);
        setOperationState({
          status: "success",
          title: "YouTube 채널 확인 완료",
          message: `${data.channel.title} (${data.channel.id})`,
        });
      } else {
        setOperationState({
          status: "success",
          title: "YouTube 토큰 확인 완료",
          message:
            data.warning ||
            "refresh token은 유효하지만 채널 조회 scope는 포함되지 않았습니다.",
        });
      }
    } catch (youtubeError) {
      setOperationState({
        status: "error",
        title: "YouTube 채널 확인 실패",
        message:
          youtubeError instanceof Error
            ? youtubeError.message
            : "YouTube 채널 확인 중 오류가 발생했습니다.",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleUploadYouTube() {
    setIsPublishing(true);
    setOperationState({
      status: "working",
      title: "YouTube 업로드",
      message: "공개 video URL을 내려받아 YouTube 업로드를 시작합니다.",
    });

    try {
      const response = await fetch("/api/upload-youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl: form.youtubeVideoUrl.trim(),
          title: campaign.youtube.title,
          description: campaign.youtube.description,
          tags: campaign.youtube.tags,
          privacyStatus: form.youtubePrivacyStatus,
          categoryId: "22",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "YouTube 업로드에 실패했습니다.");
      }

      setOperationState({
        status: "success",
        title: "YouTube 업로드 완료",
        message: data?.result?.url || `video id: ${data?.result?.videoId || "확인 필요"}`,
      });
    } catch (youtubeError) {
      setOperationState({
        status: "error",
        title: "YouTube 업로드 실패",
        message:
          youtubeError instanceof Error
            ? youtubeError.message
            : "YouTube 업로드 중 오류가 발생했습니다.",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateFullText(event) {
    const { value } = event.target;

    setCampaign((current) => ({
      ...current,
      [activeChannel]: {
        ...current[activeChannel],
        fullText: value,
      },
    }));
  }

  return (
    <div className="page-shell">
      <div className="layout">
        <section className="hero-card">
          <div className="hero-grid">
            <div>
              <p className="hero-topline">SoloUnicorn Campaign System</p>
              <h1 className="hero-title">멀티채널 AI 마케팅 스튜디오</h1>
              <p className="hero-copy">
                하나의 입력으로 블로그 본문, 인스타 캡션, 스레드 홍보문, 유튜브
                설명, 쇼츠 대본까지 묶어 생성합니다. 이제 Threads/Instagram
                발행 스캐폴드와 영상 제작 패키지도 같은 화면에서 다룹니다.
              </p>
            </div>

            <div className="hero-notes">
              <article className="note-card">
                <strong>콘텐츠 생성</strong>
                <p>Gemini로 채널별 카피를 구조화된 JSON으로 생성합니다.</p>
              </article>
              <article className="note-card">
                <strong>발행 연동</strong>
                <p>Threads 텍스트 발행과 Instagram 이미지/릴스 게시 흐름을 붙였습니다.</p>
              </article>
              <article className="note-card">
                <strong>영상 패키지</strong>
                <p>쇼츠 대본에서 SRT와 ffmpeg 명령 예시를 바로 만듭니다.</p>
              </article>
            </div>
          </div>
        </section>

        <div className="content-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Input</p>
                <h2 className="panel-title">캠페인 브리프 입력</h2>
                <p className="panel-copy">
                  고객, 키워드, 상품, CTA 링크를 넣으면 채널별 복사본과 후속 운영
                  자산이 한 번에 생성됩니다.
                </p>
              </div>
              <span className="status-pill">
                {isGenerating ? "생성 중" : "준비 완료"}
              </span>
            </div>

            <form className="form-grid" onSubmit={handleGenerate}>
              <div className="input-grid">
                <label className="field">
                  <span className="field-label">타겟 고객</span>
                  <span className="field-hint">예: 학원장, 총무팀, 스타트업 대표</span>
                  <input
                    className="input"
                    name="audience"
                    type="text"
                    placeholder="타겟 고객"
                    value={form.audience}
                    onChange={handleChange}
                  />
                </label>

                <label className="field">
                  <span className="field-label">메인 키워드</span>
                  <span className="field-hint">예: 전자칠판 수업 효율화</span>
                  <input
                    className="input"
                    name="keyword"
                    type="text"
                    placeholder="메인 키워드"
                    value={form.keyword}
                    onChange={handleChange}
                  />
                </label>

                <label className="field">
                  <span className="field-label">상품/서비스명</span>
                  <span className="field-hint">예: 전자칠판 자동 홍보 시스템</span>
                  <input
                    className="input"
                    name="productName"
                    type="text"
                    placeholder="상품/서비스명"
                    value={form.productName}
                    onChange={handleChange}
                  />
                </label>

                <label className="field">
                  <span className="field-label">캠페인 목표</span>
                  <span className="field-hint">예: 문의 전환, 데모 신청, 상담 유도</span>
                  <input
                    className="input"
                    name="objective"
                    type="text"
                    placeholder="캠페인 목표"
                    value={form.objective}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <label className="field">
                <span className="field-label">CTA 링크</span>
                <span className="field-hint">모든 채널 문구 마지막에 자연스럽게 포함됩니다.</span>
                <input
                  className="input"
                  name="offerLink"
                  type="text"
                  placeholder="https://..."
                  value={form.offerLink}
                  onChange={handleChange}
                />
              </label>

              <label className="field">
                <span className="field-label">톤앤매너</span>
                <span className="field-hint">예: 전문적이지만 친근한 톤, 공격적 세일즈 금지</span>
                <input
                  className="input"
                  name="tone"
                  type="text"
                  placeholder="톤앤매너"
                  value={form.tone}
                  onChange={handleChange}
                />
              </label>

              <div className="input-grid">
                <label className="field">
                  <span className="field-label">Instagram media URL</span>
                  <span className="field-hint">공개 접근 가능한 이미지 또는 영상 URL</span>
                  <input
                    className="input"
                    name="instagramMediaUrl"
                    type="text"
                    placeholder="https://..."
                    value={form.instagramMediaUrl}
                    onChange={handleChange}
                  />
                </label>

                <label className="field">
                  <span className="field-label">Instagram 게시 타입</span>
                  <span className="field-hint">이미지 또는 릴스 중 선택합니다.</span>
                  <select
                    className="input select-input"
                    name="instagramMediaType"
                    value={form.instagramMediaType}
                    onChange={handleChange}
                  >
                    <option value="IMAGE">IMAGE</option>
                    <option value="REELS">REELS</option>
                  </select>
                </label>
              </div>

              <div className="input-grid">
                <label className="field">
                  <span className="field-label">YouTube video URL</span>
                  <span className="field-hint">업로드할 공개 mp4/mov 파일 URL</span>
                  <input
                    className="input"
                    name="youtubeVideoUrl"
                    type="text"
                    placeholder="https://..."
                    value={form.youtubeVideoUrl}
                    onChange={handleChange}
                  />
                </label>

                <label className="field">
                  <span className="field-label">YouTube 공개 범위</span>
                  <span className="field-hint">처음에는 private 테스트를 권장합니다.</span>
                  <select
                    className="input select-input"
                    name="youtubePrivacyStatus"
                    value={form.youtubePrivacyStatus}
                    onChange={handleChange}
                  >
                    <option value="private">private</option>
                    <option value="unlisted">unlisted</option>
                    <option value="public">public</option>
                  </select>
                </label>
              </div>

              {error ? <p className="error-box">{error}</p> : null}

              <div className="action-row">
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isGenerating}
                >
                  {isGenerating
                    ? "멀티채널 캠페인 생성 중..."
                    : "멀티채널 마케팅 패키지 생성"}
                </button>
              </div>
            </form>
          </section>

          <aside className="panel">
            <p className="panel-kicker">Operations</p>
            <h2 className="panel-title">연동 상태와 실행</h2>

            <div className="status-grid">
              {Object.entries(integrations).map(([key, integration]) => (
                <article className="status-card" key={key}>
                  <div className="status-card-top">
                    <strong>{integration.label}</strong>
                    <span
                      className="status-badge"
                      data-ready={String(integration.ready)}
                    >
                      {integration.ready ? "READY" : "SETUP"}
                    </span>
                  </div>
                  <p>{integration.detail}</p>
                </article>
              ))}
            </div>

            <article className="meta-card">
              <p className="meta-label">캠페인 앵글</p>
              <p className="meta-value">{campaign.campaignAngle}</p>
            </article>

            <article className="operation-card">
              <p className="meta-label">즉시 실행</p>
              <div className="action-stack">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublishThreads}
                >
                  {isPublishing && operationState.title === "Threads 게시"
                    ? "Threads 게시 중..."
                    : "Threads 발행"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublishInstagram}
                >
                  {isPublishing && operationState.title === "Instagram 게시"
                    ? "Instagram 게시 중..."
                    : "Instagram 발행"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={isPackagingVideo}
                  onClick={handleGenerateVideoPackage}
                >
                  {isPackagingVideo
                    ? "영상 제작 패키지 생성 중..."
                    : "쇼츠 영상 패키지 생성"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={isPublishing}
                  onClick={handleCheckYouTubeChannel}
                >
                  {isPublishing && operationState.title === "YouTube 채널 확인"
                    ? "YouTube 확인 중..."
                    : "YouTube 채널 확인"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={isPublishing}
                  onClick={handleUploadYouTube}
                >
                  {isPublishing && operationState.title === "YouTube 업로드"
                    ? "YouTube 업로드 중..."
                    : "YouTube 업로드"}
                </button>
              </div>
            </article>

            {youtubeChannel ? (
              <article className="meta-card">
                <p className="meta-label">YouTube 채널</p>
                <p className="meta-value">{youtubeChannel.title}</p>
                <p className="token-list">{youtubeChannel.id}</p>
              </article>
            ) : null}

            {operationState.status !== "idle" ? (
              <article
                className="operation-feedback"
                data-status={operationState.status}
              >
                <strong>{operationState.title}</strong>
                <p>{operationState.message}</p>
              </article>
            ) : null}
          </aside>
        </div>

        <section className="panel section-gap">
          <div className="panel-heading">
            <div>
              <p className="result-label">Output</p>
              <h2 className="panel-title">채널별 생성 결과</h2>
              <p className="panel-copy">
                채널 탭을 바꿔가며 복사하거나 수정할 수 있습니다.
              </p>
            </div>
            <div className="action-row">
              <button
                className="button button-secondary"
                type="button"
                onClick={handleCopy}
              >
                {copyState === "copied"
                  ? "복사 완료"
                  : copyState === "failed"
                    ? "복사 실패"
                    : `${activeChannelMeta?.label || "현재 탭"} 복사`}
              </button>
            </div>
          </div>

          <div className="channel-tabs" role="tablist" aria-label="Marketing outputs">
            {CHANNELS.map((channel) => (
              <button
                key={channel.id}
                className="channel-tab"
                type="button"
                data-active={String(channel.id === activeChannel)}
                onClick={() => {
                  setActiveChannel(channel.id);
                  setCopyState("idle");
                }}
              >
                <span>{channel.label}</span>
                <small>{channel.title}</small>
              </button>
            ))}
          </div>

          <div className="output-grid">
            <section className="output-main">
              <div className="channel-head">
                <div>
                  <p className="panel-kicker">Selected Channel</p>
                  <h3 className="panel-title">{activeChannelMeta?.title}</h3>
                  <p className="panel-copy">{activeChannelMeta?.description}</p>
                </div>
              </div>

              <textarea
                className="textarea result-output"
                value={activeOutput?.fullText || ""}
                onChange={updateFullText}
                spellCheck={false}
              />
            </section>

            <aside className="output-side">
              {activeChannel === "blog" ? (
                <>
                  <article className="meta-card">
                    <p className="meta-label">제목</p>
                    <p className="meta-value">{campaign.blog.title}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">네이버 태그</p>
                    <p className="token-list">{campaign.blog.naverTags.join(" ")}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">티스토리 태그</p>
                    <p className="token-list">{campaign.blog.tistoryTags.join(", ")}</p>
                  </article>
                </>
              ) : null}

              {activeChannel === "instagram" ? (
                <>
                  <article className="meta-card">
                    <p className="meta-label">오버레이 문구</p>
                    <p className="meta-value">{campaign.instagram.imageOverlay}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">해시태그</p>
                    <p className="token-list">
                      {campaign.instagram.hashtags.join(" ")}
                    </p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">게시용 media URL</p>
                    <p className="token-list">
                      {form.instagramMediaUrl || "아직 입력되지 않았습니다."}
                    </p>
                  </article>
                </>
              ) : null}

              {activeChannel === "threads" ? (
                <article className="meta-card">
                  <p className="meta-label">후속 리플</p>
                  <ol className="reply-list">
                    {campaign.threads.followUpReplies.map((reply, index) => (
                      <li key={`${reply}-${index}`}>{reply}</li>
                    ))}
                  </ol>
                </article>
              ) : null}

              {activeChannel === "youtube" ? (
                <>
                  <article className="meta-card">
                    <p className="meta-label">제목</p>
                    <p className="meta-value">{campaign.youtube.title}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">썸네일 문구</p>
                    <p className="meta-value">{campaign.youtube.thumbnailCopy}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">태그</p>
                    <p className="token-list">{campaign.youtube.tags.join(", ")}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">업로드용 video URL</p>
                    <p className="token-list">
                      {form.youtubeVideoUrl || "아직 입력되지 않았습니다."}
                    </p>
                  </article>
                </>
              ) : null}

              {activeChannel === "shorts" ? (
                <>
                  <article className="meta-card">
                    <p className="meta-label">훅</p>
                    <p className="meta-value">{campaign.shorts.hook}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">장면 구성</p>
                    <div className="scene-list">
                      {campaign.shorts.scenes.map((scene, index) => (
                        <article className="scene-card" key={`${scene.time}-${index}`}>
                          <strong>{scene.time}</strong>
                          <p>{scene.visual}</p>
                          <p>내레이션: {scene.narration}</p>
                          <p>자막: {scene.caption}</p>
                        </article>
                      ))}
                    </div>
                  </article>

                  {videoPackage ? (
                    <>
                      <article className="meta-card">
                        <p className="meta-label">SRT 파일명</p>
                        <p className="meta-value">{videoPackage.fileBase}.srt</p>
                        <textarea
                          className="textarea compact-textarea"
                          readOnly
                          value={videoPackage.subtitleSrt}
                        />
                      </article>
                      <article className="meta-card">
                        <p className="meta-label">ffmpeg 명령 예시</p>
                        <pre className="code-block">
{Object.values(videoPackage.ffmpegCommands).join("\n")}
                        </pre>
                      </article>
                    </>
                  ) : null}
                </>
              ) : null}
            </aside>
          </div>

          <p className="footnote">
            Threads와 Instagram 게시 엔드포인트는 환경 변수만 갖추면 바로 호출됩니다.
            YouTube는 refresh token으로 채널 확인과 video URL 기반 업로드까지
            연결했습니다. 처음 테스트는 `private` 업로드로 진행하는 편이 안전합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
