// 쇼츠 영상 생성 — 서버가 만들어준 장면별 배경 이미지 위에 자막·로고를 브라우저 캔버스에서
// 실시간으로 그리며 MediaRecorder(canvas.captureStream)로 녹화한다. 실제 영상 인코딩은 Node가
// 아니라 브라우저(Chromium)만 할 수 있어서 이 부분은 서버가 아니라 여기서 처리한다.

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${url}`));
    img.src = url;
  });
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

function drawCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function pickMimeType(withAudio) {
  const candidates = withAudio
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
}

// bgmFile(mp3/wav 등)을 디코딩해 영상 길이만큼 반복 재생되는 오디오 스트림으로 만든다.
// 영상보다 짧으면 자동으로 loop, 길면 영상 길이에서 잘린다.
async function buildBgmAudio(bgmFile, volume, durationSeconds) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  // 브라우저 autoplay 정책 때문에 컨텍스트가 suspended 상태로 생성될 수 있다 — 그대로 두면
  // 오디오 트랙이 샘플을 만들지 못해 MediaRecorder가 사실상 멈춘 것처럼 멈춰있게 된다.
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  const arrayBuffer = await bgmFile.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const dest = audioCtx.createMediaStreamDestination();
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(dest);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = true;
  source.connect(gainNode);
  source.start(0);
  source.stop(audioCtx.currentTime + durationSeconds);

  return {
    track: dest.stream.getAudioTracks()[0],
    cleanup: () => {
      try {
        source.stop();
      } catch {
        /* 이미 멈췄으면 무시 */
      }
      audioCtx.close();
    },
  };
}

// beats: [{ text, imageUrl }]  — 화면에 나올 순서대로.
// logoUrl이 있으면 우상단에 실제 로고를, 없으면 브랜드명 텍스트를 표시한다.
// bgmFile(선택) — 업로드한 배경음악 File을 영상 길이에 맞춰 반복 재생하며 함께 녹화한다.
export async function generateShortsVideo({
  beats,
  logoUrl,
  brandName,
  secondsPerBeat = 4,
  bgmFile,
  bgmVolume = 0.5,
  onProgress,
}) {
  onProgress?.("장면 이미지를 불러오는 중...");
  const images = await Promise.all(beats.map((b) => loadImage(b.imageUrl)));
  const logoImg = logoUrl ? await loadImage(logoUrl).catch(() => null) : null;

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const fps = 30;
  const durationSeconds = beats.length * secondsPerBeat;
  const totalFrames = durationSeconds * fps;

  const videoStream = canvas.captureStream(fps);
  let combinedStream = videoStream;
  let bgmCleanup = null;

  if (bgmFile) {
    onProgress?.("배경음악을 처리하는 중...");
    try {
      const { track, cleanup } = await buildBgmAudio(bgmFile, bgmVolume, durationSeconds);
      combinedStream = new MediaStream([...videoStream.getVideoTracks(), track]);
      bgmCleanup = cleanup;
    } catch {
      // 오디오 디코딩 실패 시 소리 없이 영상만이라도 만든다(형식 문제일 수 있음).
      combinedStream = videoStream;
    }
  }

  const mimeType = pickMimeType(!!bgmCleanup);
  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  onProgress?.(`영상을 렌더링하는 중... (약 ${durationSeconds}초 분량)`);

  return new Promise((resolve, reject) => {
    recorder.onerror = (e) => {
      bgmCleanup?.();
      reject(e.error || new Error("영상 녹화 중 오류가 발생했습니다."));
    };
    recorder.onstop = () => {
      bgmCleanup?.();
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
      const beatIndex = Math.min(beats.length - 1, Math.floor(frame / (secondsPerBeat * fps)));
      const beat = beats[beatIndex];

      drawCover(ctx, images[beatIndex], W, H);

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
