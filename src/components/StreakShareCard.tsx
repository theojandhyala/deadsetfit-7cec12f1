import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { currentMilestone, nextMilestone } from "@/lib/streak-milestones";
import { getInviteUrl } from "@/lib/referral";

// 9:16 TikTok / Reels / Shorts ready (1080 × 1920)
export function StreakShareCard({
  streak,
  displayName,
  username,
  onClose,
}: {
  streak: number;
  displayName: string;
  username?: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = 1080,
      H = 1920;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const milestone = currentMilestone(streak);
    const next = nextMilestone(streak);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b0505");
    bg.addColorStop(0.45, "#190a07");
    bg.addColorStop(1, "#070404");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Ember glow behind the number
    const glow = ctx.createRadialGradient(W / 2, 760, 60, W / 2, 760, 620);
    glow.addColorStop(0, "rgba(230,50,34,0.5)");
    glow.addColorStop(0.5, "rgba(230,50,34,0.14)");
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

    // Wordmark
    ctx.textAlign = "center";
    ctx.font = "italic 900 84px 'Arial Black', Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText("DEAD", W / 2 - 96, 220);
    ctx.fillStyle = "#e63222";
    ctx.fillText("SET", W / 2 + 138, 220);

    // Flame emoji
    ctx.font = "160px Arial";
    ctx.fillText("🔥", W / 2, 520);

    // Big number
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 340px 'Arial Black', Arial, sans-serif";
    ctx.fillText(String(streak), W / 2, 920);

    ctx.font = "700 64px Arial, sans-serif";
    ctx.fillStyle = "#e63222";
    ctx.fillText(`DAY STREAK`, W / 2, 1010);

    // Milestone label
    if (milestone) {
      ctx.font = "800 58px Arial, sans-serif";
      ctx.fillStyle = "#f5f5f0";
      ctx.fillText(`${milestone.emoji} ${milestone.label.toUpperCase()}`, W / 2, 1130);
    }
    if (next) {
      ctx.font = "600 40px Arial, sans-serif";
      ctx.fillStyle = "#9a8a84";
      ctx.fillText(`${next.days - streak} days to ${next.label}`, W / 2, milestone ? 1200 : 1130);
    }

    // Athlete
    ctx.font = "800 52px Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText(displayName.toUpperCase(), W / 2, 1420);
    if (username) {
      ctx.font = "600 38px Arial, sans-serif";
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText(`@${username}`, W / 2, 1480);
    }

    // CTA — kept above y≈1660: TikTok/Reels overlay the caption and
    // username strip below that, which would hide the domain.
    ctx.font = "700 44px Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText("THINK YOU CAN OUTLAST ME?", W / 2, 1580);
    ctx.font = "700 40px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("DEADSETFIT.ORG", W / 2, 1645);

    setDataUrl(c.toDataURL("image/png"));
  }, [streak, displayName, username]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-streak.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        const invite = await getInviteUrl();
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `${streak}-day training streak 🔥 Think you can outlast me? → ${invite} #deadset #gymtok`,
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
    a.download = `deadset-${streak}-day-streak.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 shrink-0">
        <div>
          <p className="label-cap text-white text-xs font-bold">YOUR STREAK CARD</p>
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
            alt="Streak card"
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
          <span className="text-white font-bold">#deadset</span> — dare your followers to outlast
          your streak.
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
