import { jsonResponse } from "../_lib/gemini.js";

export async function onRequestPost(context) {
  const { request } = context;

  let payload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      { error: "요청 본문이 올바른 JSON 형식이 아닙니다." },
      400,
    );
  }

  const audience = normalizeText(payload?.audience);
  const keyword = normalizeText(payload?.keyword);
  const productName = normalizeText(payload?.productName);
  const shorts = payload?.shorts;

  if (!shorts || !normalizeText(shorts?.script)) {
    return jsonResponse(
      { error: "쇼츠 대본이 있어야 영상 제작 패키지를 만들 수 있습니다." },
      400,
    );
  }

  const scenes = normalizeScenes(shorts?.scenes, audience, keyword, productName);
  const subtitleLines = buildSubtitleLines(scenes);
  const fileBase = slugify(`${productName}-${keyword}-${audience}` || "campaign");

  return jsonResponse({
    videoPackage: {
      fileBase,
      title: normalizeText(shorts?.title) || `${keyword} 쇼츠`,
      hook: normalizeText(shorts?.hook),
      voiceover: normalizeText(shorts?.script),
      subtitleSrt: buildSrt(subtitleLines),
      subtitleLines,
      scenePrompts: scenes.map((scene, index) => ({
        scene: index + 1,
        time: scene.time,
        prompt: `${scene.visual}. 화면 자막은 "${scene.caption}" 중심으로 배치.`,
      })),
      renderChecklist: [
        "세로 1080x1920 기준 캔버스를 준비합니다.",
        "scenePrompts를 기준으로 장면 이미지 또는 영상 클립을 수집합니다.",
        "voiceover를 TTS 또는 직접 녹음으로 제작합니다.",
        "subtitleSrt를 자막 파일로 저장합니다.",
        "ffmpeg 예시 명령을 사용해 자막과 오디오를 합칩니다.",
      ],
      ffmpegCommands: buildFfmpegCommands(fileBase),
    },
  });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeScenes(rawScenes, audience, keyword, productName) {
  const scenes = Array.isArray(rawScenes) ? rawScenes : [];
  const cleaned = scenes
    .map((scene) => ({
      time: normalizeText(scene?.time),
      visual: normalizeText(scene?.visual),
      narration: normalizeText(scene?.narration),
      caption: normalizeText(scene?.caption),
    }))
    .filter((scene) => scene.time || scene.visual || scene.narration || scene.caption);

  if (cleaned.length > 0) {
    return cleaned;
  }

  return [
    {
      time: "00:00-00:05",
      visual: `${audience}의 기존 문제 장면`,
      narration: `${audience}라면 이 문제를 이미 겪고 계실 겁니다.`,
      caption: "지금 방식, 계속 괜찮을까요?",
    },
    {
      time: "00:05-00:12",
      visual: `${keyword} 도입 장면`,
      narration: `${keyword}는 실제 운영 효율을 바꾸는 포인트입니다.`,
      caption: `${keyword}가 필요한 이유`,
    },
    {
      time: "00:12-00:20",
      visual: `${productName} 핵심 장점`,
      narration: `${productName}를 도입하면 전달력과 전환이 같이 올라갑니다.`,
      caption: "핵심 장점",
    },
  ];
}

function buildSubtitleLines(scenes) {
  return scenes.map((scene, index) => ({
    index: index + 1,
    start: toSrtTime(scene.time, "start"),
    end: toSrtTime(scene.time, "end"),
    text: scene.caption || scene.narration || scene.visual,
  }));
}

function buildSrt(lines) {
  return lines
    .map(
      (line) =>
        `${line.index}\n${line.start} --> ${line.end}\n${line.text}\n`,
    )
    .join("\n")
    .trim();
}

function buildFfmpegCommands(fileBase) {
  return {
    mergeAudioAndVideo: `ffmpeg -i ${fileBase}.mp4 -i ${fileBase}.wav -c:v copy -c:a aac -shortest ${fileBase}-muxed.mp4`,
    burnSubtitles: `ffmpeg -i ${fileBase}-muxed.mp4 -vf subtitles=${fileBase}.srt -c:a copy ${fileBase}-final.mp4`,
    exportPreviewFrame: `ffmpeg -i ${fileBase}-final.mp4 -vf "select=eq(n\\,30)" -vframes 1 ${fileBase}-thumb.jpg`,
  };
}

function toSrtTime(rangeText, edge) {
  const [startRaw = "00:00", endRaw = "00:05"] = rangeText.split("-");
  return `${normalizeClock(edge === "start" ? startRaw : endRaw)},000`;
}

function normalizeClock(value) {
  const parts = value.trim().split(":").map((part) => part.trim());

  if (parts.length === 2) {
    return `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }

  if (parts.length === 3) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
  }

  return "00:00:05";
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
