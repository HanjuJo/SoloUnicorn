import {
  extractGeminiText,
  jsonResponse,
  requestGemini,
} from "../_lib/gemini.js";

const PARTNER_LINK =
  "https://2026-nexo-polic-y-fund.netlify.app/?partner_code=johanju";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GEMINI_API_KEY) {
    return jsonResponse(
      {
        error:
          "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. Cloudflare Pages 설정을 확인해 주세요.",
      },
      500,
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { error: "요청 본문이 올바른 JSON 형식이 아닙니다." },
      400,
    );
  }

  const audience = typeof payload?.audience === "string" ? payload.audience.trim() : "";
  const keyword = typeof payload?.keyword === "string" ? payload.keyword.trim() : "";

  if (audience.length < 2 || keyword.length < 2) {
    return jsonResponse(
      { error: "타겟 고객과 메인 키워드를 2자 이상 입력해 주세요." },
      400,
    );
  }

  const prompt = [
    "너는 한국 시장용 네이버 블로그 전문 카피라이터다.",
    "가독성이 높고 SEO를 고려한 정보성 홍보 글을 작성한다.",
    "출력은 반드시 한국어로 작성한다.",
    `타겟 고객: ${audience}`,
    `메인 키워드: ${keyword}`,
    "요구사항:",
    "1. 제목 1개로 시작한다.",
    "2. 공감형 도입, 문제 인식, 해결 방안, 전자칠판 활용 장점, 도입 제안 순서로 자연스럽게 구성한다.",
    "3. 문단 사이에 적절한 줄바꿈을 사용해 네이버 블로그 스타일로 읽기 쉽게 작성한다.",
    "4. 메인 키워드를 과하지 않게 반복해 SEO 친화적으로 만든다.",
    "5. 과장 광고 문구보다 실제 활용 상황과 효율 개선 포인트를 중심으로 쓴다.",
    "6. 마지막 문단에는 상담 또는 확인용 링크를 자연스럽게 안내하고 아래 제휴 링크를 반드시 그대로 포함한다.",
    `7. 반드시 이 링크를 그대로 포함한다: ${PARTNER_LINK}`,
    "8. 글 본문이 끝난 뒤에는 블로그 업로드용 태그를 반드시 추가한다.",
    "9. 태그는 두 줄로 작성한다.",
    "10. 첫 줄은 '네이버 태그:'로 시작하고, 10개에서 15개 사이의 해시태그를 한 줄에 띄어쓰기로 이어서 작성한다.",
    "11. 두 번째 줄은 '티스토리 태그:'로 시작하고, 10개에서 15개 사이의 태그를 콤마(,)로 구분해 작성한다.",
    "12. 티스토리 태그에는 #을 붙이지 않는다.",
    "13. 태그는 타겟 고객, 메인 키워드, 전자칠판 도입, 교육/업무 효율, 스마트 환경 관련 키워드 중심으로 만든다.",
    "14. 마크다운 코드블록은 사용하지 않는다.",
  ].join("\n");

  let responsePayload;

  try {
    responsePayload = await requestGemini(env, prompt);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gemini API 호출에 실패했습니다.",
      },
      502,
    );
  }

  const post = normalizeTagSections(
    extractGeminiText(responsePayload),
    audience,
    keyword,
  );

  if (!post) {
    return jsonResponse(
      {
        error: "Gemini 응답에서 본문 텍스트를 추출하지 못했습니다.",
      },
      502,
    );
  }

  return jsonResponse({
    post,
    model: "gemini-2.5-flash",
  });
}

function normalizeTagSections(post, audience, keyword) {
  if (!post) {
    return "";
  }

  const lines = post.split("\n");
  const naverIndex = lines.findIndex((line) => /^네이버\s*태그\s*:/u.test(line.trim()));
  const tistoryIndex = lines.findIndex((line) => /^티스토리\s*태그\s*:/u.test(line.trim()));
  const legacyIndex = lines.findIndex((line) => /^태그\s*:/u.test(line.trim()));
  const baseTags = buildBaseTags(audience, keyword);
  const naverTags = normalizeNaverTags(
    naverIndex !== -1
      ? lines[naverIndex].replace(/^네이버\s*태그\s*:/u, "").trim()
      : legacyIndex !== -1
        ? lines[legacyIndex].replace(/^태그\s*:/u, "").trim()
        : "",
    baseTags,
  );
  const tistoryTags = normalizeTistoryTags(
    tistoryIndex !== -1
      ? lines[tistoryIndex].replace(/^티스토리\s*태그\s*:/u, "").trim()
      : "",
    baseTags,
  );

  const removableIndexes = [naverIndex, tistoryIndex, legacyIndex]
    .filter((index, position, array) => index !== -1 && array.indexOf(index) === position)
    .sort((a, b) => b - a);

  for (const index of removableIndexes) {
    lines.splice(index, 1);
  }

  while (lines.length > 0 && !lines.at(-1)?.trim()) {
    lines.pop();
  }

  lines.push("", `네이버 태그: ${naverTags.join(" ")}`);
  lines.push(`티스토리 태그: ${tistoryTags.join(", ")}`);

  return lines.join("\n").trim();
}

function normalizeNaverTags(rawTagText, fallbackTags) {
  const rawSegments = rawTagText.includes(",")
    ? rawTagText.split(",")
    : rawTagText.split(/\s+/u);

  const cleaned = rawSegments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/^#+/u, ""))
    .map((segment) => segment.replace(/\s+/gu, ""))
    .filter(Boolean)
    .map((segment) => `#${segment}`);

  const fallbackHashTags = fallbackTags.map((tag) => `#${tag}`);
  const unique = Array.from(new Set([...cleaned, ...fallbackHashTags]));
  return unique.slice(0, 15);
}

function buildBaseTags(audience, keyword) {
  return [
    audience,
    keyword,
    "전자칠판",
    "스마트교육",
    "수업효율화",
    "업무효율",
    "디지털전환",
    "도입상담",
  ]
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/^#+/u, ""))
    .map((tag) => tag.replace(/\s+/gu, ""))
    .slice(0, 15);
}

function normalizeTistoryTags(rawTagText, fallbackTags) {
  const rawSegments = rawTagText.includes(",")
    ? rawTagText.split(",")
    : rawTagText.split(/\s+/u);

  const cleaned = rawSegments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/^#+/u, ""))
    .map((segment) => segment.replace(/\s+/gu, ""))
    .filter(Boolean);

  const unique = Array.from(new Set([...cleaned, ...fallbackTags]));
  return unique.slice(0, 15);
}
