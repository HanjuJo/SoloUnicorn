import { jsonResponse } from "../_lib/gemini.js";
import { publishInstagramMedia } from "../_lib/integrations.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let payload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { error: "요청 본문이 올바른 JSON 형식이 아닙니다." },
      400,
    );
  }

  const mediaUrl =
    typeof payload?.mediaUrl === "string" ? payload.mediaUrl.trim() : "";
  const caption =
    typeof payload?.caption === "string" ? payload.caption.trim() : "";
  const mediaType =
    payload?.mediaType === "REELS" || payload?.mediaType === "IMAGE"
      ? payload.mediaType
      : "IMAGE";
  const shareToFeed = payload?.shareToFeed !== false;

  if (!mediaUrl) {
    return jsonResponse(
      { error: "Instagram 게시를 위한 공개 media URL이 필요합니다." },
      400,
    );
  }

  try {
    const result = await publishInstagramMedia(env, {
      mediaUrl,
      caption,
      mediaType,
      shareToFeed,
    });

    return jsonResponse({
      ok: true,
      platform: "instagram",
      result,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Instagram 게시 중 오류가 발생했습니다.",
      },
      502,
    );
  }
}
