import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import type { Achievement } from "@/lib/achievements";
import { BADGE_CARD_H, BADGE_CARD_W, drawBadgeCard } from "@/lib/badge-card-draw";
import { getInviteUrl } from "@/lib/referral";

// 9:16 TikTok / Reels / Shorts ready (1080 × 1920)
export function BadgeShareCard({
  badge,
  displayName,
  username,
  unlockedCount,
  totalCount,
  onClose,
}: {
  badge: Achievement;
  displayName?: string;
  username?: string | null;
  unlockedCount?: number;
  totalCount?: number;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = BADGE_CARD_W;
    c.height = BADGE_CARD_H;
    const ctx = c.getContext("2d")!;
    drawBadgeCard(ctx, { badge, displayName, username, unlockedCount, totalCount });
    setDataUrl(c.toDataURL("image/png"));
  }, [badge, displayName, username, unlockedCount, totalCount]);

  const caption = `Unlocked "${badge.label}" on DEADSET — ${badge.desc.toLowerCase()}`;

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-badge.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        const invite = await getInviteUrl();
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `${caption} 🏆 Earn yours → ${invite} #deadset #gymtok`,
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
    a.download = `deadset-${badge.id}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex shrink-0 items-center justify-between p-4">
        <div>
          <p className="label-cap text-xs font-bold text-white">YOUR BADGE CARD</p>
          <p className="text-[10px] text-grit-dim">9:16 · TikTok / Reels / Shorts ready</p>
        </div>
        <button onClick={onClose} className="icon-btn p-1 text-grit" aria-label="Close">
          <X size={22} />
        </button>
      </div>

      <div
        className="flex flex-1 flex-col items-center overflow-auto px-5 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`${caption} share card`}
            className="w-full max-w-[300px] rounded-xl shadow-2xl"
            style={{ border: "2px solid rgba(230,50,34,0.25)" }}
          />
        ) : (
          <div className="flex h-[533px] w-full max-w-[300px] items-center justify-center rounded-xl bg-[#111]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-red border-t-transparent" />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <p className="mt-4 max-w-xs text-center text-[11px] text-grit-dim">
          Save it → post to TikTok / Reels and tag{" "}
          <span className="font-bold text-white">#deadset</span>.
        </p>

        <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-3">
          <button
            onClick={download}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
            style={{ background: "#1a1a1a", border: "1.5px solid #2a2a2a", color: "#fff" }}
          >
            <Download size={16} />
            Save
          </button>
          <button
            onClick={shareNow}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent-red py-3 text-sm font-bold text-white"
          >
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
