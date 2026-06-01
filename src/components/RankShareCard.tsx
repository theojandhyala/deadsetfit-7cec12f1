import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";

export type RankShareProps = {
  rank: number;
  league: string;
  points: number;
  displayName: string;
  username?: string | null;
  onClose: () => void;
};

// 9:16 league-rank share card — TikTok / Reels / Shorts ready
export function RankShareCard({
  rank,
  league,
  points,
  displayName,
  username,
  onClose,
}: RankShareProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const w = 1080,
      h = 1920;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0a0a");
    bg.addColorStop(1, "#1a0606");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Top + bottom rails
    ctx.fillStyle = "#e63222";
    ctx.fillRect(0, 0, w, 16);
    ctx.fillRect(0, h - 16, w, 16);

    // Diagonal red wedge
    ctx.fillStyle = "#e63222";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(420, 0);
    ctx.lineTo(0, 380);
    ctx.closePath();
    ctx.fill();

    // Brand
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 110px Impact, 'Arial Black', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("DEADSET", w - 70, 220);
    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("LEAGUE STANDING", w - 70, 270);
    ctx.textAlign = "left";

    // League name
    const leagueColors: Record<string, string> = {
      ELITE: "#a78bfa",
      DIAMOND: "#67e8f9",
      GOLD: "#fbbf24",
      SILVER: "#cbd5e1",
      BRONZE: "#b45309",
    };
    const lc = leagueColors[league] ?? "#e63222";
    ctx.fillStyle = lc;
    ctx.font = "700 56px Arial, sans-serif";
    ctx.fillText(league + " LEAGUE", 70, 560);

    // Giant rank
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 96px Impact, 'Arial Black', sans-serif";
    ctx.fillText("RANK", 70, 720);

    ctx.fillStyle = "#e63222";
    ctx.font = "900 540px Impact, 'Arial Black', sans-serif";
    ctx.fillText(`#${rank}`, 70, 1180);

    // Stats row
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(70, 1280, w - 140, 240);
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 1280, w - 140, 240);

    ctx.fillStyle = "#8a8a8a";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText("DS POINTS", 110, 1340);
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 160px Impact, 'Arial Black', sans-serif";
    ctx.fillText(points.toLocaleString(), 110, 1480);

    // Athlete
    ctx.fillStyle = "#8a8a8a";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText("ATHLETE", 70, 1620);
    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 72px Impact, 'Arial Black', sans-serif";
    ctx.fillText((displayName || "ATHLETE").toUpperCase().slice(0, 22), 70, 1700);
    if (username) {
      ctx.fillStyle = "#e63222";
      ctx.font = "700 34px Arial, sans-serif";
      ctx.fillText(`@${username}`, 70, 1750);
    }

    // CTA
    ctx.fillStyle = "#e63222";
    ctx.fillRect(70, 1810, w - 140, 4);
    ctx.fillStyle = "#8a8a8a";
    ctx.font = "700 32px Arial, sans-serif";
    ctx.fillText("CATCH ME · DEADSETFIT.ORG", 70, 1870);

    setDataUrl(c.toDataURL("image/png"));
  }, [rank, league, points, displayName, username]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-rank.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `Ranked #${rank} in ${league}. Catch me. #deadset #gymtok`,
        });
        return;
      }
    } catch {
      /* fall through */
    }
    download();
  }
  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `deadset-rank-${rank}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4">
        <p className="label-cap text-grit">9:16 · TIKTOK READY</p>
        <button onClick={onClose} className="text-grit">
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 pb-5" onClick={(e) => e.stopPropagation()}>
        {dataUrl && (
          <img
            src={dataUrl}
            alt="Rank share card"
            className="w-full max-w-[360px] mx-auto border border-grit"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-[11px] text-grit-dim text-center mt-3 max-w-xs mx-auto">
          Save it, then post to TikTok / Reels / Shorts. Tag{" "}
          <span className="text-grit font-bold">#deadset</span> and dare your followers to beat you.
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
