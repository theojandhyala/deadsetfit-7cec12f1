import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

import { MUSCLE_SHAPES, bodySilhouette } from "@/lib/body-shapes";
import { getInviteUrl } from "@/lib/referral";
import { TIER_COLOR, TIERS, type MuscleGrade, type StrengthTier } from "@/lib/strength-grades";
import type { MuscleGroup } from "@/lib/types";

/**
 * The strength card: your body then, your body now, graded.
 *
 * This exists because it is the single most shared thing the competition
 * publishes — not a feature demo, a picture of somebody's own progress. It is
 * the one artefact in this app that a person wants to post about themselves,
 * so it is built to be posted: 1080x1920, safe of the caption strip, and
 * carrying an invite link.
 *
 * The bodies are drawn from the same path data the app renders on screen, via
 * Path2D, so the card and the screen can never show different anatomy.
 */

const GROUP_REGIONS: Record<string, string[]> = {
  CHEST: ["chest", "upper-chest"],
  BACK: ["lats", "back", "mid-back", "upper-back", "traps", "rotator-cuff"],
  LEGS: ["quads", "hamstrings", "glutes", "calves", "hip-flexors"],
  SHOULDERS: ["front-delts", "side-delts", "rear-delts", "shoulders"],
  ARMS: ["biceps", "triceps", "forearms", "brachialis"],
  CORE: ["core", "obliques"],
};

const VIEW_W = 200;
const VIEW_H = 420;

function colorsFor(muscles: MuscleGrade[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const muscle of muscles) {
    const color = TIER_COLOR[muscle.tier];
    for (const region of GROUP_REGIONS[muscle.muscle as MuscleGroup] ?? []) map.set(region, color);
  }
  return map;
}

/** Draw one body at (x, y) with the given height, coloured by grade. */
function drawBody(
  ctx: CanvasRenderingContext2D,
  side: "f" | "b",
  colors: Map<string, string>,
  x: number,
  y: number,
  height: number,
) {
  const scale = height / VIEW_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#141414";
  ctx.strokeStyle = "#2f2f2f";
  ctx.lineWidth = 1.4;
  const outline = new Path2D(bodySilhouette());
  ctx.fill(outline);
  ctx.stroke(outline);

  for (const [region, shape] of Object.entries(MUSCLE_SHAPES)) {
    for (const d of shape[side] ?? []) {
      const path = new Path2D(d);
      ctx.fillStyle = colors.get(region) ?? "#232323";
      ctx.fill(path);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 0.6;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

export function StrengthShareCard({
  start,
  now,
  tier,
  displayName,
  sinceLabel,
  onClose,
}: {
  start: MuscleGrade[];
  now: MuscleGrade[];
  tier: StrengthTier;
  displayName: string;
  sinceLabel: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 1080;
    const H = 1920;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const background = ctx.createLinearGradient(0, 0, 0, H);
    background.addColorStop(0, "#0a0a0c");
    background.addColorStop(0.5, "#121016");
    background.addColorStop(1, "#08080a");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);

    // Grain, matching the other cards so the set reads as one family.
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
    ctx.fillText(sinceLabel.toUpperCase(), W / 2, 280);

    const startColors = colorsFor(start);
    const nowColors = colorsFor(now);

    // Two rows — front and back. Half the muscles anyone trains are not
    // visible from the front, and a progress picture that omits them is
    // showing half the work.
    const bodyHeight = 500;
    const bodyWidth = (VIEW_W / VIEW_H) * bodyHeight;
    const leftX = W / 2 - bodyWidth - 120;
    const rightX = W / 2 + 120;

    ctx.font = "900 32px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("START", leftX + bodyWidth / 2, 348);
    ctx.fillStyle = "#5bd07a";
    ctx.fillText("NOW", rightX + bodyWidth / 2, 348);

    (["f", "b"] as const).forEach((side, row) => {
      const y = 380 + row * (bodyHeight + 60);
      drawBody(ctx, side, startColors, leftX, y, bodyHeight);
      drawBody(ctx, side, nowColors, rightX, y, bodyHeight);

      // The arrow between them.
      ctx.strokeStyle = "#5bd07a";
      ctx.lineWidth = 8;
      ctx.beginPath();
      const midY = y + bodyHeight / 2;
      ctx.moveTo(W / 2 - 40, midY);
      ctx.lineTo(W / 2 + 30, midY);
      ctx.moveTo(W / 2 + 6, midY - 24);
      ctx.lineTo(W / 2 + 32, midY);
      ctx.lineTo(W / 2 + 6, midY + 24);
      ctx.stroke();
    });

    // Tier legend.
    const legendY = 1512;
    const chipW = 158;
    const gap = 10;
    const totalW = TIERS.length * chipW + (TIERS.length - 1) * gap;
    let chipX = (W - totalW) / 2;
    ctx.font = "900 22px Arial, sans-serif";
    for (const step of TIERS) {
      ctx.fillStyle = TIER_COLOR[step];
      ctx.beginPath();
      ctx.roundRect(chipX, legendY, chipW, 46, 23);
      ctx.fill();
      ctx.fillStyle = "#0a0a0a";
      ctx.fillText(step, chipX + chipW / 2, legendY + 31);
      chipX += chipW + gap;
    }

    ctx.font = "900 40px Arial, sans-serif";
    ctx.fillStyle = TIER_COLOR[tier];
    ctx.fillText(`${displayName.toUpperCase()} — ${tier}`, W / 2, 1626);

    // Kept above y≈1660: TikTok and Reels overlay the caption strip below
    // that, which would hide the domain.
    ctx.font = "700 40px Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText("HOW STRONG ARE YOU?", W / 2, 1584);
    ctx.font = "700 36px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("DEADSETFIT.ORG", W / 2, 1662);

    setDataUrl(canvas.toDataURL("image/png"));
  }, [start, now, tier, displayName, sinceLabel]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-strength.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        const invite = await getInviteUrl();
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `My strength progress — ${tier}. How strong are you? → ${invite} #deadset #gymtok`,
        });
        return;
      }
    } catch (error) {
      // Cancelling the native share sheet is not a failure — don't then
      // surprise them with a download.
      if (error instanceof Error && error.name === "AbortError") return;
    }
    download();
  }

  function download() {
    if (!dataUrl) return;
    if (Capacitor.isNativePlatform()) {
      toast.error("Use the share sheet to save the image");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "deadset-strength.png";
    link.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 shrink-0">
        <div>
          <p className="label-cap text-white text-xs font-bold">YOUR STRENGTH CARD</p>
          <p className="text-[10px] text-grit-dim">9:16 · TikTok / Reels / Shorts ready</p>
        </div>
        <button onClick={onClose} className="icon-btn text-grit p-1" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      <div
        className="flex-1 overflow-auto px-5 pb-6 flex flex-col items-center"
        onClick={(event) => event.stopPropagation()}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Strength progress card"
            className="w-full max-w-[300px] rounded-xl shadow-2xl"
            style={{ border: "2px solid rgba(176,108,240,0.25)" }}
          />
        ) : (
          <div className="w-full max-w-[300px] h-[533px] rounded-xl bg-[#111] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 grid w-full max-w-[300px] grid-cols-2 gap-2">
          <button onClick={shareNow} className="btn-grit" disabled={!dataUrl}>
            <Share2 size={16} className="mr-2" />
            Share
          </button>
          <button onClick={download} className="btn-ghost" disabled={!dataUrl}>
            <Download size={16} className="mr-2" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
