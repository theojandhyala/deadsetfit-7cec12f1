import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  MALE_BACK,
  MALE_FRONT,
  type BodyDiagram,
  type MusclePath,
  type OutlinePath,
} from "@musclemap/assets";
import { Download, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { hapticMilestone, hapticSelection } from "@/lib/haptics";
import {
  GRADED_MUSCLES,
  TIER_COLOR,
  type MuscleGrade,
  type StrengthReport,
  type StrengthTier,
} from "@/lib/strength-grades";

export type StrengthMapGroup = (typeof GRADED_MUSCLES)[number];

export type StrengthMapGradeColors = Partial<Record<StrengthMapGroup, string>>;

/** The fields the share card consumes from a full StrengthReport. */
export type StrengthMapSnapshot = Pick<StrengthReport, "score" | "tier"> & {
  muscles: ReadonlyArray<Pick<MuscleGrade, "muscle" | "score" | "tier">>;
  gradedCount?: number;
};

export interface StrengthMapShareCardProps {
  /** Pass the current StrengthReport directly in the common case. */
  current?: StrengthMapSnapshot | null;
  /** A real historical snapshot only. Omit it while a baseline is still building. */
  baseline?: StrengthMapSnapshot | null;
  /** Optional colour overrides, useful when the route already calculated its map colours. */
  gradeColors?: StrengthMapGradeColors;
  /** Explicit score overrides for callers that only have prepared map colours. */
  currentScore?: number | null;
  baselineScore?: number | null;
  /** Explicit current tier override for callers without a StrengthReport. */
  tier?: StrengthTier;
  displayName?: string | null;
  username?: string | null;
  onClose: () => void;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const ACCENT_RED = "#e63222";
const EMPTY_MUSCLE = "#303238";
const MUSCLE_OUTLINE = "#d8d8d1";
const BODY_BASE = "#0d0e11";
const BODY_OUTLINE = "#4e5158";

type AnatomyGroup = MusclePath["group"];

const GROUP_ANATOMY: Record<StrengthMapGroup, readonly AnatomyGroup[]> = {
  CHEST: ["CHEST"],
  BACK: ["BACK_UPPER", "BACK_LOWER", "TRAPEZIUS", "RHOMBOIDS", "LATS"],
  LEGS: ["GLUTES", "QUADS", "HAMSTRINGS", "CALVES", "HIP_FLEXORS", "ADDUCTORS", "ABDUCTORS"],
  SHOULDERS: ["SHOULDERS_FRONT", "SHOULDERS_SIDE", "SHOULDERS_REAR"],
  ARMS: ["BICEPS", "TRICEPS", "FOREARMS"],
  CORE: ["CORE", "OBLIQUES"],
};

const FRONT_HIP_FLEXORS: MusclePath[] = [
  {
    id: "HIP_FLEXOR_LEFT",
    group: "HIP_FLEXORS",
    side: "LEFT",
    d: "M447 688C455 681 466 679 478 683C481 695 480 708 476 722C473 734 468 746 461 756C453 747 447 736 443 722C440 708 441 696 447 688Z",
  },
];

function reportColors(snapshot: StrengthMapSnapshot | null | undefined): StrengthMapGradeColors {
  return Object.fromEntries(
    (snapshot?.muscles ?? []).map((grade) => [grade.muscle, TIER_COLOR[grade.tier]]),
  );
}

function normaliseScore(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value!))) : null;
}

function resolvedTier(
  group: StrengthMapGroup,
  current: StrengthMapSnapshot | null | undefined,
  color: string | undefined,
): StrengthTier | null {
  const reportGrade = current?.muscles.find((grade) => grade.muscle === group);
  if (reportGrade) return reportGrade.tier;
  const normalizedColor = color?.toLowerCase();
  return (
    (Object.entries(TIER_COLOR) as Array<[StrengthTier, string]>).find(
      ([, tierColor]) => tierColor.toLowerCase() === normalizedColor,
    )?.[0] ?? null
  );
}

function resolvedMuscleScore(
  group: StrengthMapGroup,
  current: StrengthMapSnapshot | null | undefined,
): number | null {
  return normaliseScore(current?.muscles.find((grade) => grade.muscle === group)?.score);
}

export function StrengthMapShareCard({
  current,
  baseline,
  gradeColors,
  currentScore,
  baselineScore,
  tier,
  displayName,
  username,
  onClose,
}: StrengthMapShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const currentColors = useMemo(
    () => ({ ...reportColors(current), ...gradeColors }),
    [current, gradeColors],
  );
  const nowScore = normaliseScore(currentScore !== undefined ? currentScore : current?.score);
  const startScore = normaliseScore(baselineScore !== undefined ? baselineScore : baseline?.score);
  const currentTier = tier ?? current?.tier ?? null;
  const native = Capacitor.isNativePlatform();
  const hasRealBaseline =
    startScore !== null &&
    (baselineScore !== undefined ||
      Boolean(baseline && (baseline.gradedCount ?? baseline.muscles.length) > 0));
  const owner = (displayName?.trim() || username?.trim() || "DEADSET ATHLETE").toUpperCase();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawStrengthMapCard(ctx, {
      owner,
      username,
      current,
      currentColors,
      nowScore,
      startScore,
      currentTier,
      hasRealBaseline,
    });
    setDataUrl(canvas.toDataURL("image/png"));
  }, [current, currentColors, currentTier, hasRealBaseline, nowScore, owner, startScore, username]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const handleDialogKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKey);
    return () => {
      window.removeEventListener("keydown", handleDialogKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function close() {
    hapticSelection();
    onClose();
  }

  function download(withHaptic = true) {
    if (withHaptic) hapticSelection();
    if (!dataUrl) return;
    if (Capacitor.isNativePlatform()) {
      toast.error("Use the share sheet to save the image");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `deadset-strength-${safeFilename(username || displayName || "athlete")}.png`;
    link.click();
    toast.success("Strength map saved");
  }

  async function shareNow() {
    hapticSelection();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasBlob(canvas);
      const file = new File([blob], "deadset-strength-map.png", { type: "image/png" });
      const canShareFile =
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
      if (canShareFile) {
        const scoreText = nowScore === null ? "building my score" : `${nowScore}/100`;
        const tierText = currentTier?.replace("_", " ") ?? "STRENGTH MAP BUILDING";
        await navigator.share({
          files: [file],
          title: "My DEADSET strength map",
          text: `${tierText} · ${scoreText}. Built from my actual lifts. #deadset #gymtok`,
        });
        hapticMilestone();
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
    download(false);
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[220] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strength-map-share-title"
      onClick={close}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <p id="strength-map-share-title" className="label-cap text-xs font-bold text-white">
            YOUR STRENGTH MAP
          </p>
          <p className="text-[10px] text-grit-dim">9:16 · TikTok / Reels / Shorts ready</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            close();
          }}
          className="icon-btn flex min-h-11 min-w-11 items-center justify-center text-grit"
          aria-label="Close strength map share card"
        >
          <X size={22} />
        </button>
      </header>

      <div
        className="flex flex-1 flex-col items-center overflow-auto px-5 pb-6"
        onClick={(event) => event.stopPropagation()}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`${owner}'s ${currentTier?.replace("_", " ").toLowerCase() ?? "building"} strength map`}
            className="w-full max-w-[300px] rounded-xl shadow-2xl"
            style={{ border: `2px solid ${currentTier ? TIER_COLOR[currentTier] : "#62656d"}55` }}
          />
        ) : (
          <div className="flex h-[533px] w-full max-w-[300px] items-center justify-center rounded-xl bg-[#111]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-red border-t-transparent" />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        <p className="mt-4 max-w-xs text-center text-[11px] leading-relaxed text-grit-dim">
          Every colour comes from a logged lift. Share your map now, then come back stronger.
        </p>

        <div
          className={`mt-5 grid w-full max-w-xs gap-3 ${native ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {!native && (
            <button
              type="button"
              onClick={() => download()}
              disabled={!dataUrl}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-grit bg-grit-card px-3 py-3 text-sm font-bold text-white press disabled:opacity-50"
            >
              <Download size={16} />
              Save
            </button>
          )}
          <button
            type="button"
            onClick={shareNow}
            disabled={!dataUrl}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-red px-3 py-3 text-sm font-bold text-white press disabled:opacity-50"
          >
            <Share2 size={16} />
            {native ? "Share or save" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DrawOptions {
  owner: string;
  username?: string | null;
  current?: StrengthMapSnapshot | null;
  currentColors: StrengthMapGradeColors;
  nowScore: number | null;
  startScore: number | null;
  currentTier: StrengthTier | null;
  hasRealBaseline: boolean;
}

function drawStrengthMapCard(ctx: CanvasRenderingContext2D, options: DrawOptions) {
  const { currentColors, currentTier } = options;
  const tierColor = currentTier ? TIER_COLOR[currentTier] : "#62656d";

  const background = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  background.addColorStop(0, "#070708");
  background.addColorStop(0.52, "#0c0d10");
  background.addColorStop(1, "#090607");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const glow = ctx.createRadialGradient(900, 540, 0, 900, 540, 880);
  glow.addColorStop(0, `${tierColor}2e`);
  glow.addColorStop(0.52, `${tierColor}0b`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, 1380);

  drawGrid(ctx);

  ctx.fillStyle = ACCENT_RED;
  roundedPath(ctx, 60, 62, 10, 84, 5);
  ctx.fill();
  ctx.fillStyle = "#f6f6f3";
  ctx.font = "900 italic 76px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("DEAD", 91, 126);
  const deadWidth = ctx.measureText("DEAD").width;
  ctx.fillStyle = ACCENT_RED;
  ctx.fillText("SET", 91 + deadWidth, 126);

  ctx.fillStyle = "#74757c";
  ctx.font = "800 20px Arial, sans-serif";
  ctx.fillText("STRENGTH, MADE VISIBLE", 92, 168);

  ctx.fillStyle = "#f4f4f1";
  ctx.textAlign = "right";
  ctx.font = "900 27px Arial, sans-serif";
  ctx.fillText(options.owner.slice(0, 24), CARD_WIDTH - 60, 104);
  if (options.username) {
    ctx.fillStyle = "#777980";
    ctx.font = "700 20px Arial, sans-serif";
    ctx.fillText(`@${options.username.replace(/^@/, "").slice(0, 24)}`, CARD_WIDTH - 60, 142);
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "#7c7e85";
  ctx.font = "800 23px Arial, sans-serif";
  ctx.fillText("YOUR STRENGTH", 60, 238);
  ctx.fillStyle = "#f6f6f3";
  ctx.font = "900 64px 'Arial Black', Impact, sans-serif";
  ctx.fillText("BUILT, NOT GUESSED.", 58, 304);

  drawProgressStrip(ctx, options, tierColor);

  const mapX = 60;
  const mapY = 486;
  const mapW = CARD_WIDTH - 120;
  const mapH = 770;
  ctx.fillStyle = "rgba(24,25,29,.96)";
  roundedPath(ctx, mapX, mapY, mapW, mapH, 28);
  ctx.fill();
  ctx.strokeStyle = "#2f3137";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#8c8e95";
  ctx.font = "800 20px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("STRENGTH MAP", mapX + 30, mapY + 47);
  ctx.textAlign = "right";
  ctx.fillText("FRONT + BACK", mapX + mapW - 30, mapY + 47);

  drawAnatomy(ctx, MALE_FRONT, 94, 556, 404, 606, currentColors);
  drawAnatomy(ctx, MALE_BACK, 582, 556, 404, 606, currentColors);

  drawFigureLabel(ctx, 296, 1210, "FRONT");
  drawFigureLabel(ctx, 784, 1210, "BACK");

  ctx.fillStyle = "#797b82";
  ctx.font = "700 20px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("COLOUR EARNED FROM YOUR ACTUAL LIFTS", CARD_WIDTH / 2, 1307);

  ctx.fillStyle = "#f3f3f0";
  ctx.font = "900 33px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SIX AREAS. ONE BODY.", 60, 1372);
  ctx.fillStyle = "#777980";
  ctx.font = "700 20px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("KEEP BUILDING THE GREY", CARD_WIDTH - 60, 1371);

  GRADED_MUSCLES.forEach((group, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const gap = 14;
    const tileW = (CARD_WIDTH - 120 - gap * 2) / 3;
    const x = 60 + column * (tileW + gap);
    const y = 1403 + row * 153;
    const color = currentColors[group] ?? EMPTY_MUSCLE;
    drawMuscleTile(ctx, {
      x,
      y,
      width: tileW,
      group,
      color,
      tier: resolvedTier(group, options.current, currentColors[group]),
      score: resolvedMuscleScore(group, options.current),
    });
  });

  ctx.fillStyle = "#70727a";
  ctx.font = "700 21px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    options.hasRealBaseline
      ? "START = YOUR FIRST 90 DAYS  ·  NOW = YOUR LATEST BESTS"
      : "BASELINE BUILDING — NO START SCORE HAS BEEN INVENTED",
    CARD_WIDTH / 2,
    1750,
  );

  ctx.strokeStyle = `${tierColor}88`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 1803);
  ctx.lineTo(CARD_WIDTH - 60, 1803);
  ctx.stroke();

  ctx.fillStyle = "#f1f1ee";
  ctx.font = "900 26px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("HOW STRONG ARE YOU?", 60, 1860);
  ctx.fillStyle = ACCENT_RED;
  ctx.textAlign = "right";
  ctx.fillText("DEADSETFIT.ORG  ·  #DEADSET", CARD_WIDTH - 60, 1860);
  ctx.textAlign = "left";
}

function drawProgressStrip(ctx: CanvasRenderingContext2D, options: DrawOptions, tierColor: string) {
  const x = 60;
  const y = 336;
  const width = CARD_WIDTH - 120;
  const height = 116;
  ctx.fillStyle = "rgba(18,19,22,.95)";
  roundedPath(ctx, x, y, width, height, 22);
  ctx.fill();
  ctx.strokeStyle = `${tierColor}55`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#777980";
  ctx.font = "800 18px Arial, sans-serif";
  ctx.fillText(
    options.hasRealBaseline ? "START · FIRST 90 DAYS" : "START · BASELINE BUILDING",
    x + 28,
    y + 37,
  );
  ctx.fillStyle = options.hasRealBaseline ? "#f3f3f0" : "#6b6d74";
  ctx.font = "900 46px 'Arial Black', Impact, sans-serif";
  ctx.fillText(options.hasRealBaseline ? String(options.startScore) : "—", x + 28, y + 91);

  ctx.fillStyle = "#55575e";
  ctx.font = "900 36px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("→", x + 335, y + 79);

  ctx.fillStyle = "#777980";
  ctx.font = "800 18px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("NOW · LATEST BESTS", x + 393, y + 37);
  ctx.fillStyle = "#f3f3f0";
  ctx.font = "900 46px 'Arial Black', Impact, sans-serif";
  ctx.fillText(options.nowScore === null ? "—" : String(options.nowScore), x + 393, y + 91);
  ctx.fillStyle = "#6f7178";
  ctx.font = "800 17px Arial, sans-serif";
  ctx.fillText("/ 100", x + 474, y + 89);

  const label = options.currentTier?.replace("_", " ") ?? "BUILDING";
  ctx.font = "900 22px Arial, sans-serif";
  const badgeW = Math.max(176, ctx.measureText(label).width + 50);
  ctx.fillStyle = `${tierColor}24`;
  roundedPath(ctx, x + width - badgeW - 24, y + 29, badgeW, 58, 29);
  ctx.fill();
  ctx.strokeStyle = tierColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = tierColor;
  ctx.textAlign = "center";
  ctx.fillText(label, x + width - badgeW / 2 - 24, y + 66);
  ctx.textAlign = "left";
}

function drawMuscleTile(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    width: number;
    group: StrengthMapGroup;
    color: string;
    tier: StrengthTier | null;
    score: number | null;
  },
) {
  const { x, y, width, group, color, tier, score } = options;
  ctx.fillStyle = "#121317";
  roundedPath(ctx, x, y, width, 132, 18);
  ctx.fill();
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = color;
  roundedPath(ctx, x + 16, y + 16, 8, 55, 4);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#f1f1ee";
  ctx.font = "900 22px Arial, sans-serif";
  ctx.fillText(group, x + 37, y + 40);
  ctx.fillStyle = tier ? color : "#6e7077";
  ctx.font = "800 17px Arial, sans-serif";
  ctx.fillText(tier ? tier.replace("_", " ") : "NOT GRADED", x + 37, y + 67);

  ctx.fillStyle = "#292b30";
  roundedPath(ctx, x + 16, y + 94, width - 32, 9, 5);
  ctx.fill();
  if (score !== null) {
    ctx.fillStyle = color;
    roundedPath(ctx, x + 16, y + 94, Math.max(9, ((width - 32) * score) / 100), 9, 5);
    ctx.fill();
  }
  ctx.fillStyle = "#74767d";
  ctx.font = "700 16px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(score === null ? "—" : `${score}/100`, x + width - 16, y + 124);
}

function drawFigureLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string) {
  ctx.fillStyle = "rgba(9,10,12,.88)";
  roundedPath(ctx, x - 61, y - 28, 122, 43, 22);
  ctx.fill();
  ctx.strokeStyle = "#3b3d43";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#aaaab0";
  ctx.font = "800 17px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y);
}

function drawAnatomy(
  ctx: CanvasRenderingContext2D,
  diagram: BodyDiagram,
  x: number,
  y: number,
  width: number,
  height: number,
  gradeColors: StrengthMapGradeColors,
) {
  const [viewX, viewY, viewWidth, viewHeight] = diagram.viewBox.split(" ").map(Number);
  const scale = Math.min(width / viewWidth!, height / viewHeight!);
  const offsetX = x + (width - viewWidth! * scale) / 2 - viewX! * scale;
  const offsetY = y + (height - viewHeight! * scale) / 2 - viewY! * scale;
  const anatomyColors = new Map<AnatomyGroup, string>();
  for (const group of GRADED_MUSCLES) {
    const color = gradeColors[group];
    if (!color) continue;
    for (const anatomyGroup of GROUP_ANATOMY[group]) anatomyColors.set(anatomyGroup, color);
  }

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  drawDiagramPaths(ctx, diagram, diagram.outline, () => BODY_BASE, BODY_OUTLINE, 8);
  const muscles = [...diagram.muscles, ...(diagram.view === "FRONT" ? FRONT_HIP_FLEXORS : [])];
  drawDiagramPaths(
    ctx,
    diagram,
    muscles,
    (path) => anatomyColors.get((path as MusclePath).group) ?? EMPTY_MUSCLE,
    MUSCLE_OUTLINE,
    7,
  );
  ctx.restore();
}

function drawDiagramPaths<T extends MusclePath | OutlinePath>(
  ctx: CanvasRenderingContext2D,
  diagram: BodyDiagram,
  paths: readonly T[],
  fillFor: (path: T) => string,
  stroke: string,
  lineWidth: number,
) {
  for (const definition of paths) {
    const path = new Path2D(definition.d);
    ctx.fillStyle = fillFor(definition);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.fill(path);
    ctx.stroke(path);
    if (definition.side === "LEFT") {
      ctx.save();
      ctx.translate(diagram.centerX * 2, 0);
      ctx.scale(-1, 1);
      ctx.fill(path);
      ctx.stroke(path);
      ctx.restore();
    }
  }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.022)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_WIDTH; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_HEIGHT; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "athlete"
  );
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create strength map image"));
    }, "image/png");
  });
}
