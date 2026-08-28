import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import type { WorkoutSession } from "@/lib/types";
import { drawSessionCard, SESSION_CARD_H, SESSION_CARD_W } from "@/lib/session-card-draw";
import { getInviteUrl } from "@/lib/referral";

// 9:16 TikTok / Reels / Shorts ready (1080 x 1920)
export function ShareCard({
  session,
  displayName,
  username,
  onClose,
}: {
  session: WorkoutSession;
  displayName?: string;
  username?: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = SESSION_CARD_W;
    c.height = SESSION_CARD_H;
    const ctx = c.getContext("2d")!;
    drawSessionCard(ctx, { session, displayName, username });
    setDataUrl(c.toDataURL("image/png"));
  }, [session, displayName, username]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-session.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        const invite = await getInviteUrl();
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `Just crushed a session on DEADSET. Train with me → ${invite} #deadset #gymtok`,
        });
        return;
      }
    } catch {
      /* fallthrough */
    }
    download();
  }
  function download() {
    if (!dataUrl) return;
    // Anchor downloads no-op inside the iOS webview — the share sheet is the
    // only handover there, so tell the user instead of failing silently.
    if (Capacitor.isNativePlatform()) {
      toast.error("Use the share sheet to save the image");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `deadset-${session.id}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4">
        <p className="label-cap text-grit">9:16 · TIKTOK READY</p>
        <button onClick={onClose} className="icon-btn text-grit">
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 pb-5" onClick={(e) => e.stopPropagation()}>
        {dataUrl && (
          <img
            src={dataUrl}
            alt="Share card"
            className="w-full max-w-[360px] mx-auto border border-grit"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-[11px] text-grit-dim text-center mt-3 max-w-xs mx-auto">
          Save it, then post to TikTok / Reels / Shorts. Tag{" "}
          <span className="text-grit font-bold">#deadset</span>.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4 max-w-md mx-auto">
          <button onClick={download} className="btn-ghost">
            <Download size={16} className="mr-2" />
            Save
          </button>
          <button onClick={shareNow} className="btn-grit">
            <Share2 size={16} className="mr-2" />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
