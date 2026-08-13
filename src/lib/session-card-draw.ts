import type { WorkoutSession } from "./types";

export const SESSION_CARD_W = 1080;
export const SESSION_CARD_H = 1920;

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
    size -= 4;
    ctx.font = font(size);
  }
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
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Whole minutes between start and end, or null when the session never closed. */
export function sessionMinutes(session: WorkoutSession): number | null {
  if (!session.endedAt || !session.startedAt) return null;
  const ms = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  // A forgotten timer can run for hours; past a point it stops being a workout.
  const mins = Math.round(ms / 60000);
  return mins > 240 ? null : mins;
}

export function sessionCardStats(session: WorkoutSession) {
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  const mins = sessionMinutes(session);
  return {
    volume: Math.round(session.totalVolume || 0),
    exercises: session.exercises.length,
    sets,
    prs: session.prCount || 0,
    minutes: mins,
  };
}

/**
 * Paints the 9:16 finished-session card — the one that fires after every
 * workout, so the most-posted asset in the app.
 *
 * Composed between y≈260 and y≈1660: TikTok, Reels and Shorts overlay the top
 * tabs and the bottom caption/username strip, and anything below that band —
 * the CTA especially — is hidden on the feed.
 */
export function drawSessionCard(
  ctx: CanvasRenderingContext2D,
  {
    session,
    displayName,
    username,
  }: { session: WorkoutSession; displayName?: string; username?: string | null },
) {
  const W = SESSION_CARD_W;
  const H = SESSION_CARD_H;
  const s = sessionCardStats(session);

  // ── Background ────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0a0506");
  bg.addColorStop(0.5, "#16090a");
  bg.addColorStop(1, "#070405");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 830, 80, W / 2, 830, 680);
  glow.addColorStop(0, "rgba(230,50,34,0.5)");
  glow.addColorStop(0.45, "rgba(230,50,34,0.14)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";

  // ── Wordmark ──────────────────────────────────────────────────
  ctx.font = "italic 900 84px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("DEAD", W / 2 - 96, 260);
  ctx.fillStyle = "#e63222";
  ctx.fillText("SET", W / 2 + 138, 260);

  // ── Session ───────────────────────────────────────────────────
  ctx.font = "800 44px Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.fillText("SESSION COMPLETE", W / 2, 430);

  const label = (session.label || "TRAINING DAY").toUpperCase().split(" — ")[0];
  fitText(ctx, label, (n) => `900 ${n}px 'Arial Black', Arial, sans-serif`, 92, W - 140, 44);
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText(label, W / 2, 540);

  // ── Hero: tonnage ─────────────────────────────────────────────
  const hero = s.volume.toLocaleString();
  fitText(ctx, hero, (n) => `900 ${n}px 'Arial Black', Arial, sans-serif`, 300, W - 200, 130);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(230,50,34,0.7)";
  ctx.shadowBlur = 70;
  ctx.fillText(hero, W / 2, 930);
  ctx.shadowBlur = 0;

  ctx.font = "800 70px Arial, sans-serif";
  ctx.fillStyle = "#e63222";
  ctx.fillText("KG MOVED", W / 2, 1020);

  // ── Stat row ──────────────────────────────────────────────────
  const cells: { k: string; v: string }[] = [
    { k: "EXERCISES", v: String(s.exercises) },
    { k: "SETS", v: String(s.sets) },
    s.prs > 0
      ? { k: s.prs === 1 ? "PR" : "PRS", v: String(s.prs) }
      : { k: "MINUTES", v: s.minutes != null ? String(s.minutes) : "—" },
  ];
  const gap = 24;
  const cellW = (W - 140 - gap * 2) / 3;
  const cellH = 190;
  const rowY = 1110;
  cells.forEach((cell, i) => {
    const x = 70 + i * (cellW + gap);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, x, rowY, cellW, cellH, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(230,50,34,0.28)";
    ctx.lineWidth = 3;
    roundRect(ctx, x, rowY, cellW, cellH, 24);
    ctx.stroke();

    ctx.fillStyle = "#f5f5f0";
    ctx.font = "900 84px 'Arial Black', Arial, sans-serif";
    ctx.fillText(cell.v, x + cellW / 2, rowY + 108);
    ctx.fillStyle = "#9a8a84";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText(cell.k, x + cellW / 2, rowY + 158);
  });

  // ── Athlete ───────────────────────────────────────────────────
  if (displayName) {
    ctx.font = "800 52px Arial, sans-serif";
    ctx.fillStyle = "#f5f5f0";
    ctx.fillText(displayName.toUpperCase().slice(0, 22), W / 2, 1370);
    if (username) {
      ctx.font = "600 38px Arial, sans-serif";
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText(`@${username}`, W / 2, 1428);
    }
  }

  // ── CTA ───────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(230,50,34,0.55)";
  ctx.fillRect(W / 2 - 120, 1500, 240, 3);
  ctx.font = "900 72px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#f5f5f0";
  ctx.fillText("YOUR TURN.", W / 2, 1590);
  ctx.font = "700 40px Arial, sans-serif";
  ctx.fillStyle = "#8a8a8a";
  ctx.fillText("DEADSETFIT.ORG", W / 2, 1655);
}
