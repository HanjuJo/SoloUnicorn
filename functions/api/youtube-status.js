import { jsonResponse } from "../_lib/gemini.js";
import {
  fetchYouTubeChannel,
  refreshYouTubeAccessToken,
} from "../_lib/youtube.js";

export async function onRequestGet(context) {
  try {
    const result = await fetchYouTubeChannel(context.env);

    return jsonResponse({
      ok: true,
      channel: result.channel,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "YouTube 채널 확인 중 오류가 발생했습니다.";

    if (message.includes("insufficient authentication scopes")) {
      try {
        await refreshYouTubeAccessToken(context.env);

        return jsonResponse({
          ok: true,
          channel: null,
          warning:
            "refresh token은 유효하지만 채널 조회 scope가 없습니다. 업로드만 필요하면 현재 토큰으로도 동작할 수 있고, 채널 조회까지 하려면 youtube.readonly 또는 youtube scope로 다시 동의가 필요합니다.",
        });
      } catch (refreshError) {
        return jsonResponse(
          {
            error:
              refreshError instanceof Error
                ? refreshError.message
                : "YouTube access token 갱신 확인에 실패했습니다.",
          },
          502,
        );
      }
    }

    return jsonResponse(
      {
        error: message,
      },
      502,
    );
  }
}
