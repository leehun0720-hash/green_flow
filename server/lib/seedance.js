// 쇼츠 영상용 장면 클립 생성 — ByteDance Seedance 2.0 (fal.ai 경유)
// 정적 배경 이미지 대신 실제 AI 생성 영상 클립을 장면 배경으로 사용한다.
// 자막·로고·내레이션·BGM 합성은 여전히 브라우저(shortsVideo.js)에서 처리하므로,
// 여기서는 소리 없는 순수 배경 영상만 만든다(오디오는 어차피 canvas.captureStream에
// 잡히지 않고, 우리가 직접 내레이션/BGM을 믹싱하기 때문).
import { fal } from "@fal-ai/client";
import { getSecret } from "./secrets.js";

const MODEL = "bytedance/seedance-2.0/text-to-video";

function configureFal() {
  const apiKey = getSecret("FAL_KEY");
  if (!apiKey) {
    throw new Error(
      "FAL_KEY가 설정되지 않았습니다. fal.ai에서 발급받은 키를 설정 화면 → API 키 관리에 입력하세요.",
    );
  }
  fal.config({ credentials: apiKey });
}

// durationSeconds에 가장 가까운 Seedance 지원 길이(4~15초, 정수)로 맞춘다.
function clampDuration(durationSeconds) {
  const rounded = Math.round(durationSeconds || 4);
  return String(Math.min(15, Math.max(4, rounded)));
}

// prompt로 세로형(9:16) 무음 영상 클립 1개를 생성해 Buffer(mp4)로 반환한다.
export async function generateVideoClip({ prompt, durationSeconds }) {
  configureFal();
  const result = await fal.subscribe(MODEL, {
    input: {
      prompt,
      resolution: "720p",
      duration: clampDuration(durationSeconds),
      aspect_ratio: "9:16",
      generate_audio: false,
    },
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("Seedance 응답에서 영상 URL을 찾을 수 없습니다.");
  }
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`생성된 영상 다운로드 실패 (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}
