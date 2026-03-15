import { jsonResponse } from "../_lib/gemini.js";
import { discoverOffers } from "../_lib/offers.js";

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

  try {
    const result = await discoverOffers(env, payload);

    return jsonResponse({
      ok: true,
      ...result,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "오퍼 검색 중 오류가 발생했습니다.",
      },
      502,
    );
  }
}
