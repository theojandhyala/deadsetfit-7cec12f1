import type { CheckIn, MeasurementEntry, WeightEntry } from "./types";

// Data freshness — the analytics upstairs (Adaptive TDEE, trends, the
// catalogue) are only as good as what gets logged. This nudges when a data
// stream the athlete ALREADY USES has gone quiet. Never-used features are
// onboarding's job, not a nag's.

export type FreshnessKind = "WEIGHT" | "MEASUREMENTS" | "PHOTO";

export interface FreshnessNudge {
  kind: FreshnessKind;
  daysSince: number;
  message: string;
}

const DAY_MS = 86_400_000;

const LIMITS: Record<FreshnessKind, number> = {
  WEIGHT: 10,
  MEASUREMENTS: 35,
  PHOTO: 30,
};

function daysSince(lastIso: string, todayIso: string): number | null {
  const last = new Date(`${lastIso.slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  if (!Number.isFinite(last) || !Number.isFinite(today) || last > today) return null;
  return Math.floor((today - last) / DAY_MS);
}

function latestDate(dates: string[]): string | null {
  let latest: string | null = null;
  for (const d of dates) {
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

export function staleData(
  weights: WeightEntry[],
  measurements: MeasurementEntry[],
  checkIns: CheckIn[],
  todayIso: string,
): FreshnessNudge[] {
  const out: FreshnessNudge[] = [];

  const streams: { kind: FreshnessKind; last: string | null; message: (d: number) => string }[] = [
    {
      kind: "WEIGHT",
      last: latestDate((weights ?? []).map((w) => w.date)),
      message: (d) =>
        `No weigh-in for ${d} days — Adaptive TDEE and your weight trend go blind without the scale.`,
    },
    {
      kind: "MEASUREMENTS",
      last: latestDate((measurements ?? []).map((m) => m.date)),
      message: (d) =>
        `Last tape measurement was ${d} days ago — the scale can't see muscle; the tape can.`,
    },
    {
      kind: "PHOTO",
      last: latestDate((checkIns ?? []).map((c) => c.date)),
      message: (d) => `Last progress photo was ${d} days ago — future you wants the receipts.`,
    },
  ];

  for (const s of streams) {
    if (!s.last) continue; // never used — not this card's business
    const d = daysSince(s.last, todayIso);
    if (d === null || d < LIMITS[s.kind]) continue;
    out.push({ kind: s.kind, daysSince: d, message: s.message(d) });
  }

  // Most-overdue relative to its own limit first; two nudges max.
  return out
    .sort((a, b) => b.daysSince / LIMITS[b.kind] - a.daysSince / LIMITS[a.kind])
    .slice(0, 2);
}
