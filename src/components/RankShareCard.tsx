import { useEffect, useRef, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { getRank } from "@/lib/rank";
import type { HeadlinePR } from "@/lib/fifa-stats";

export type RankShareProps = {
  gritPoints: number;
  displayName: string;
  username?: string | null;
  avatarDataUrl?: string | null;
  streak: number;
  prs: HeadlinePR[];
  sessions: number;
  overall: number;
  onClose: () => void;
};

// 9:16 TikTok / Reels / Shorts ready (1080 × 1920)
export function RankShareCard({
  gritPoints,
  displayName,
  username,
  avatarDataUrl,
  streak,
  prs,
  sessions,
  overall,
  onClose,
}: RankShareProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // Guards the async avatar path against drawing a stale render after
    // the effect re-runs with new props.
    let cancelled = false;
    const c = canvasRef.current;
    if (!c) return;
    const W = 1080, H = 1920;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const rank = getRank(gritPoints);

    // ── Background ────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#070709");
    bg.addColorStop(0.5, "#0d0d12");
    bg.addColorStop(1, "#0a0608");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle noise texture via small dots
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Bottom glow from rank color
    const radGlow = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, H * 0.7);
    radGlow.addColorStop(0, rank.glowColor + "55");
    radGlow.addColorStop(1, "transparent");
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, W, H);

    // Top-left corner accent triangle
    ctx.fillStyle = "#E10600";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(320, 0);
    ctx.lineTo(0, 260);
    ctx.closePath();
    ctx.fill();

    // ── DEADSET logo ─────────────────────────────────────────────
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 96px 'Impact', 'Arial Black', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("DEAD", 60, 110);
    ctx.fillStyle = "#E10600";
    ctx.fillText("SET", 60 + ctx.measureText("DEAD").width, 110);

    ctx.fillStyle = "#555";
    ctx.font = "700 24px Arial, sans-serif";
    ctx.fillText("FORGE YOUR BODY", 60, 148);

    // Season label
    ctx.fillStyle = rank.color;
    ctx.font = "700 22px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("SEASON 1 · 2025", W - 60, 100);
    ctx.textAlign = "left";

    // ── Avatar circle ────────────────────────────────────────────
    const avatarX = W / 2, avatarY = 460, avatarR = 160;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR + 6, 0, Math.PI * 2);
    ctx.fillStyle = rank.color;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);

    function drawAvatarPlaceholder() {
      ctx.fillStyle = "#222";
      ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
      ctx.fillStyle = "#555";
      ctx.font = "900 160px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((displayName || "A")[0].toUpperCase(), avatarX, avatarY + 60);
      ctx.textAlign = "left";
    }

    if (avatarDataUrl) {
      const img = new Image();
      img.src = avatarDataUrl;
      img
        .decode()
        .then(() => {
          if (cancelled) return;
          ctx.drawImage(img, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        })
        .catch(() => {
          // Fall back to the placeholder circle if the image fails to load.
          if (!cancelled) drawAvatarPlaceholder();
        })
        .then(() => {
          if (cancelled) return;
          ctx.restore();
          finishRender();
        });
      return;
    }
    drawAvatarPlaceholder();
    ctx.restore();
    finishRender();

    function finishRender() {
    // ── Rank emblem (below avatar) ───────────────────────────────
    const embX = W / 2, embY = 700;
    const embR = 110;
    const embGrad = ctx.createLinearGradient(embX - embR, embY - embR, embX + embR, embY + embR);
    embGrad.addColorStop(0, rank.gradient[0]);
    embGrad.addColorStop(1, rank.gradient[1]);
    ctx.fillStyle = embGrad;
    roundRect(ctx, embX - embR, embY - embR, embR * 2, embR * 2, 28);
    ctx.fill();
    ctx.strokeStyle = rank.color;
    ctx.lineWidth = 4;
    roundRect(ctx, embX - embR, embY - embR, embR * 2, embR * 2, 28);
    ctx.stroke();

    ctx.font = "80px serif";
    ctx.textAlign = "center";
    ctx.fillText(rank.icon, embX, embY + 30);
    ctx.textAlign = "left";

    // Division badge
    if (rank.division) {
      ctx.fillStyle = rank.color;
      ctx.beginPath();
      ctx.arc(embX + embR - 14, embY + embR - 14, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "900 28px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(rank.division, embX + embR - 14, embY + embR - 3);
      ctx.textAlign = "left";
    }

    // ── Rank name & points ───────────────────────────────────────
    ctx.fillStyle = rank.color;
    ctx.font = "900 80px 'Impact', 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rank.label, W / 2, embY + embR + 80);

    ctx.fillStyle = "#444";
    ctx.font = "700 30px Arial, sans-serif";
    ctx.fillText(`${gritPoints} / 1000 GRIT`, W / 2, embY + embR + 126);
    ctx.textAlign = "left";

    // ── Progress bar ─────────────────────────────────────────────
    const barX = 80, barY = embY + embR + 160, barW = W - 160, barH = 18;
    ctx.fillStyle = "#1a1a1a";
    roundRect(ctx, barX, barY, barW, barH, 9);
    ctx.fill();
    const pct = Math.min(1, gritPoints / 1000);
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW * pct, 0);
    fillGrad.addColorStop(0, rank.gradient[0] || rank.color);
    fillGrad.addColorStop(1, rank.color);
    ctx.fillStyle = fillGrad;
    roundRect(ctx, barX, barY, barW * pct, barH, 9);
    ctx.fill();

    // ── Name ─────────────────────────────────────────────────────
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 72px 'Impact', 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((displayName || "ATHLETE").toUpperCase().slice(0, 20), W / 2, embY + embR + 260);
    if (username) {
      ctx.fillStyle = "#E10600";
      ctx.font = "700 34px Arial, sans-serif";
      ctx.fillText(`@${username}`, W / 2, embY + embR + 310);
    }
    ctx.textAlign = "left";

    // ── Stats strip ──────────────────────────────────────────────
    const stripY = embY + embR + 370;
    const stripData = [
      { label: "OVR", value: String(overall || "—") },
      { label: "STREAK", value: `${streak}d` },
      { label: "SESSIONS", value: String(sessions) },
    ];
    const colW = (W - 160) / 3;
    stripData.forEach((s, i) => {
      const sx = 80 + i * colW;
      ctx.fillStyle = "#111";
      roundRect(ctx, sx + 4, stripY, colW - 8, 140, 16);
      ctx.fill();
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 2;
      roundRect(ctx, sx + 4, stripY, colW - 8, 140, 16);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 56px 'Impact', 'Arial Black', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(s.value, sx + colW / 2, stripY + 78);
      ctx.fillStyle = "#555";
      ctx.font = "700 22px Arial, sans-serif";
      ctx.fillText(s.label, sx + colW / 2, stripY + 118);
    });
    ctx.textAlign = "left";

    // ── PRs ──────────────────────────────────────────────────────
    const prY = stripY + 180;
    ctx.fillStyle = "#555";
    ctx.font = "700 26px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("— TOP LIFTS —", W / 2, prY);
    ctx.textAlign = "left";

    const topPRs = prs.slice(0, 4);
    topPRs.forEach((pr, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const px = 80 + col * ((W - 160) / 2);
      const py = prY + 40 + row * 220;
      const pw = (W - 160) / 2 - 12;

      ctx.fillStyle = "#0d0d0d";
      roundRect(ctx, px, py, pw, 200, 16);
      ctx.fill();
      ctx.strokeStyle = rank.color + "40";
      ctx.lineWidth = 2;
      roundRect(ctx, px, py, pw, 200, 16);
      ctx.stroke();

      ctx.fillStyle = rank.color;
      ctx.font = "700 22px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(pr.label.toUpperCase(), px + pw / 2, py + 46);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 72px 'Impact', 'Arial Black', sans-serif";
      ctx.fillText(`${pr.value}`, px + pw / 2, py + 126);

      ctx.fillStyle = "#555";
      ctx.font = "700 22px Arial, sans-serif";
      ctx.fillText(pr.unit.toUpperCase(), px + pw / 2, py + 168);
      ctx.textAlign = "left";
    });

    // ── CTA footer ───────────────────────────────────────────────
    ctx.fillStyle = "#E10600";
    ctx.fillRect(0, H - 100, W, 4);

    ctx.fillStyle = "#333";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DEADSETFIT.ORG  ·  #DEADSET  ·  #GYMTOK", W / 2, H - 44);
    ctx.textAlign = "left";

    setDataUrl(c!.toDataURL("image/png"));
    }
    return () => {
      cancelled = true;
    };
  }, [gritPoints, displayName, username, avatarDataUrl, streak, prs, sessions, overall]);

  async function shareNow() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "deadset-rank.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "DEADSET",
          text: `${getRank(gritPoints).label} rank · ${gritPoints} grit · Can you beat me? #deadset #gymtok #liftingmotivation`,
        });
        return;
      }
    } catch { /* fall through to download */ }
    download();
  }

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `deadset-${getRank(gritPoints).label.replace(" ", "-").toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 shrink-0">
        <div>
          <p className="label-cap text-white text-xs font-bold">YOUR RANK CARD</p>
          <p className="text-[10px] text-grit-dim">9:16 · TikTok / Reels / Shorts ready</p>
        </div>
        <button onClick={onClose} className="text-grit p-1">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-6 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Rank card"
            className="w-full max-w-[300px] rounded-xl shadow-2xl"
            style={{ border: `2px solid ${getRank(gritPoints).color}40` }}
          />
        ) : (
          <div className="w-full max-w-[300px] h-[533px] rounded-xl bg-[#111] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <p className="text-[11px] text-grit-dim text-center mt-4 max-w-xs">
          Save it → post to TikTok / Reels and tag{" "}
          <span className="text-white font-bold">#deadset</span> — dare your followers to beat your rank.
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
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
            style={{ background: "#E10600", color: "#fff" }}
          >
            <Share2 size={16} />
            Post
          </button>
        </div>
      </div>
    </div>
  );
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
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
