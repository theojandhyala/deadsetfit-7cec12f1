import { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import type { PRShareDetails } from "@/lib/grit-events";
import { drawPRCard, PR_CARD_H, PR_CARD_W } from "@/lib/pr-card-draw";
import { prHeadline } from "@/lib/pr-share";
import { getInviteUrl } from "@/lib/referral";
import { useAppState } from "@/lib/storage";
import { unitOf } from "@/lib/units";

// 9:16 TikTok / Reels / Shorts ready (1080 × 1920)
export function PRShareCard({
  pr,
  displayName,
  username,
  onClose,
}: {
  pr: PRShareDetails;
  displayName: string;
  username?: string | null;
  onClose: () => void;
}) {
  const [state] = useAppState();
  const unit = unitOf(state);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  // Memoised: the canvas effect depends on it, and the grain is random — a
  // fresh object each render would redraw and re-set state forever.
  const headline = useMemo(() => prHeadline(pr, unit), [pr, unit]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = PR_CARD_W;
    c.height = PR_CARD_H;
    const ctx = c.getContext("2d")!;
    drawPRCard(ctx, { pr, displayName, username, unit });
    setDataUrl(c.toDataURL("image/png"));
  }, [pr, displayName, username, unit]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-pr.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        const invite = await getInviteUrl();
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `${headline.caption} 💪 Beat it → ${invite} #deadset #gymtok #pr`,
        });
        return;
      }
    } catch (e) {
      // User cancelled the native share sheet — don't fall back to a download.
      if (e instanceof Error && e.name === "AbortError") return;
    }
    download();
  }

  function download() {
    if (!dataUrl) return;
    if (Capacitor.isNativePlatform()) {
      toast.error("Use the share sheet to save the image");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `deadset-pr-${pr.exercise.toLowerCase().replace(/\s+/g, "-")}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[210] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 shrink-0">
        <div>
          <p className="label-cap text-white text-xs font-bold">YOUR PR CARD</p>
          <p className="text-[10px] text-grit-dim">9:16 · TikTok / Reels / Shorts ready</p>
        </div>
        <button onClick={onClose} className="icon-btn text-grit p-1" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      <div
        className="flex-1 overflow-auto px-5 pb-6 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`${headline.caption} share card`}
            className="w-full max-w-[300px] rounded-xl shadow-2xl"
            style={{ border: "2px solid rgba(230,50,34,0.25)" }}
          />
        ) : (
          <div className="w-full max-w-[300px] h-[533px] rounded-xl bg-[#111] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <p className="text-[11px] text-grit-dim text-center mt-4 max-w-xs">
          Save it → post to TikTok / Reels and tag{" "}
          <span className="text-white font-bold">#deadset</span> — let them try to beat it.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-5 w-full max-w-xs">
          <button
            onClick={download}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
            style={{ background: "#1a1a1a", border: "1.5px solid #2a2a2a", color: "#fff" }}
          >
            <Download size={16} />
            Save
          </button>
          <button
            onClick={shareNow}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-accent-red text-white"
          >
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
