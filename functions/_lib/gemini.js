const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function requestGemini(env, prompt, options = {}) {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. Cloudflare Pages 설정을 확인해 주세요.",
    );
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  if (options.jsonMode) {
    requestBody.generationConfig = {
      responseMimeType: "application/json",
    };
  }

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 호출에 실패했습니다.\n${errorText}`);
  }

  return response.json();
}

export function extractGeminiText(payload) {
  if (!Array.isArray(payload?.candidates)) {
    return "";
  }

  return payload.candidates
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function parseGeminiJson(payload) {
  const text = extractGeminiText(payload);

  if (!text) {
    throw new Error("Gemini 응답에서 본문 텍스트를 추출하지 못했습니다.");
  }

  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}$/u);

    if (!jsonMatch) {
      throw new Error("Gemini 응답을 JSON으로 해석하지 못했습니다.");
    }

    return JSON.parse(jsonMatch[0]);
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
