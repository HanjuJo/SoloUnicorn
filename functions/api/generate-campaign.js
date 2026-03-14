import {
  jsonResponse,
  parseGeminiJson,
  requestGemini,
} from "../_lib/gemini.js";

const PARTNER_LINK =
  "https://2026-nexo-polic-y-fund.netlify.app/?partner_code=johanju";

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

  const input = normalizeInput(payload);

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

function normalizeInput(payload) {
  return {
    audience: normalizeText(payload?.audience),
    keyword: normalizeText(payload?.keyword),
    productName: normalizeText(payload?.productName),
    offerLink: normalizeText(payload?.offerLink) || PARTNER_LINK,
    tone: normalizeText(payload?.tone) || "전문적이지만 친근한 톤",
    objective: normalizeText(payload?.objective) || "문의 전환",
  };
}

function buildCampaignPrompt(input) {
  return [
    "너는 한국 시장용 멀티채널 퍼포먼스 마케팅 카피라이터이자 콘텐츠 플래너다.",
    "반드시 한국어로 작성한다.",
    "반드시 유효한 JSON 객체만 반환한다. 설명 문장, 마크다운, 코드블록은 금지한다.",
    `타겟 고객: ${input.audience}`,
    `메인 키워드: ${input.keyword}`,
    `상품/서비스명: ${input.productName}`,
    `톤앤매너: ${input.tone}`,
    `목표: ${input.objective}`,
    `행동 유도 링크: ${input.offerLink}`,
    "아래 스키마와 정확히 같은 최상위 키를 사용한다:",
    "{",
    '  "campaign_angle": string,',
    '  "blog": {',
    '    "title": string,',
    '    "body": string,',
    '    "naver_tags": string[],',
    '    "tistory_tags": string[]',
    "  },",
    '  "instagram": {',
    '    "caption": string,',
    '    "hashtags": string[],',
    '    "image_overlay": string',
    "  },",
    '  "threads": {',
    '    "post": string,',
    '    "follow_up_replies": string[]',
    "  },",
    '  "youtube": {',
    '    "title": string,',
    '    "description": string,',
    '    "tags": string[],',
    '    "thumbnail_copy": string',
    "  },",
    '  "shorts": {',
    '    "title": string,',
    '    "hook": string,',
    '    "caption": string,',
    '    "script": string,',
    '    "scenes": [',
    '      { "time": string, "visual": string, "narration": string, "caption": string }',
    "    ]",
    "  }",
    "}",
    "작성 규칙:",
    "1. blog.body는 네이버 블로그용 정보성 홍보 글로 작성한다.",
    "2. blog.body 마지막 문단에는 행동 유도 링크를 자연스럽게 포함한다.",
    "3. instagram.caption은 인스타그램 피드 홍보문 형식으로 작성하고, 마지막에 CTA를 넣는다.",
    "4. threads.post는 짧고 강한 문제제기형 홍보 글로 작성한다.",
    "5. threads.follow_up_replies는 후속 댓글처럼 자연스럽게 연결되는 3개 문장으로 작성한다.",
    "6. youtube.description에는 영상 요약, 핵심 포인트, CTA 링크를 넣는다.",
    "7. shorts.script는 45초 내외 세로 영상 대본으로 작성한다.",
    "8. shorts.scenes는 5개 이상 7개 이하 장면으로 작성한다.",
    "9. 모든 채널 문구는 메인 키워드를 과장 없이 활용한다.",
    "10. 태그 배열에는 #을 넣지 않는다. 서버에서 포맷팅한다.",
  ].join("\n");
}

function normalizeCampaign(rawCampaign, input) {
  const baseTags = buildBaseTags(input);
  const blogTitle = normalizeText(rawCampaign?.blog?.title) || `${input.keyword} 실전 가이드`;
  const blogBody = normalizeText(rawCampaign?.blog?.body);
  const instagramCaption = normalizeText(rawCampaign?.instagram?.caption);
  const threadsPost = normalizeText(rawCampaign?.threads?.post);
  const youtubeDescription = normalizeText(rawCampaign?.youtube?.description);
  const shortsScript = normalizeText(rawCampaign?.shorts?.script);

  return {
    campaignAngle:
      normalizeText(rawCampaign?.campaign_angle) ||
      `${input.audience}를 위한 ${input.keyword} 중심 전환 캠페인`,
    blog: {
      title: blogTitle,
      body: ensureLink(blogBody, input.offerLink),
      naverTags: toNaverTags(rawCampaign?.blog?.naver_tags, baseTags),
      tistoryTags: toTistoryTags(rawCampaign?.blog?.tistory_tags, baseTags),
      fullText: buildBlogText(
        blogTitle,
        ensureLink(blogBody, input.offerLink),
        toNaverTags(rawCampaign?.blog?.naver_tags, baseTags),
        toTistoryTags(rawCampaign?.blog?.tistory_tags, baseTags),
      ),
    },
    instagram: {
      caption: ensureLink(instagramCaption, input.offerLink),
      hashtags: toNaverTags(rawCampaign?.instagram?.hashtags, baseTags),
      imageOverlay:
        normalizeText(rawCampaign?.instagram?.image_overlay) ||
        `${input.keyword}\n지금 바로 확인하세요`,
      fullText: buildInstagramText(
        ensureLink(instagramCaption, input.offerLink),
        toNaverTags(rawCampaign?.instagram?.hashtags, baseTags),
      ),
    },
    threads: {
      post: ensureLink(threadsPost, input.offerLink),
      followUpReplies: normalizeReplyList(rawCampaign?.threads?.follow_up_replies, input),
      fullText: buildThreadsText(
        ensureLink(threadsPost, input.offerLink),
        normalizeReplyList(rawCampaign?.threads?.follow_up_replies, input),
      ),
    },
    youtube: {
      title:
        normalizeText(rawCampaign?.youtube?.title) ||
        `${input.productName} | ${input.keyword} 제대로 활용하는 방법`,
      description: ensureLink(youtubeDescription, input.offerLink),
      tags: toTistoryTags(rawCampaign?.youtube?.tags, baseTags),
      thumbnailCopy:
        normalizeText(rawCampaign?.youtube?.thumbnail_copy) ||
        `${input.keyword}\n지금 바꿔야 하는 이유`,
      fullText: buildYoutubeText(
        normalizeText(rawCampaign?.youtube?.title) ||
          `${input.productName} | ${input.keyword} 제대로 활용하는 방법`,
        ensureLink(youtubeDescription, input.offerLink),
        toTistoryTags(rawCampaign?.youtube?.tags, baseTags),
        normalizeText(rawCampaign?.youtube?.thumbnail_copy) ||
          `${input.keyword}\n지금 바꿔야 하는 이유`,
      ),
    },
    shorts: {
      title:
        normalizeText(rawCampaign?.shorts?.title) ||
        `${input.keyword} 쇼츠 아이디어`,
      hook:
        normalizeText(rawCampaign?.shorts?.hook) ||
        `${input.audience}라면 이 변화부터 보셔야 합니다.`,
      caption: ensureLink(
        normalizeText(rawCampaign?.shorts?.caption),
        input.offerLink,
      ),
      script: ensureLink(shortsScript, input.offerLink),
      scenes: normalizeScenes(rawCampaign?.shorts?.scenes, input),
      fullText: buildShortsText(
        normalizeText(rawCampaign?.shorts?.title) ||
          `${input.keyword} 쇼츠 아이디어`,
        normalizeText(rawCampaign?.shorts?.hook) ||
          `${input.audience}라면 이 변화부터 보셔야 합니다.`,
        ensureLink(normalizeText(rawCampaign?.shorts?.caption), input.offerLink),
        ensureLink(shortsScript, input.offerLink),
        normalizeScenes(rawCampaign?.shorts?.scenes, input),
      ),
    },
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildBaseTags(input) {
  return [
    input.productName,
    input.keyword,
    input.audience,
    "전자칠판",
    "스마트교육",
    "업무효율",
    "디지털전환",
    "도입상담",
  ]
    .map((tag) => normalizeText(tag))
    .filter(Boolean)
    .map((tag) => tag.replace(/^#+/u, ""))
    .map((tag) => tag.replace(/\s+/gu, ""))
    .filter(Boolean)
    .slice(0, 15);
}

function toNaverTags(inputTags, baseTags) {
  const tags = Array.isArray(inputTags) ? inputTags : [];
  const cleaned = tags
    .map((tag) => normalizeText(tag))
    .filter(Boolean)
    .map((tag) => tag.replace(/^#+/u, ""))
    .map((tag) => tag.replace(/\s+/gu, ""));

  return Array.from(new Set([...cleaned, ...baseTags]))
    .slice(0, 15)
    .map((tag) => `#${tag}`);
}

function toTistoryTags(inputTags, baseTags) {
  const tags = Array.isArray(inputTags) ? inputTags : [];
  const cleaned = tags
    .map((tag) => normalizeText(tag))
    .filter(Boolean)
    .map((tag) => tag.replace(/^#+/u, ""))
    .map((tag) => tag.replace(/\s+/gu, ""));

  return Array.from(new Set([...cleaned, ...baseTags])).slice(0, 15);
}

function ensureLink(text, offerLink) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return `자세한 내용과 상담은 아래 링크에서 확인해 주세요.\n${offerLink}`;
  }

  if (normalized.includes(offerLink)) {
    return normalized;
  }

  return `${normalized}\n\n자세한 내용 확인 및 상담 링크: ${offerLink}`;
}

function normalizeReplyList(replies, input) {
  const replyList = Array.isArray(replies) ? replies : [];
  const cleaned = replyList
    .map((reply) => normalizeText(reply))
    .filter(Boolean)
    .slice(0, 3);

  if (cleaned.length === 3) {
    return cleaned;
  }

  return [
    `${input.keyword}를 실제 운영에 붙이면 어떤 변화가 생기는지 궁금하지 않으신가요?`,
    `${input.audience} 기준으로 바로 적용 가능한 포인트만 정리해드릴 수 있습니다.`,
    `상담 링크에서 빠르게 확인해 보세요: ${input.offerLink}`,
  ];
}

function normalizeScenes(scenes, input) {
  const sceneList = Array.isArray(scenes) ? scenes : [];
  const cleaned = sceneList
    .map((scene) => ({
      time: normalizeText(scene?.time),
      visual: normalizeText(scene?.visual),
      narration: normalizeText(scene?.narration),
      caption: normalizeText(scene?.caption),
    }))
    .filter((scene) => scene.time || scene.visual || scene.narration || scene.caption)
    .slice(0, 7);

  if (cleaned.length >= 5) {
    return cleaned;
  }

  return [
    {
      time: "0-5초",
      visual: `${input.audience}가 겪는 기존 문제 장면`,
      narration: `${input.audience}라면 이런 비효율을 이미 겪고 계실 겁니다.`,
      caption: "지금 방식, 계속 괜찮을까요?",
    },
    {
      time: "5-12초",
      visual: `${input.keyword}가 필요한 상황을 빠르게 보여주는 장면`,
      narration: `${input.keyword}는 단순한 유행이 아니라 실제 성과를 바꾸는 포인트입니다.`,
      caption: `${input.keyword}가 필요한 이유`,
    },
    {
      time: "12-22초",
      visual: `${input.productName} 핵심 장점 3가지 텍스트`,
      narration: `${input.productName}를 도입하면 속도, 집중도, 전달력이 같이 올라갑니다.`,
      caption: "핵심 장점 3가지",
    },
    {
      time: "22-35초",
      visual: "전후 비교 또는 사용 장면",
      narration: `실제 적용 장면만 봐도 왜 많은 현장에서 바꾸는지 바로 이해할 수 있습니다.`,
      caption: "적용 전후 비교",
    },
    {
      time: "35-45초",
      visual: "CTA와 링크 강조",
      narration: `지금 바로 링크에서 자세한 내용을 확인해 보세요.`,
      caption: "지금 확인하기",
    },
  ];
}

function buildBlogText(title, body, naverTags, tistoryTags) {
  return [
    title,
    "",
    body,
    "",
    `네이버 태그: ${naverTags.join(" ")}`,
    `티스토리 태그: ${tistoryTags.join(", ")}`,
  ].join("\n");
}

function buildInstagramText(caption, hashtags) {
  return [caption, "", hashtags.join(" ")].join("\n");
}

function buildThreadsText(post, followUpReplies) {
  return [
    post,
    "",
    "후속 리플 아이디어",
    ...followUpReplies.map((reply, index) => `${index + 1}. ${reply}`),
  ].join("\n");
}

function buildYoutubeText(title, description, tags, thumbnailCopy) {
  return [
    `제목: ${title}`,
    "",
    "설명:",
    description,
    "",
    `태그: ${tags.join(", ")}`,
    "",
    "썸네일 문구:",
    thumbnailCopy,
  ].join("\n");
}

function buildShortsText(title, hook, caption, script, scenes) {
  return [
    `제목: ${title}`,
    `훅: ${hook}`,
    "",
    "캡션:",
    caption,
    "",
    "대본:",
    script,
    "",
    "장면 구성:",
    ...scenes.map(
      (scene, index) =>
        `${index + 1}. [${scene.time}] ${scene.visual} | 내레이션: ${scene.narration} | 자막: ${scene.caption}`,
    ),
  ].join("\n");
}
