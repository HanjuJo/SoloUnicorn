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

  const offer = normalizeOfferPayload(payload?.offer);

  if (!offer.title || !payload?.audience || !payload?.keyword) {
    return jsonResponse(
      {
        error: "타겟 고객, 메인 키워드, 오퍼 제목은 모두 필요합니다.",
      },
      400,
    );
  }

  const disclosureText =
    normalizeText(payload?.disclosureText) || defaultDisclosureText(offer.provider);

  const input = normalizeCampaignInput({
    ...payload,
    productName: offer.title,
    offerLink: normalizeText(payload?.offerLink) || offer.link,
    offerType:
      normalizeText(payload?.offerType) ||
      (offer.provider === "coupang" || offer.provider === "tenping"
        ? "affiliate"
        : "service"),
    offerProvider: offer.provider,
    offerCategory: offer.category,
    offerSummary: buildOfferSummary(offer),
    disclosureText,
    seedTags: [offer.category, offer.provider, ...(offer.seedTags || [])],
  });

  try {
    const prompt = buildCampaignPrompt(input);
    const geminiPayload = await requestGemini(env, prompt, { jsonMode: true });
    const campaign = normalizeCampaign(parseGeminiJson(geminiPayload), input);

    return jsonResponse({
      ok: true,
      offer,
      campaign,
      model: "gemini-2.5-flash",
    });
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "오퍼 기반 캠페인 생성 중 오류가 발생했습니다.",
      },
      502,
    );
  }
}

function normalizeOfferPayload(offer) {
  return {
    provider: normalizeText(offer?.provider) || "unknown",
    title: normalizeText(offer?.title),
    summary: normalizeText(offer?.summary),
    category: normalizeText(offer?.category),
    link: normalizeText(offer?.link),
    imageUrl: normalizeText(offer?.imageUrl),
    seedTags: Array.isArray(offer?.seedTags)
      ? offer.seedTags.map((tag) => normalizeText(tag)).filter(Boolean)
      : [],
  };
}

function buildOfferSummary(offer) {
  return [offer.summary, offer.category, offer.link]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(" | ");
}

function defaultDisclosureText(provider) {
  if (provider === "coupang") {
    return "쿠팡 파트너스 활동의 일환으로 일정 수수료를 제공받을 수 있습니다.";
  }

  if (provider === "tenping") {
    return "제휴 활동의 일환으로 일정 리워드 또는 수수료를 제공받을 수 있습니다.";
  }

  return "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
