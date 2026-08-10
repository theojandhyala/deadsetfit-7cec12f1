import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

import type { LifetimeStats } from "@/lib/lifetime-stats";
import { getInviteUrl } from "@/lib/referral";

// 9:16 TikTok / Reels / Shorts ready (1080 × 1920) — the athlete's whole
// story as one shareable receipt.
export function StoryShareCard({
  stats,
  displayName,
  username,
  onClose,
}: {
  stats: LifetimeStats;
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

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0b0505");
    bg.addColorStop(0.45, "#190a07");
    bg.addColorStop(1, "#070404");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Glow behind the tonnage
    const glow = ctx.createRadialGradient(W / 2, 700, 60, W / 2, 700, 640);
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
    ctx.fillText("DEAD", W / 2 - 96, 200);
    ctx.fillStyle = "#e63222";
    ctx.fillText("SET", W / 2 + 138, 200);

    ctx.font = "700 44px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("LIFETIME, LOGGED REP BY REP", W / 2, 300);

    // The tonnage — scale down as the number grows so it always fits.
    const tonnage = stats.totalVolumeKg.toLocaleString("en-US");
    const numSize = tonnage.length <= 6 ? 250 : tonnage.length <= 8 ? 200 : 160;
    ctx.fillStyle = "#f5f5f0";
    ctx.font = `900 ${numSize}px 'Arial Black', Arial, sans-serif`;
    ctx.fillText(tonnage, W / 2, 780);
    ctx.font = "700 64px Arial, sans-serif";
    ctx.fillStyle = "#e63222";
    ctx.fillText("KG LIFTED", W / 2, 880);

    if (stats.equivalent) {
      ctx.font = "800 52px Arial, sans-serif";
      ctx.fillStyle = "#f5f5f0";
      ctx.fillText(
        `= ${stats.equivalent.count.toLocaleString("en-US")} ${stats.equivalent.label.toUpperCase()}`,
        W / 2,
        980,
      );
    }

    // Stat row
    const stats4: [string, string][] = [
      [String(stats.sessions), "SESSIONS"],
      [stats.totalReps.toLocaleString("en-US"), "REPS"],
      [String(stats.hoursTrained), "HOURS"],
      [`${stats.longestStreakDays}`, "BEST STREAK"],
    ];
    const cellW = 230;
    const startX = W / 2 - ((stats4.length - 1) * cellW) / 2;
    stats4.forEach(([v, l], i) => {
      const x = startX + i * cellW;
      ctx.font = "900 72px 'Arial Black', Arial, sans-serif";
      ctx.fillStyle = "#f5f5f0";
      ctx.fillText(v, x, 1180);
      ctx.font = "700 28px Arial, sans-serif";
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText(l, x, 1230);
    });

    if (stats.heaviestSet) {
      ctx.font = "600 40px Arial, sans-serif";
      ctx.fillStyle = "#9a8a84";
      ctx.fillText(
        `HEAVIEST SET · ${stats.heaviestSet.weight} KG × ${stats.heaviestSet.reps} ${stats.heaviestSet.name.toUpperCase()}`,
        W / 2,
        1340,
      );
    }

    // Athlete
    ctx.font = "800 52px Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText(displayName.toUpperCase(), W / 2, 1480);
    if (username) {
      ctx.font = "600 38px Arial, sans-serif";
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText(`@${username}`, W / 2, 1540);
    }

    // CTA
    ctx.font = "700 44px Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText("WHAT'S YOUR NUMBER?", W / 2, 1700);
    ctx.font = "700 40px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("DEADSETFIT.ORG", W / 2, 1770);

    setDataUrl(c.toDataURL("image/png"));
  }, [stats, displayName, username]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        const invite = await getInviteUrl();
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `${stats.totalVolumeKg.toLocaleString("en-US")} kg lifted, every rep logged. What's your number? → ${invite} #deadset #gymtok`,
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
    a.download = "deadset-story.png";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 shrink-0">
        <div>
          <p className="label-cap text-white text-xs font-bold">YOUR STORY CARD</p>
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
            alt="Lifetime story card"
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
          <span className="text-white font-bold">#deadset</span> — dare your followers to beat your
          number.
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
