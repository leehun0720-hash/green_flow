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

// beats: [{ text, imageUrl }]  — 화면에 나올 순서대로.
// logoUrl이 있으면 우상단에 실제 로고를, 없으면 브랜드명 텍스트를 표시한다.
export async function generateShortsVideo({ beats, logoUrl, brandName, secondsPerBeat = 4, onProgress }) {
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
  const totalFrames = beats.length * secondsPerBeat * fps;

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  onProgress?.(`영상을 렌더링하는 중... (약 ${beats.length * secondsPerBeat}초 분량)`);

  return new Promise((resolve, reject) => {
    recorder.onerror = (e) => reject(e.error || new Error("영상 녹화 중 오류가 발생했습니다."));
    recorder.onstop = () => {
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
