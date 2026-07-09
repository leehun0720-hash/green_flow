// 브랜드 로고 저장/조회 — 카드뉴스·블로그 대표 이미지에 실제 로고를 합성하기 위해 사용한다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND_DIR = path.join(__dirname, "..", "data", "branding");
const LOGO_PATH = path.join(BRAND_DIR, "logo.png");

if (!fs.existsSync(BRAND_DIR)) fs.mkdirSync(BRAND_DIR, { recursive: true });

export function hasLogo() {
  return fs.existsSync(LOGO_PATH);
}

export function getLogoBuffer() {
  return hasLogo() ? fs.readFileSync(LOGO_PATH) : null;
}

// data URL(base64)로 받은 로고 이미지를 PNG로 정규화하고(최대 변 600px) 저장한다.
export async function saveLogo(dataUrl) {
  const match = /^data:image\/[a-zA-Z+.-]+;base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("올바른 이미지 파일이 아닙니다.");
  const raw = Buffer.from(match[1], "base64");
  const img = await loadImage(raw);
  const maxDim = 600;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  fs.writeFileSync(LOGO_PATH, canvas.toBuffer("image/png"));
}

export function deleteLogo() {
  if (hasLogo()) fs.unlinkSync(LOGO_PATH);
}

// 생성된 이미지 위에 로고를 워터마크처럼 합성한다(블로그 대표 이미지용).
export async function stampLogo(baseBuffer, logoBuffer, { corner = "bottom-right", margin = 28, maxWidth = 160 } = {}) {
  const base = await loadImage(baseBuffer);
  const logo = await loadImage(logoBuffer);
  const canvas = createCanvas(base.width, base.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(base, 0, 0);

  const scale = Math.min(maxWidth / logo.width, (base.height * 0.16) / logo.height, 1);
  const lw = logo.width * scale;
  const lh = logo.height * scale;

  let x, y;
  if (corner === "top-right") { x = base.width - margin - lw; y = margin; }
  else if (corner === "top-left") { x = margin; y = margin; }
  else if (corner === "bottom-left") { x = margin; y = base.height - margin - lh; }
  else { x = base.width - margin - lw; y = base.height - margin - lh; }

  const pad = 10;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x - pad, y - pad, lw + pad * 2, lh + pad * 2);
  ctx.drawImage(logo, x, y, lw, lh);

  return canvas.toBuffer("image/png");
}
