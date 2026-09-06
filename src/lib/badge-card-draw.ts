import { RARITY_COLOR, type Achievement } from "./achievements";

export const BADGE_CARD_W = 1080;
export const BADGE_CARD_H = 1920;

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
 * Paints the 9:16 badge-unlock card.
 *
 * Composed between y≈260 and y≈1660: TikTok, Reels and Shorts overlay the top
 * tabs and the bottom caption strip, so anything outside that band — the CTA
 * especially — is hidden on the feed.
 */
export function drawBadgeCard(
  ctx: CanvasRenderingContext2D,
  {
    badge,
    displayName,
    username,
    unlockedCount,
    totalCount,
  }: {
    badge: Achievement;
    displayName?: string;
    username?: string | null;
    unlockedCount?: number;
    totalCount?: number;
  },
) {
  const W = BADGE_CARD_W;
  const H = BADGE_CARD_H;
  const accent = RARITY_COLOR[badge.rarity];

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0506");
  bg.addColorStop(0.5, "#16090a");
  bg.addColorStop(1, "#070405");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // The glow takes the badge's rarity colour, so a legendary reads differently
  // at a glance from a common one.
  const glow = ctx.createRadialGradient(W / 2, 830, 80, W / 2, 830, 700);
  glow.addColorStop(0, `${accent}88`);
  glow.addColorStop(0.45, `${accent}22`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";

  // Wordmark
  ctx.font = "italic 900 84px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("DEAD", W / 2 - 96, 260);
  ctx.fillStyle = "#e63222";
  ctx.fillText("SET", W / 2 + 138, 260);

  ctx.font = "800 44px Arial, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("BADGE UNLOCKED", W / 2, 430);

  // The emblem. The disc is deliberately lighter than the page: the icon sits
  // on top of it, and a near-black disc leaves a dark glyph almost invisible.
  const disc = ctx.createRadialGradient(W / 2, 690, 20, W / 2, 720, 200);
  disc.addColorStop(0, "rgba(255,255,255,0.20)");
  disc.addColorStop(0.7, `${accent}33`);
  disc.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.beginPath();
  ctx.arc(W / 2, 720, 200, 0, Math.PI * 2);
  ctx.fillStyle = disc;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.font = "220px Arial";
  ctx.fillText(badge.icon, W / 2, 800);

  // Name
  fitText(ctx, badge.label, (s) => `900 ${s}px 'Arial Black', Arial, sans-serif`, 104, W - 140, 44);
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(badge.label, W / 2, 1050);

  ctx.font = "600 42px Arial, sans-serif";
  ctx.fillStyle = "#9a8a84";
  ctx.fillText(badge.desc, W / 2, 1120);

  // Rarity chip
  ctx.font = "800 38px Arial, sans-serif";
  const chipW = ctx.measureText(badge.rarity).width + 76;
  const chipX = (W - chipW) / 2;
  ctx.fillStyle = `${accent}28`;
  roundRect(ctx, chipX, 1170, chipW, 84, 42);
  ctx.fill();
  ctx.strokeStyle = `${accent}aa`;
  ctx.lineWidth = 3;
  roundRect(ctx, chipX, 1170, chipW, 84, 42);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillText(badge.rarity, W / 2, 1224);

  if (unlockedCount != null && totalCount) {
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText(`${unlockedCount} of ${totalCount} badges earned`, W / 2, 1306);
  }

  if (displayName) {
    ctx.font = "800 52px Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText(displayName.toUpperCase().slice(0, 22), W / 2, 1400);
    if (username) {
      ctx.font = "600 38px Arial, sans-serif";
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText(`@${username}`, W / 2, 1454);
    }
  }

  ctx.fillStyle = `${accent}8c`;
  ctx.fillRect(W / 2 - 120, 1510, 240, 3);
  ctx.font = "900 72px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("EARN YOURS.", W / 2, 1595);
  ctx.font = "700 40px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText("DEADSETFIT.ORG", W / 2, 1658);
}
