const COUPANG_API_BASE_PATH =
  "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";
const COUPANG_API_BASE_URL = "https://api-gateway.coupang.com";
const TENPING_API_BASE_URL = "http://tenping.kr/adbox";

const TENPING_CATEGORY_LIST = [
  { name: "교육", code: 100000 },
  { name: "자격증", code: 110000 },
  { name: "IT", code: 120000 },
  { name: "건강", code: 130000 },
  { name: "병원", code: 250000 },
  { name: "게임", code: 140000 },
  { name: "뷰티", code: 150000 },
  { name: "금융", code: 160000 },
  { name: "보험", code: 260000 },
  { name: "경영/창업", code: 170000 },
  { name: "자동차", code: 180000 },
  { name: "쇼핑", code: 190000 },
  { name: "리빙", code: 200000 },
  { name: "엔터테인먼트", code: 210000 },
  { name: "사회", code: 220000 },
  { name: "기타", code: 230000 },
  { name: "성인", code: 240000 },
  { name: "전자책·VOD", code: 270000 },
];

export function getOfferIntegrationStatus(env) {
  return {
    coupang: {
      ready: Boolean(
        env.COUPANG_ACCESS_KEY &&
          env.COUPANG_SECRET_KEY &&
          env.COUPANG_PARTNER_ID,
      ),
      label: "Coupang",
      detail:
        env.COUPANG_ACCESS_KEY &&
        env.COUPANG_SECRET_KEY &&
        env.COUPANG_PARTNER_ID
          ? "상품 검색 가능"
          : "COUPANG_ACCESS_KEY / SECRET_KEY / PARTNER_ID 필요",
    },
    tenping: {
      ready: Boolean(env.TENPING_MEMBER_ID),
      label: "Tenping",
      detail: env.TENPING_MEMBER_ID
        ? "캠페인 조회 가능"
        : "TENPING_MEMBER_ID 필요",
    },
  };
}

export async function discoverOffers(env, input) {
  const provider = normalizeProvider(input?.provider);
  const keyword = normalizeText(input?.keyword);
  const categoryName = normalizeText(input?.categoryName);
  const categoryCode = normalizeNumber(input?.categoryCode);
  const limit = clampLimit(input?.limit);
  const statuses = getOfferIntegrationStatus(env);

  if (!keyword || keyword.length < 2) {
    throw new Error("오퍼 검색을 위해 2자 이상의 키워드가 필요합니다.");
  }

  const tasks = [];

  if ((provider === "all" || provider === "coupang") && statuses.coupang.ready) {
    tasks.push(
      searchCoupangOffers(env, { keyword, limit }).then((offers) => ({
        provider: "coupang",
        offers,
      })),
    );
  }

  if ((provider === "all" || provider === "tenping") && statuses.tenping.ready) {
    tasks.push(
      searchTenpingOffers(env, {
        keyword,
        categoryName,
        categoryCode,
        limit,
      }).then((offers) => ({
        provider: "tenping",
        offers,
      })),
    );
  }

  if (tasks.length === 0) {
    throw new Error(
      "사용 가능한 오퍼 공급처가 없습니다. 쿠팡 또는 텐핑 환경 변수를 먼저 설정해 주세요.",
    );
  }

  const settled = await Promise.allSettled(tasks);
  const warnings = [];
  const offers = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      offers.push(...result.value.offers);
    } else {
      warnings.push(
        result.reason instanceof Error
          ? result.reason.message
          : "오퍼 검색 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  return {
    provider,
    keyword,
    offers: offers
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, limit),
    warnings,
    statuses,
  };
}

async function searchCoupangOffers(env, input) {
  const query = new URLSearchParams({
    keyword: input.keyword,
    limit: String(input.limit),
    subId: env.COUPANG_PARTNER_ID,
  });

  const signedDate = getCoupangSignedDate();
  const signature = await signCoupangRequest(
    env.COUPANG_SECRET_KEY,
    "GET",
    COUPANG_API_BASE_PATH,
    signedDate,
    query.toString(),
  );

  const response = await fetch(
    `${COUPANG_API_BASE_URL}${COUPANG_API_BASE_PATH}?${query.toString()}`,
    {
      headers: {
        Authorization: `CEA algorithm=HmacSHA256, access-key=${env.COUPANG_ACCESS_KEY}, signed-date=${signedDate}, signature=${signature}`,
        "Content-Type": "application/json",
      },
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      formatProviderError("쿠팡 오퍼 검색 실패", payload, response.status),
    );
  }

  const productData = Array.isArray(payload?.data?.productData)
    ? payload.data.productData
    : [];

  return productData.slice(0, input.limit).map((product) =>
    normalizeOffer("coupang", {
      id:
        String(product?.productId || product?.itemId || product?.vendorItemId || ""),
      title: product?.productName,
      summary: buildCoupangSummary(product),
      price: product?.productPrice,
      imageUrl: product?.productImage,
      link: product?.productUrl || product?.shortenUrl,
      category: product?.categoryName,
      rating: product?.rating,
      reviewCount: product?.reviewCount,
      raw: product,
      keyword: input.keyword,
    }),
  );
}

async function searchTenpingOffers(env, input) {
  const resolvedCategoryCode =
    input.categoryCode || resolveTenpingCategoryCode(input.categoryName) || 200000;

  const query = [
    `MemberID=${normalizeTenpingMemberId(env.TENPING_MEMBER_ID)}`,
    `PageSize=${encodeURIComponent(String(Math.max(input.limit * 2, 10)))}`,
    `Category=${encodeURIComponent(String(resolvedCategoryCode))}`,
    "CampaignType=4",
  ].join("&");

  const response = await fetch(`${TENPING_API_BASE_URL}/list?${query}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      formatProviderError("텐핑 캠페인 조회 실패", payload, response.status),
    );
  }

  const list = Array.isArray(payload?.List) ? payload.List : [];

  const normalizedOffers = list
    .map((campaign) =>
      normalizeOffer("tenping", {
        id: String(
          campaign?.CampaignID || campaign?.ContentID || campaign?.Code || "",
        ),
        title: campaign?.ContentTitle || campaign?.Title,
        summary: campaign?.ContentMemo || campaign?.Description,
        price: campaign?.Price || "",
        imageUrl: campaign?.LImage || campaign?.ImageUrl,
        link: campaign?.Link,
        category:
          input.categoryName ||
          resolveTenpingCategoryName(resolvedCategoryCode) ||
          campaign?.CategoryName,
        commissionText:
          campaign?.Commission ||
          campaign?.CommissionMemo ||
          campaign?.ContentMemo ||
          "",
        raw: campaign,
        keyword: input.keyword,
      }),
    )
    .filter((offer) => offer.title || offer.summary);

  const matchedOffers = normalizedOffers.filter((offer) => offer.relevanceScore > 0);

  if (matchedOffers.length > 0) {
    return matchedOffers.slice(0, input.limit);
  }

  return normalizedOffers.slice(0, input.limit).map((offer) => ({
    ...offer,
    meta: {
      ...offer.meta,
      fallback: true,
    },
  }));
}

function normalizeOffer(provider, input) {
  const title = normalizeText(input.title);
  const summary = normalizeText(input.summary);
  const category = normalizeText(input.category);
  const keyword = normalizeText(input.keyword);
  const relevanceScore = calculateKeywordScore(
    [title, summary, category].join(" "),
    keyword,
  );

  return {
    provider,
    id: normalizeText(input.id) || `${provider}-${slugify(title) || Date.now()}`,
    title,
    summary,
    price: normalizePrice(input.price),
    imageUrl: normalizeText(input.imageUrl),
    link: normalizeText(input.link),
    category,
    relevanceScore,
    meta: {
      rating: input.rating ?? null,
      reviewCount: input.reviewCount ?? null,
      commissionText: normalizeText(input.commissionText),
      raw: input.raw ?? null,
    },
  };
}

function buildCoupangSummary(product) {
  const parts = [
    product?.categoryName,
    formatPrice(product?.productPrice),
    product?.rating ? `평점 ${product.rating}` : "",
    product?.reviewCount ? `리뷰 ${product.reviewCount}개` : "",
  ]
    .map((part) => normalizeText(part))
    .filter(Boolean);

  return parts.join(" · ");
}

function normalizeProvider(provider) {
  const normalized = normalizeText(provider).toLowerCase();

  if (normalized === "coupang" || normalized === "tenping") {
    return normalized;
  }

  return "all";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function clampLimit(value) {
  const parsed = normalizeNumber(value);
  return Math.min(Math.max(parsed || 6, 1), 12);
}

function normalizePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/gu, "");
    return digits ? Number(digits) : null;
  }

  return null;
}

function formatPrice(value) {
  const normalized = normalizePrice(value);
  return normalized ? `${normalized.toLocaleString("ko-KR")}원` : "";
}

function calculateKeywordScore(sourceText, keyword) {
  const normalizedSource = normalizeText(sourceText).toLowerCase();
  const terms = normalizeText(keyword)
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean);

  if (!terms.length) {
    return 0;
  }

  let score = 0;

  for (const term of terms) {
    if (normalizedSource.includes(term)) {
      score += 1;
    }
  }

  return score;
}

function resolveTenpingCategoryCode(categoryName) {
  const target = normalizeText(categoryName);
  if (!target) {
    return 0;
  }

  const match = TENPING_CATEGORY_LIST.find((category) =>
    category.name.includes(target),
  );

  return match?.code || 0;
}

function resolveTenpingCategoryName(categoryCode) {
  const match = TENPING_CATEGORY_LIST.find(
    (category) => category.code === normalizeNumber(categoryCode),
  );

  return match?.name || "";
}

function normalizeTenpingMemberId(memberId) {
  const normalized = normalizeText(memberId);

  if (!normalized) {
    return "";
  }

  // Tenping MemberID may already be URL-encoded in user settings.
  if (/%[0-9a-f]{2}/iu.test(normalized)) {
    return normalized;
  }

  return encodeURIComponent(normalized);
}

async function signCoupangRequest(
  secretKey,
  method,
  path,
  signedDate,
  queryString,
) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(`${signedDate}${method}${path}${queryString}`),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCoupangSignedDate() {
  const now = new Date();
  const year = String(now.getUTCFullYear()).slice(-2);
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function slugify(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function formatProviderError(prefix, payload, statusCode) {
  const message =
    payload?.message ||
    payload?.error?.message ||
    payload?.rMessage ||
    payload?.msg ||
    "";

  return message ? `${prefix} (${statusCode}): ${message}` : `${prefix} (${statusCode})`;
}
