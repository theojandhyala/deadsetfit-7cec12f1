import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

import { getInviteUrl } from "@/lib/referral";
import { STRENGTH_CARD_H, STRENGTH_CARD_W, drawStrengthCard } from "@/lib/strength-card-draw";
import type { MuscleGrade, StrengthTier } from "@/lib/strength-grades";

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
    canvas.width = STRENGTH_CARD_W;
    canvas.height = STRENGTH_CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawStrengthCard(ctx, { start, now, tier, displayName, sinceLabel });
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
