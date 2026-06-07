import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatJSON } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RunCoachInput = z.object({
  distanceKm: z.number().min(0).max(500),
  durationSec: z.number().min(0).max(86400),
  avgPaceSecPerKm: z.number().min(0).max(3600),
  bestKmPaceSecPerKm: z.number().min(0).max(3600).optional(),
  splits: z.array(z.number().min(0).max(3600)).max(200),
  elevGainM: z.number().min(0).max(10000).optional(),
  recentRunsKm: z.array(z.number().min(0).max(500)).max(10).optional(),
});

export type RunCoachInsight = {
  headline: string;
  verdict: string;
  tips: string[];
  nextWorkout: string;
};

export const getRunCoachTips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RunCoachInput.parse(d))
  .handler(async ({ data }): Promise<RunCoachInsight> => {
    const fmtPace = (s: number) => {
      if (!s) return "—";
      const m = Math.floor(s / 60);
      const sec = Math.round(s % 60);
      return `${m}:${String(sec).padStart(2, "0")}/km`;
    };
    const splitsTxt = data.splits.length
      ? data.splits.map((s, i) => `km${i + 1} ${fmtPace(s)}`).join(", ")
      : "no full km splits";
    const recent = data.recentRunsKm?.length
      ? `Recent runs (km): ${data.recentRunsKm.map((k) => k.toFixed(2)).join(", ")}.`
      : "No recent run history.";

    const sys = `You are an elite running coach. Reply with strict JSON only:
{"headline":"...","verdict":"...","tips":["...","...","..."],"nextWorkout":"..."}

Style:
- "headline": 3-6 words, punchy, all-caps allowed, no emoji.
- "verdict": one sentence (max 25 words) honestly grading the run — encouraging but real.
- "tips": exactly 3 actionable tips, each under 20 words. Reference the runner's actual splits, pacing pattern (positive/negative split, fade, surge), or elevation when relevant. No generic fluff.
- "nextWorkout": one concrete session to do next (under 25 words). Example: "Easy 5k @ 6:00/km tomorrow to recover, then 4×800m intervals Thursday."

Never invent data the runner did not provide. Speak directly to the runner ("you").`;

    const user = `Run summary:
- Distance: ${data.distanceKm.toFixed(2)} km
- Time: ${Math.round(data.durationSec / 60)} min ${data.durationSec % 60} sec
- Avg pace: ${fmtPace(data.avgPaceSecPerKm)}
- Best km: ${fmtPace(data.bestKmPaceSecPerKm ?? 0)}
- Elevation gain: ${data.elevGainM ?? 0} m
- Splits: ${splitsTxt}
${recent}

Analyze and respond.`;

    return await chatJSON<RunCoachInsight>({ system: sys, user });
  });
