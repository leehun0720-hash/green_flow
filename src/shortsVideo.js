// 쇼츠 영상 생성 — 서버(Seedance 2.0)가 만들어준 장면별 배경 "영상 클립" 위에 자막·로고를
// 브라우저 캔버스에서 실시간으로 그리며 MediaRecorder(canvas.captureStream)로 다시 녹화한다.
// 내레이션·배경음악은 하나의 AudioContext 안에서 믹싱해야 MediaRecorder가 소리 하나로 정확히
// 녹화한다(오디오 트랙을 여러 개 넘기면 브라우저가 알아서 섞어주지 않는다).

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true; // Seedance 배경 클립은 소리를 쓰지 않는다(내레이션·BGM을 따로 믹싱)
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error(`영상 클립을 불러오지 못했습니다: ${url}`));
    video.src = url;
  });
}

// 내레이션 클립의 실제 길이만 알아야 할 때(장면별 노출 시간 계산용) 쓰는 가벼운 헬퍼.
export async function getAudioDuration(url) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    return buffer.duration;
  } finally {
    audioCtx.close();
  }
}

async function loadAudioBuffer(audioCtx, url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return audioCtx.decodeAudioData(arrayBuffer);
}

// 어절 단위 줄바꿈 — cardCompose.js의 wrapText와 동일한 규칙을 캔버스 2D 컨텍스트용으로 옮긴 것.
function wrapCanvasText(ctx, text, maxWidth) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCover(ctx, media, mediaW, mediaH, w, h) {
  const scale = Math.max(w / mediaW, h / mediaH);
  const dw = mediaW * scale;
  const dh = mediaH * scale;
  ctx.drawImage(media, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function pickMimeType(withAudio) {
  const candidates = withAudio
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
}

// beats: [{ text, videoUrl }]  — videoUrl은 Seedance가 생성한 무음 배경 영상 클립.
// logoUrl이 있으면 우상단에 실제 로고를, 없으면 브랜드명 텍스트를 표시한다.
// narrationClipUrls(선택) — beats와 같은 길이의 음성 파일 URL 배열. 있으면 각 장면의 노출 시간이
//   해당 음성 길이에 맞춰 자동으로 늘어난다(없으면 secondsPerBeat 고정 길이 사용).
// bgmFile(선택) — 업로드한 배경음악 File을 전체 영상 길이에 맞춰 반복 재생하며 함께 녹화한다.
//   내레이션이 있으면 방해되지 않도록 볼륨을 자동으로 더 낮춘다.
export async function generateShortsVideo({
  beats,
  logoUrl,
  brandName,
  secondsPerBeat = 4,
  narrationClipUrls,
  bgmFile,
  bgmVolume = 0.5,
  onProgress,
}) {
  onProgress?.("장면 영상 클립을 불러오는 중...");
  const videos = await Promise.all(beats.map((b) => loadVideo(b.videoUrl)));
  const logoImg = logoUrl
    ? await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("로고를 불러오지 못했습니다."));
        img.src = logoUrl;
      }).catch(() => null)
    : null;

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const fps = 30;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  // 브라우저 autoplay 정책 때문에 컨텍스트가 suspended 상태로 생성될 수 있다 — 그대로 두면
  // 오디오 트랙이 샘플을 만들지 못해 MediaRecorder가 사실상 멈춘 것처럼 멈춰있게 된다.
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  const dest = audioCtx.createMediaStreamDestination();
  let hasAudio = false;

  // 내레이션이 있으면 각 클립의 실제 길이로 장면별 노출 시간을 정한다(없으면 고정 길이).
  let beatDurations = beats.map(() => secondsPerBeat);
  if (narrationClipUrls) {
    onProgress?.("내레이션 음성을 불러오는 중...");
    const narrationBuffers = await Promise.all(narrationClipUrls.map((url) => loadAudioBuffer(audioCtx, url)));
    beatDurations = narrationBuffers.map((buf) => Math.max(2.2, buf.duration + 0.6));

    const narrationGain = audioCtx.createGain();
    narrationGain.gain.value = 1;
    narrationGain.connect(dest);
    let offset = 0;
    narrationBuffers.forEach((buf, i) => {
      const source = audioCtx.createBufferSource();
      source.buffer = buf;
      source.connect(narrationGain);
      source.start(audioCtx.currentTime + offset);
      offset += beatDurations[i];
    });
    hasAudio = true;
  }

  const totalDuration = beatDurations.reduce((a, b) => a + b, 0);

  if (bgmFile) {
    onProgress?.("배경음악을 처리하는 중...");
    try {
      const arrayBuffer = await bgmFile.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const gainNode = audioCtx.createGain();
      // 내레이션이 함께 있으면 음성이 묻히지 않도록 배경음악 볼륨을 한 번 더 깎는다.
      gainNode.gain.value = narrationClipUrls ? Math.min(bgmVolume, 0.25) : bgmVolume;
      gainNode.connect(dest);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(gainNode);
      source.start(0);
      source.stop(audioCtx.currentTime + totalDuration);
      hasAudio = true;
    } catch {
      // 디코딩 실패 시 소리 없이 영상만이라도 만든다(형식 문제일 수 있음).
    }
  }

  // 누적 프레임 경계 — 현재 frame이 몇 번째 장면(beat)에 속하는지 빠르게 찾기 위함.
  const beatFrameBounds = [];
  let acc = 0;
  for (const d of beatDurations) {
    acc += d * fps;
    beatFrameBounds.push(acc);
  }
  const totalFrames = Math.round(totalDuration * fps);

  const videoStream = canvas.captureStream(fps);
  const combinedStream = hasAudio
    ? new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()])
    : videoStream;

  const mimeType = pickMimeType(hasAudio);
  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  onProgress?.(`영상을 렌더링하는 중... (약 ${Math.round(totalDuration)}초 분량)`);

  let currentBeatIndex = -1;

  return new Promise((resolve, reject) => {
    recorder.onerror = (e) => {
      audioCtx.close();
      reject(e.error || new Error("영상 녹화 중 오류가 발생했습니다."));
    };
    recorder.onstop = () => {
      audioCtx.close();
      videos.forEach((v) => v.pause());
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(URL.createObjectURL(blob));
    };

    recorder.start();

    let frame = 0;
    const drawFrame = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }
      let beatIndex = beatFrameBounds.findIndex((bound) => frame < bound);
      if (beatIndex === -1) beatIndex = beats.length - 1;
      const beat = beats[beatIndex];
      const videoEl = videos[beatIndex];

      // 새 장면으로 넘어가면 이전 클립은 멈추고 새 클립을 처음부터 재생한다.
      if (beatIndex !== currentBeatIndex) {
        if (currentBeatIndex >= 0) videos[currentBeatIndex].pause();
        videoEl.currentTime = 0;
        videoEl.play().catch(() => {});
        currentBeatIndex = beatIndex;
      }

      drawCover(ctx, videoEl, videoEl.videoWidth || W, videoEl.videoHeight || H, W, H);

      // 하단부 자막 가독성용 그라디언트 스크림 (카드뉴스와 동일한 톤)
      const grad = ctx.createLinearGradient(0, H * 0.4, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 자막
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px Pretendard, sans-serif";
      ctx.textAlign = "center";
      const lines = wrapCanvasText(ctx, beat.text, W - 160);
      const lineHeight = 78;
      let ty = H - 220 - (lines.length - 1) * lineHeight;
      lines.forEach((ln) => {
        ctx.fillText(ln, W / 2, ty);
        ty += lineHeight;
      });

      // 장면 번호 (좌상단)
      ctx.font = "28px Pretendard, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "left";
      ctx.fillText(`${beatIndex + 1}/${beats.length}`, 48, 70);

      // 브랜드 로고/텍스트 (우상단)
      if (logoImg) {
        const lw = 96;
        const lh = (logoImg.height / logoImg.width) * lw;
        ctx.drawImage(logoImg, W - lw - 48, 36, lw, lh);
      } else if (brandName) {
        ctx.font = "bold 30px Pretendard, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.textAlign = "right";
        ctx.fillText(brandName, W - 48, 70);
      }

      frame++;
      setTimeout(drawFrame, 1000 / fps);
    };
    drawFrame();
  });
}
