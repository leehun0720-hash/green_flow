// 카드뉴스 이미지 합성 — AI가 만든 배경(텍스트 없음) 위에 헤드카피·서브카피를 코드로 정확히 얹는다.
// 매뉴얼의 "Canva 브랜드 템플릿 1회 제작 후 텍스트만 교체" 방식을 그대로 따른다: 배경 1장을 생성해
// 카드 7장에 재사용하고, 텍스트만 카드마다 바뀐다. AI 이미지 생성 모델은 한글 텍스트를 안정적으로
// 그리지 못하므로(글자 깨짐 위험), 배경에는 절대 글자를 넣지 않고 텍스트는 항상 이 모듈이 그린다.

import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";

const SIZE = 1080; // 인스타그램 정사각형 피드 규격

// 흔히 설치되어 있는 한글 폰트 경로 후보 (OS별)
const FONT_CANDIDATES = [
  { path: "C:\\Windows\\Fonts\\malgun.ttf", alias: "gf-kr-regular" },
  { path: "C:\\Windows\\Fonts\\malgunbd.ttf", alias: "gf-kr-bold" },
  { path: "/System/Library/Fonts/Supplemental/AppleGothic.ttf", alias: "gf-kr-regular" },
  { path: "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", alias: "gf-kr-regular" },
  { path: "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", alias: "gf-kr-bold" },
  { path: "/usr/share/fonts/truetype/nanum/NanumGothic.ttf", alias: "gf-kr-regular" },
  { path: "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf", alias: "gf-kr-bold" },
];

let fontsReady = false;
let hasRegular = false;
let hasBold = false;

function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  for (const { path, alias } of FONT_CANDIDATES) {
    if (!fs.existsSync(path)) continue;
    const key = GlobalFonts.registerFromPath(path, alias);
    if (key) {
      if (alias === "gf-kr-regular") hasRegular = true;
      if (alias === "gf-kr-bold") hasBold = true;
    }
  }
  if (!hasRegular) {
    throw new Error(
      "카드뉴스 텍스트를 그릴 한글 폰트를 서버에서 찾지 못했습니다(Malgun Gothic/Noto Sans CJK/나눔고딕 중 하나가 필요합니다).",
    );
  }
  if (!hasBold) hasBold = false; // 굵게가 없으면 일반 폰트로 대체
}

function regularFont() {
  return "gf-kr-regular";
}
function boldFont() {
  return hasBold ? "gf-kr-bold" : "gf-kr-regular";
}

// 어절 단위 줄바꿈 — 한 어절이 너무 길면 글자 단위로도 쪼갠다.
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
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
    // 단어 하나가 maxWidth보다 길면 글자 단위로 강제 개행
    while (ctx.measureText(line).width > maxWidth && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function composeCard({ backgroundBuffer, headline, subcopy, cardIndex, totalCards, brandLabel, logoBuffer }) {
  ensureFonts();

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // 배경 — cover 방식으로 캔버스를 꽉 채운다
  const img = await loadImage(backgroundBuffer);
  const scale = Math.max(SIZE / img.width, SIZE / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh);

  // 하단 텍스트 가독성용 그라디언트 스크림
  const grad = ctx.createLinearGradient(0, SIZE * 0.32, 0, SIZE);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const padding = 72;
  const maxWidth = SIZE - padding * 2;
  const headlineLineHeight = 74;
  const subLineHeight = 44;

  ctx.font = `bold 58px "${boldFont()}"`;
  const headlineLines = wrapText(ctx, headline || "", maxWidth);

  let subLines = [];
  if (subcopy) {
    ctx.font = `34px "${regularFont()}"`;
    subLines = wrapText(ctx, subcopy, maxWidth);
  }

  // 바닥에서부터 위로 그린다: 서브카피 블록 → 간격 → 헤드카피 블록
  let cursorY = SIZE - padding;

  if (subLines.length) {
    ctx.font = `34px "${regularFont()}"`;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (let i = subLines.length - 1; i >= 0; i--) {
      ctx.fillText(subLines[i], padding, cursorY);
      cursorY -= subLineHeight;
    }
    cursorY -= 22;
  }

  ctx.font = `bold 58px "${boldFont()}"`;
  ctx.fillStyle = "#ffffff";
  for (let i = headlineLines.length - 1; i >= 0; i--) {
    ctx.fillText(headlineLines[i], padding, cursorY);
    cursorY -= headlineLineHeight;
  }

  // 카드 번호 (좌상단)
  ctx.font = `26px "${regularFont()}"`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${cardIndex}/${totalCards}`, padding, padding + 20);

  // 브랜드 로고(우상단) — 업로드된 로고가 있으면 실제 이미지를, 없으면 브랜드명 텍스트를 표시한다.
  if (logoBuffer) {
    const logo = await loadImage(logoBuffer);
    const maxLogoW = 130;
    const maxLogoH = 56;
    const logoScale = Math.min(maxLogoW / logo.width, maxLogoH / logo.height, 1);
    const lw = logo.width * logoScale;
    const lh = logo.height * logoScale;
    const lx = SIZE - padding - lw;
    const ly = padding - 6;
    const chipPad = 8;
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(lx - chipPad, ly - chipPad, lw + chipPad * 2, lh + chipPad * 2);
    ctx.drawImage(logo, lx, ly, lw, lh);
  } else if (brandLabel) {
    ctx.font = `bold 28px "${boldFont()}"`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(brandLabel, SIZE - padding, padding + 22);
    ctx.textAlign = "left";
  }

  return canvas.toBuffer("image/png");
}
