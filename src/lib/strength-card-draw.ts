import { BODY_CONTENT, MUSCLE_SHAPES, bodySilhouette } from "./body-shapes";
import { TIER_COLOR, TIERS, type MuscleGrade, type StrengthTier } from "./strength-grades";
import type { MuscleGroup } from "./types";

export const STRENGTH_CARD_W = 1080;
export const STRENGTH_CARD_H = 1920;

/** Anatomical regions belonging to each graded muscle group. */
const GROUP_REGIONS: Record<string, string[]> = {
  CHEST: ["chest", "upper-chest"],
  BACK: ["lats", "back", "mid-back", "upper-back", "traps", "rotator-cuff"],
  LEGS: ["quads", "hamstrings", "glutes", "calves", "hip-flexors"],
  SHOULDERS: ["front-delts", "side-delts", "rear-delts", "shoulders"],
  ARMS: ["biceps", "triceps", "forearms", "brachialis"],
  CORE: ["core", "obliques"],
};

/** Aspect of the drawing itself, not of the viewBox it sits in. */
const BODY_ASPECT = BODY_CONTENT.width / BODY_CONTENT.height;

export interface StrengthCardInput {
  start: MuscleGrade[];
  now: MuscleGrade[];
  tier: StrengthTier;
  displayName: string;
  sinceLabel: string;
}

function colorsFor(muscles: MuscleGrade[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const muscle of muscles) {
    const color = TIER_COLOR[muscle.tier];
    for (const region of GROUP_REGIONS[muscle.muscle as MuscleGroup] ?? []) map.set(region, color);
  }
  return map;
}

/** Shrink until it fits, so a long name never runs off the card. */
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
    size -= 3;
    ctx.font = font(size);
  }
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  side: "f" | "b",
  colors: Map<string, string>,
  x: number,
  y: number,
  height: number,
) {
  // Scale and offset by the drawing's own bounds so the body fills the box it
  // is handed rather than floating inside the viewBox's padding.
  const scale = height / BODY_CONTENT.height;
  ctx.save();
  ctx.translate(x - BODY_CONTENT.x * scale, y - BODY_CONTENT.y * scale);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#141414";
  ctx.strokeStyle = "#3a3a3a";
  ctx.lineWidth = 1.4;
  const outline = new Path2D(bodySilhouette());
  ctx.fill(outline);
  ctx.stroke(outline);

  for (const [region, shape] of Object.entries(MUSCLE_SHAPES)) {
    for (const d of shape[side] ?? []) {
      const path = new Path2D(d);
      ctx.fillStyle = colors.get(region) ?? "#242424";
      ctx.fill(path);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 0.6;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

/**
 * Paint the strength card.
 *
 * Split out of the component so it can be rendered — and looked at — outside
 * React. A canvas that is only ever drawn inside a mounted component is a
 * canvas nobody checks until a user posts a broken one.
 */
export function drawStrengthCard(ctx: CanvasRenderingContext2D, input: StrengthCardInput): void {
  const W = STRENGTH_CARD_W;
  const H = STRENGTH_CARD_H;

  const background = ctx.createLinearGradient(0, 0, 0, H);
  background.addColorStop(0, "#0a0a0c");
  background.addColorStop(0.5, "#121016");
  background.addColorStop(1, "#08080a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 1800; i += 1) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.font = "italic 900 80px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.fillText("DEADSET", W / 2, 140);

  ctx.font = "900 46px Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("MY STRENGTH PROGRESS", W / 2, 226);

  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText(input.sinceLabel.toUpperCase(), W / 2, 280);

  const startColors = colorsFor(input.start);
  const nowColors = colorsFor(input.now);

  const bodyHeight = 520;
  const bodyWidth = BODY_ASPECT * bodyHeight;
  const gutter = 96;
  const leftX = W / 2 - bodyWidth - gutter;
  const rightX = W / 2 + gutter;

  ctx.font = "900 32px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText("START", leftX + bodyWidth / 2, 350);
  ctx.fillStyle = "#5bd07a";
  ctx.fillText("NOW", rightX + bodyWidth / 2, 350);

  // Front and back. Half the muscles anyone trains are invisible from the
  // front, and that is the half people most want credit for.
  (["f", "b"] as const).forEach((side, row) => {
    const y = 378 + row * (bodyHeight + 40);
    drawBody(ctx, side, startColors, leftX, y, bodyHeight);
    drawBody(ctx, side, nowColors, rightX, y, bodyHeight);

    ctx.strokeStyle = "#5bd07a";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const midY = y + bodyHeight / 2;
    ctx.moveTo(W / 2 - 34, midY);
    ctx.lineTo(W / 2 + 26, midY);
    ctx.moveTo(W / 2 + 2, midY - 22);
    ctx.lineTo(W / 2 + 28, midY);
    ctx.lineTo(W / 2 + 2, midY + 22);
    ctx.stroke();
  });

  // Legend, sized from the card rather than a guessed chip width so six tiers
  // — including one as long as "WORLD CLASS" — always fit on one row.
  const legendY = 1470;
  const legendH = 48;
  const gap = 8;
  const sidePadding = 40;
  const chipW = (W - sidePadding * 2 - gap * (TIERS.length - 1)) / TIERS.length;
  let chipX = sidePadding;
  for (const step of TIERS) {
    ctx.fillStyle = TIER_COLOR[step];
    ctx.beginPath();
    ctx.roundRect(chipX, legendY, chipW, legendH, legendH / 2);
    ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    fitText(ctx, step, (size) => `900 ${size}px Arial, sans-serif`, 22, chipW - 14, 11);
    ctx.fillText(step, chipX + chipW / 2, legendY + 32);
    chipX += chipW + gap;
  }

  const headline = `${input.displayName.toUpperCase()} — ${input.tier}`;
  ctx.fillStyle = TIER_COLOR[input.tier];
  fitText(ctx, headline, (size) => `900 ${size}px Arial, sans-serif`, 44, W - 120, 24);
  ctx.fillText(headline, W / 2, 1600);

  // Kept above y≈1660: TikTok and Reels overlay their caption strip below
  // that, which would hide the domain.
  ctx.font = "700 38px Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("HOW STRONG ARE YOU?", W / 2, 1656);
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText("DEADSETFIT.ORG", W / 2, 1706);
}
