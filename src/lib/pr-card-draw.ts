import type { PRShareDetails } from "./grit-events";
import { prHeadline } from "./pr-share";

export const PR_CARD_W = 1080;
export const PR_CARD_H = 1920;

/** Shrink the font until the text fits `maxWidth`, so long lift names never clip. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  startSize: number,
  maxWidth: number,
  minSize: number,
) {
  let size = startSize;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4;
    ctx.font = font(size);
  }
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

/**
 * Paints the 9:16 PR card. Kept out of the component so the exact pixels that
 * ship can be rendered and eyeballed by a screenshot harness — a card that gets
 * posted publicly should never be shipped unseen.
 *
 * Everything is composed between y≈260 and y≈1660. TikTok, Reels and Shorts
 * overlay the top tabs and the bottom caption/username strip, so anything
 * outside that band — the CTA especially — is hidden on the feed.
 */
export function drawPRCard(
  ctx: CanvasRenderingContext2D,
  {
    pr,
    displayName,
    username,
  }: { pr: PRShareDetails; displayName: string; username?: string | null },
) {
  const W = PR_CARD_W;
  const H = PR_CARD_H;
  const headline = prHeadline(pr);

  // ── Background ────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0506");
  bg.addColorStop(0.5, "#16090a");
  bg.addColorStop(1, "#070405");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow behind the number — this is the hero of the frame
  const glow = ctx.createRadialGradient(W / 2, 860, 80, W / 2, 860, 700);
  glow.addColorStop(0, "rgba(230,50,34,0.55)");
  glow.addColorStop(0.45, "rgba(230,50,34,0.16)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Grain
  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";

  // ── Wordmark ──────────────────────────────────────────────────
  ctx.font = "italic 900 84px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("DEAD", W / 2 - 96, 260);
  ctx.fillStyle = "#e63222";
  ctx.fillText("SET", W / 2 + 138, 260);

  // ── Record label ──────────────────────────────────────────────
  ctx.font = "800 44px Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.fillText("NEW PERSONAL RECORD", W / 2, 430);

  // ── Exercise ──────────────────────────────────────────────────
  const exercise = pr.exercise.toUpperCase();
  fitText(ctx, exercise, (s) => `900 ${s}px 'Arial Black', Arial, sans-serif`, 92, W - 140, 44);
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(exercise, W / 2, 540);

  // ── The number ────────────────────────────────────────────────
  fitText(
    ctx,
    headline.value,
    (s) => `900 ${s}px 'Arial Black', Arial, sans-serif`,
    380,
    W - 200,
    160,
  );
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(230,50,34,0.7)";
  ctx.shadowBlur = 70;
  ctx.fillText(headline.value, W / 2, 960);
  ctx.shadowBlur = 0;

  // Unit
  ctx.font = "800 76px Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.fillText(headline.unit, W / 2, 1050);

  // Rep context for loaded lifts (bodyweight already reads as reps)
  if (headline.repLine) {
    ctx.font = "700 46px Arial, sans-serif";
    ctx.fillStyle = "#9a8a84";
    ctx.fillText(headline.repLine, W / 2, 1128);
  }

  // ── Delta chip: the actual brag ───────────────────────────────
  if (headline.delta) {
    ctx.font = "800 42px Arial, sans-serif";
    const chipW = ctx.measureText(headline.delta).width + 76;
    const chipH = 92;
    const chipX = (W - chipW) / 2;
    const chipY = headline.repLine ? 1180 : 1120;
    ctx.fillStyle = "rgba(230,50,34,0.16)";
    roundRect(ctx, chipX, chipY, chipW, chipH, 46);
    ctx.fill();
    ctx.strokeStyle = "rgba(230,50,34,0.65)";
    ctx.lineWidth = 3;
    roundRect(ctx, chipX, chipY, chipW, chipH, 46);
    ctx.stroke();
    ctx.fillStyle = "#ff6a5a";
    ctx.fillText(headline.delta, W / 2, chipY + 60);
  }

  // ── Athlete ───────────────────────────────────────────────────
  ctx.font = "800 52px Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(displayName.toUpperCase().slice(0, 22), W / 2, 1370);
  if (username) {
    ctx.font = "600 38px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText(`@${username}`, W / 2, 1428);
  }

  // ── CTA ───────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(230,50,34,0.55)";
  ctx.fillRect(W / 2 - 120, 1500, 240, 3);
  ctx.font = "900 72px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("BEAT IT.", W / 2, 1590);
  ctx.font = "700 40px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText("DEADSETFIT.ORG", W / 2, 1655);
}
