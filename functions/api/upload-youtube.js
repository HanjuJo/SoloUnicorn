import { jsonResponse } from "../_lib/gemini.js";
import { uploadYouTubeVideoFromUrl } from "../_lib/youtube.js";

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

  const videoUrl =
    typeof payload?.videoUrl === "string" ? payload.videoUrl.trim() : "";
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const description =
    typeof payload?.description === "string" ? payload.description.trim() : "";
  const privacyStatus =
    payload?.privacyStatus === "public" ||
    payload?.privacyStatus === "unlisted" ||
    payload?.privacyStatus === "private"
      ? payload.privacyStatus
      : "private";
  const categoryId =
    typeof payload?.categoryId === "string" ? payload.categoryId.trim() : "22";
  const tags = Array.isArray(payload?.tags)
    ? payload.tags
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

  if (!videoUrl || !title) {
    return jsonResponse(
      { error: "YouTube 업로드에는 공개 videoUrl과 title이 필요합니다." },
      400,
    );
  }

  try {
    const result = await uploadYouTubeVideoFromUrl(env, {
      videoUrl,
      title,
      description,
      tags,
      privacyStatus,
      categoryId,
    });

    return jsonResponse({
      ok: true,
      platform: "youtube",
      result,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "YouTube 업로드 중 오류가 발생했습니다.",
      },
      502,
    );
  }
}
