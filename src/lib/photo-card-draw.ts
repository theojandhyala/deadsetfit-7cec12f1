import { drawWordmark } from "./pr-card-draw";
import { spanLabel } from "./progress-photos";
import { formatWeight, type WeightUnit } from "./units";

export const PHOTO_CARD_W = 1080;
export const PHOTO_CARD_H = 1920;

export interface PhotoCardInput {
  /** Decoded images, in order. The caller loads them; canvas cannot await. */
  before: CanvasImageSource;
  now: CanvasImageSource;
  beforeDate: string;
  nowDate: string;
  daysApart: number;
  weightDeltaKg: number | null;
  unit: WeightUnit;
  displayName: string;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sourceSize(image: CanvasImageSource): { width: number; height: number } {
  const candidate = image as {
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  };
  return {
    width: candidate.naturalWidth ?? candidate.width ?? 1,
    height: candidate.naturalHeight ?? candidate.height ?? 1,
  };
}

/**
 * Draw an image to fill a box, cropping the overflow rather than squashing it.
 *
 * Check-in photos are whatever aspect the phone took them at. Stretching a
 * portrait shot into a different frame changes the shape of the body in it,
 * which on a before-and-after card is the one distortion that would make the
 * whole thing a lie.
 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const { width: sw, height: sh } = sourceSize(image);
  if (!sw || !sh) return;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  roundRect(ctx, x, y, w, h, 24);
  ctx.clip();
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/**
 * The before-and-after card.
 *
 * Composed inside y 200–1690: TikTok, Reels and Shorts overlay the top tabs and
 * the bottom caption strip, so anything outside that band is covered on the
 * feed — which is where this is meant to end up.
 */
export function drawPhotoCard(ctx: CanvasRenderingContext2D, input: PhotoCardInput) {
  const W = PHOTO_CARD_W;
  const H = PHOTO_CARD_H;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0506");
  bg.addColorStop(0.5, "#140809");
  bg.addColorStop(1, "#070405");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawWordmark(ctx, W / 2, 290, 78);

  ctx.textAlign = "center";
  ctx.font = "800 36px Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.letterSpacing = "6px";
  ctx.fillText(spanLabel(input.daysApart).toUpperCase(), W / 2, 372);
  ctx.letterSpacing = "0px";

  // ── The two frames ────────────────────────────────────────────
  const gap = 20;
  const paneW = (W - 120 - gap) / 2;
  const paneH = Math.round(paneW * (4 / 3));
  const paneY = 430;
  drawCover(ctx, input.before, 60, paneY, paneW, paneH);
  drawCover(ctx, input.now, 60 + paneW + gap, paneY, paneW, paneH);

  const label = (text: string, date: string, cx: number) => {
    ctx.textAlign = "center";
    ctx.font = "900 40px 'Arial Black', Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText(text, cx, paneY + paneH + 62);
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText(date.slice(0, 10), cx, paneY + paneH + 104);
  };
  label("BEFORE", input.beforeDate, 60 + paneW / 2);
  label("NOW", input.nowDate, 60 + paneW + gap + paneW / 2);

  // ── Bodyweight change ─────────────────────────────────────────
  // Fixed positions from here down rather than an accumulating cursor: the
  // chip is optional, and a stacking layout leaves the athlete's name floating
  // in the middle of nothing on the cards that have no bodyweight logged.
  const chipY = paneY + paneH + 186;
  if (input.weightDeltaKg !== null && input.weightDeltaKg !== 0) {
    const gained = input.weightDeltaKg > 0;
    const text = `${gained ? "+" : ""}${formatWeight(input.weightDeltaKg, input.unit)}`;
    ctx.font = "800 42px Arial, sans-serif";
    const chipW = ctx.measureText(text).width + 96;
    const chipX = (W - chipW) / 2;
    ctx.fillStyle = gained ? "rgba(230,50,34,0.16)" : "rgba(34,197,94,0.16)";
    roundRect(ctx, chipX, chipY, chipW, 96, 48);
    ctx.fill();
    ctx.strokeStyle = gained ? "rgba(230,50,34,0.65)" : "rgba(34,197,94,0.65)";
    ctx.lineWidth = 3;
    roundRect(ctx, chipX, chipY, chipW, 96, 48);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = gained ? "#ff6a5a" : "#4ade80";
    ctx.fillText(text, W / 2, chipY + 62);
  }

  // ── Athlete and CTA ───────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(150, 1450);
  ctx.lineTo(W - 150, 1450);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "900 52px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(input.displayName.toUpperCase().slice(0, 22), W / 2, 1524);

  ctx.font = "900 68px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("PUT IN THE WORK.", W / 2, 1618);
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.letterSpacing = "4px";
  ctx.fillText("DEADSETFIT.ORG", W / 2, 1672);
  ctx.letterSpacing = "0px";
}
