import {
  jsonResponse,
  parseGeminiJson,
  requestGemini,
} from "../_lib/gemini.js";
import {
  buildCampaignPrompt,
  normalizeCampaign,
  normalizeCampaignInput,
} from "../_lib/campaign.js";

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

  const input = normalizeCampaignInput(payload);

  if (!input.audience || !input.keyword || !input.productName) {
    return jsonResponse(
      {
        error:
          "타겟 고객, 메인 키워드, 상품/서비스명은 모두 2자 이상 입력해 주세요.",
      },
      400,
    );
  }

  try {
    const prompt = buildCampaignPrompt(input);
    const geminiPayload = await requestGemini(env, prompt, { jsonMode: true });
    const campaign = normalizeCampaign(parseGeminiJson(geminiPayload), input);

    return jsonResponse({
      campaign,
      model: "gemini-2.5-flash",
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "캠페인 생성 중 오류가 발생했습니다.",
      },
      502,
    );
  }
}
