const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

export async function refreshYouTubeAccessToken(env) {
  if (
    !env.YOUTUBE_CLIENT_ID ||
    !env.YOUTUBE_CLIENT_SECRET ||
    !env.YOUTUBE_REFRESH_TOKEN
  ) {
    throw new Error(
      "YouTube OAuth 설정이 부족합니다. YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN을 확인해 주세요.",
    );
  }

  const body = new URLSearchParams({
    client_id: env.YOUTUBE_CLIENT_ID,
    client_secret: env.YOUTUBE_CLIENT_SECRET,
    refresh_token: env.YOUTUBE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      formatError("YouTube access token 갱신 실패", payload),
    );
  }

  if (!payload?.access_token) {
    throw new Error("YouTube access token을 받지 못했습니다.");
  }

  return payload.access_token;
}

export async function fetchYouTubeChannel(env) {
  const accessToken = await refreshYouTubeAccessToken(env);
  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  url.searchParams.set("part", "id,snippet");
  url.searchParams.set("mine", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(formatError("YouTube 채널 조회 실패", payload));
  }

  const channel = payload?.items?.[0];

  if (!channel) {
    throw new Error("인증된 YouTube 채널 정보를 찾지 못했습니다.");
  }

  return {
    accessToken,
    channel: {
      id: channel.id || "",
      title: channel?.snippet?.title || "",
      description: channel?.snippet?.description || "",
      customUrl: channel?.snippet?.customUrl || "",
    },
  };
}

export async function uploadYouTubeVideoFromUrl(env, input) {
  const accessToken = await refreshYouTubeAccessToken(env);
  const sourceResponse = await fetch(input.videoUrl);

  if (!sourceResponse.ok) {
    throw new Error(`원본 비디오 다운로드 실패: HTTP ${sourceResponse.status}`);
  }

  const sourceBlob = await sourceResponse.blob();
  const mimeType = sourceBlob.type || "application/octet-stream";
  const boundary = `codex-youtube-${crypto.randomUUID()}`;
  const metadata = {
    snippet: {
      title: input.title,
      description: input.description,
      tags: input.tags,
      categoryId: input.categoryId || "22",
    },
    status: {
      privacyStatus: input.privacyStatus || "private",
    },
  };

  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata,
    )}\r\n`,
  );
  const mediaHeader = encoder.encode(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const mediaBytes = new Uint8Array(await sourceBlob.arrayBuffer());
  const closing = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(
    metadataPart.length + mediaHeader.length + mediaBytes.length + closing.length,
  );

  body.set(metadataPart, 0);
  body.set(mediaHeader, metadataPart.length);
  body.set(mediaBytes, metadataPart.length + mediaHeader.length);
  body.set(
    closing,
    metadataPart.length + mediaHeader.length + mediaBytes.length,
  );

  const uploadUrl = new URL(`${YOUTUBE_UPLOAD_BASE}/videos`);
  uploadUrl.searchParams.set("part", "snippet,status");
  uploadUrl.searchParams.set("uploadType", "multipart");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const payload = await uploadResponse.json();

  if (!uploadResponse.ok) {
    throw new Error(formatError("YouTube 업로드 실패", payload));
  }

  return {
    videoId: payload?.id || "",
    privacyStatus: payload?.status?.privacyStatus || input.privacyStatus || "private",
    url: payload?.id ? `https://www.youtube.com/watch?v=${payload.id}` : "",
    raw: payload,
  };
}

function formatError(prefix, payload) {
  const message =
    payload?.error?.message ||
    payload?.error_description ||
    payload?.message ||
    (typeof payload === "string" ? payload : "");

  return message ? `${prefix}: ${message}` : prefix;
}
