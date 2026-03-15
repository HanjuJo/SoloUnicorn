import { getOfferIntegrationStatus } from "./offers.js";

const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com/v25.0";
const THREADS_GRAPH_URL = "https://graph.threads.net/v1.0";

export function getIntegrationStatus(env) {
  return {
    gemini: {
      ready: Boolean(env.GEMINI_API_KEY),
      label: "Gemini",
      detail: env.GEMINI_API_KEY ? "콘텐츠 생성 가능" : "GEMINI_API_KEY 필요",
    },
    threads: {
      ready: Boolean(env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID),
      label: "Threads",
      detail:
        env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID
          ? "텍스트 게시 가능"
          : "THREADS_ACCESS_TOKEN / THREADS_USER_ID 필요",
    },
    instagram: {
      ready: Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID),
      label: "Instagram",
      detail:
        env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_USER_ID
          ? "이미지/릴스 게시 가능"
          : "INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID 필요",
    },
    youtube: {
      ready: Boolean(
        env.YOUTUBE_CLIENT_ID &&
          env.YOUTUBE_CLIENT_SECRET &&
          env.YOUTUBE_REFRESH_TOKEN,
      ),
      label: "YouTube",
      detail:
        env.YOUTUBE_CLIENT_ID &&
        env.YOUTUBE_CLIENT_SECRET &&
        env.YOUTUBE_REFRESH_TOKEN
          ? "OAuth 업로드 준비됨"
          : "YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN 필요",
    },
    ...getOfferIntegrationStatus(env),
  };
}

export async function publishThreadsText(env, input) {
  if (!env.THREADS_ACCESS_TOKEN || !env.THREADS_USER_ID) {
    throw new Error(
      "Threads 발행에 필요한 환경 변수가 없습니다. THREADS_ACCESS_TOKEN과 THREADS_USER_ID를 설정해 주세요.",
    );
  }

  const createPayload = new URLSearchParams({
    media_type: "TEXT",
    text: input.text,
    access_token: env.THREADS_ACCESS_TOKEN,
  });

  if (input.replyToId) {
    createPayload.set("reply_to_id", input.replyToId);
  }

  if (input.replyControl) {
    createPayload.set("reply_control", input.replyControl);
  }

  const createResponse = await fetch(
    `${THREADS_GRAPH_URL}/${env.THREADS_USER_ID}/threads`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: createPayload.toString(),
    },
  );

  const createResult = await createResponse.json();

  if (!createResponse.ok) {
    throw new Error(formatProviderError("Threads container 생성 실패", createResult));
  }

  const creationId = createResult?.id;

  if (!creationId) {
    throw new Error("Threads container ID를 받지 못했습니다.");
  }

  const publishPayload = new URLSearchParams({
    creation_id: creationId,
    access_token: env.THREADS_ACCESS_TOKEN,
  });

  const publishResponse = await fetch(
    `${THREADS_GRAPH_URL}/${env.THREADS_USER_ID}/threads_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: publishPayload.toString(),
    },
  );

  const publishResult = await publishResponse.json();

  if (!publishResponse.ok) {
    throw new Error(formatProviderError("Threads 게시 실패", publishResult));
  }

  return {
    creationId,
    publishId: publishResult?.id || "",
    raw: publishResult,
  };
}

export async function publishInstagramMedia(env, input) {
  if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
    throw new Error(
      "Instagram 발행에 필요한 환경 변수가 없습니다. INSTAGRAM_ACCESS_TOKEN과 INSTAGRAM_USER_ID를 설정해 주세요.",
    );
  }

  const mediaType = input.mediaType === "REELS" ? "REELS" : "IMAGE";
  const createPayload = new URLSearchParams({
    access_token: env.INSTAGRAM_ACCESS_TOKEN,
    caption: input.caption,
  });

  if (mediaType === "REELS") {
    createPayload.set("media_type", "REELS");
    createPayload.set("video_url", input.mediaUrl);
    createPayload.set("share_to_feed", input.shareToFeed ? "true" : "false");
  } else {
    createPayload.set("image_url", input.mediaUrl);
  }

  const createResponse = await fetch(
    `${INSTAGRAM_GRAPH_URL}/${env.INSTAGRAM_USER_ID}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: createPayload.toString(),
    },
  );

  const createResult = await createResponse.json();

  if (!createResponse.ok) {
    throw new Error(
      formatProviderError("Instagram media container 생성 실패", createResult),
    );
  }

  const creationId = createResult?.id || createResult?.creation_id;

  if (!creationId) {
    throw new Error("Instagram media container ID를 받지 못했습니다.");
  }

  await waitForInstagramMediaReady(env, creationId);

  const publishPayload = new URLSearchParams({
    creation_id: creationId,
    access_token: env.INSTAGRAM_ACCESS_TOKEN,
  });

  const publishResponse = await fetch(
    `${INSTAGRAM_GRAPH_URL}/${env.INSTAGRAM_USER_ID}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: publishPayload.toString(),
    },
  );

  const publishResult = await publishResponse.json();

  if (!publishResponse.ok) {
    throw new Error(formatProviderError("Instagram 게시 실패", publishResult));
  }

  return {
    creationId,
    publishId: publishResult?.id || "",
    raw: publishResult,
  };
}

async function waitForInstagramMediaReady(env, creationId) {
  const maxAttempts = 12;
  const delayMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const statusUrl = new URL(`${INSTAGRAM_GRAPH_URL}/${creationId}`);
    statusUrl.searchParams.set("fields", "status_code,status");
    statusUrl.searchParams.set("access_token", env.INSTAGRAM_ACCESS_TOKEN);

    const statusResponse = await fetch(statusUrl);
    const statusResult = await statusResponse.json();

    if (!statusResponse.ok) {
      throw new Error(
        formatProviderError("Instagram media 상태 조회 실패", statusResult),
      );
    }

    const statusCode =
      typeof statusResult?.status_code === "string"
        ? statusResult.status_code.toUpperCase()
        : "";

    if (!statusCode || statusCode === "FINISHED" || statusCode === "PUBLISHED") {
      return;
    }

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(
        `Instagram media 준비 실패: ${statusCode}${statusResult?.status ? ` (${statusResult.status})` : ""}`,
      );
    }

    await sleep(delayMs);
  }

  throw new Error("Instagram media 준비 대기 시간이 초과되었습니다.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProviderError(prefix, payload) {
  const message =
    payload?.error?.message ||
    payload?.message ||
    (typeof payload === "string" ? payload : "");

  return message ? `${prefix}: ${message}` : prefix;
}
