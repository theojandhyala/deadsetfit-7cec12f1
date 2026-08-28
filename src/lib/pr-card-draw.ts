import type { PRShareDetails } from "./grit-events";
import { prHeadline } from "./pr-share";
import type { WeightUnit } from "./units";

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
 * The DEADSET lockup, exactly as the app's top bar draws it: a red rule, then
 * DEAD in bone and SET in red, italic, with no gap between the two words.
 *
 * The gap matters. The previous version placed each half at a fixed offset
 * from the centre with `textAlign = "center"`, so the words drifted apart by
 * however wide they happened to measure and the card read "DEAD  SET" — a
 * different brand from the one in the app. Measuring and butting them together
 * is the only way the lockup survives a font substitution.
 */
export function drawWordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseline: number,
  size: number,
) {
  const font = `italic 900 ${size}px 'Arial Black', Arial, sans-serif`;
  const prevAlign = ctx.textAlign;
  ctx.font = font;
  const deadW = ctx.measureText("DEAD").width;
  const setW = ctx.measureText("SET").width;
  const barW = Math.round(size * 0.07);
  const barGap = Math.round(size * 0.18);
  const total = barW + barGap + deadW + setW;
  let x = cx - total / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = "#e63222";
  ctx.fillRect(x, baseline - size * 0.78, barW, size * 0.82);
  x += barW + barGap;
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("DEAD", x, baseline);
  ctx.fillStyle = "#e63222";
  ctx.fillText("SET", x + deadW, baseline);
  ctx.textAlign = prevAlign;
}

/** A label above a value, for the stat strip along the bottom of the card. */
function statColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  ctx.textAlign = "center";
  ctx.font = "800 30px Arial, sans-serif";
  ctx.fillStyle = "#7c6b66";
  ctx.fillText(label, x, y);
  ctx.font = "900 52px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(value, x, y + 62);
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
    unit,
    date = new Date(),
  }: {
    pr: PRShareDetails;
    displayName: string;
    username?: string | null;
    unit: WeightUnit;
    date?: Date;
  },
) {
  const W = PR_CARD_W;
  const H = PR_CARD_H;
  const headline = prHeadline(pr, unit);

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

  // ── Frame ─────────────────────────────────────────────────────
  // A hairline inset border and corner ticks. Cheap to draw, and the
  // difference between "a screenshot" and "a card somebody designed".
  ctx.strokeStyle = "rgba(230,50,34,0.22)";
  ctx.lineWidth = 3;
  roundRect(ctx, 48, 176, W - 96, 1514, 44);
  ctx.stroke();
  ctx.strokeStyle = "rgba(230,50,34,0.85)";
  ctx.lineWidth = 8;
  for (const [cx, cy, dx, dy] of [
    [48, 220, 0, -1],
    [W - 48, 220, 0, -1],
    [48, 1646, 0, 1],
    [W - 48, 1646, 0, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + dy * 44);
    ctx.stroke();
  }

  // ── Wordmark ──────────────────────────────────────────────────
  drawWordmark(ctx, W / 2, 300, 86);

  ctx.textAlign = "center";

  // ── Record label ──────────────────────────────────────────────
  ctx.font = "800 40px Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.letterSpacing = "6px";
  ctx.fillText("NEW PERSONAL RECORD", W / 2, 396);
  ctx.letterSpacing = "0px";

  // ── Exercise ──────────────────────────────────────────────────
  const exercise = pr.exercise.toUpperCase();
  fitText(ctx, exercise, (s) => `900 ${s}px 'Arial Black', Arial, sans-serif`, 88, W - 180, 42);
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(exercise, W / 2, 490);

  // ── The number ────────────────────────────────────────────────
  fitText(
    ctx,
    headline.value,
    (s) => `900 ${s}px 'Arial Black', Arial, sans-serif`,
    400,
    W - 200,
    160,
  );
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(230,50,34,0.7)";
  ctx.shadowBlur = 70;
  ctx.fillText(headline.value, W / 2, 880);
  ctx.shadowBlur = 0;

  // Unit
  ctx.font = "900 78px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.fillText(headline.unit, W / 2, 966);

  // Rep context for loaded lifts (bodyweight already reads as reps)
  if (headline.repLine) {
    ctx.font = "700 46px Arial, sans-serif";
    ctx.fillStyle = "#9a8a84";
    ctx.fillText(headline.repLine, W / 2, 1030);
  }

  // ── Delta chip: the actual brag ───────────────────────────────
  if (headline.delta) {
    ctx.font = "800 42px Arial, sans-serif";
    const chipW = ctx.measureText(headline.delta).width + 76;
    const chipH = 92;
    const chipX = (W - chipW) / 2;
    const chipY = headline.repLine ? 1070 : 1016;
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

  // ── Stat strip ────────────────────────────────────────────────
  // The old card left ~350px of empty gradient here, which is most of why it
  // read as a template with a number dropped into it.
  const stripY = 1268;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, stripY - 58);
  ctx.lineTo(W - 120, stripY - 58);
  ctx.stroke();

  const columns: [string, string][] = [
    ["BEATEN", headline.previousBest ?? "FIRST"],
    ["REPS", pr.reps > 0 ? String(pr.reps) : "—"],
    [
      "SET ON",
      date.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase(),
    ],
  ];
  columns.forEach(([label, value], i) => {
    statColumn(ctx, W / 2 + (i - 1) * 300, stripY, label, value);
  });

  ctx.beginPath();
  ctx.moveTo(120, stripY + 104);
  ctx.lineTo(W - 120, stripY + 104);
  ctx.stroke();

  // ── Athlete ───────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.font = "900 56px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(displayName.toUpperCase().slice(0, 22), W / 2, 1452);
  if (username) {
    ctx.font = "600 38px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText(`@${username}`, W / 2, 1504);
  }

  // ── CTA ───────────────────────────────────────────────────────
  ctx.font = "900 76px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("BEAT IT.", W / 2, 1596);
  ctx.font = "700 36px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.letterSpacing = "4px";
  ctx.fillText("DEADSETFIT.ORG", W / 2, 1650);
  ctx.letterSpacing = "0px";
}
