import { jsonResponse } from "../_lib/gemini.js";
import { publishThreadsText } from "../_lib/integrations.js";

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

  const text = typeof payload?.text === "string" ? payload.text.trim() : "";

  if (!text) {
    return jsonResponse({ error: "게시할 Threads 텍스트가 비어 있습니다." }, 400);
  }

  try {
    const result = await publishThreadsText(env, text);

    return jsonResponse({
      ok: true,
      platform: "threads",
      result,
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Threads 게시 중 오류가 발생했습니다.",
      },
      502,
    );
  }
}
