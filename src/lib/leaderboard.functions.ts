import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CategorySchema = z.enum(["OVERALL", "BENCH", "SQUAT", "DEADLIFT", "TOTAL"]);

const Input = z.object({
  category: CategorySchema,
  limit: z.number().int().min(1).max(100).optional(),
});

export type LeaderboardCategory = z.infer<typeof CategorySchema>;
export type LeaderboardRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: string | null;
  value: number;
  unit: string;
};

type TopPR = { id?: string; value?: number; unit?: string };
type PublicStats = {
  overall?: number;
  topPRs?: TopPR[];
};

function getPRValue(stats: PublicStats, id: string): number {
  const pr = (stats.topPRs ?? []).find((p) => p?.id === id);
  return Number(pr?.value ?? 0);
}

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url, level, public_stats")
      .limit(500);
    if (error) throw error;

    const cat = data.category;
    const enriched: LeaderboardRow[] = (rows ?? [])
      .filter((r): r is typeof r & { id: string } => typeof r.id === "string")
      .map((r) => {

        const stats = (r.public_stats ?? {}) as PublicStats;
        let value = 0;
        let unit = "kg";
        if (cat === "OVERALL") {
          value = Number(stats.overall ?? 0);
          unit = "OVR";
        } else if (cat === "TOTAL") {
          value = getPRValue(stats, "bench-press") + getPRValue(stats, "squat") + getPRValue(stats, "deadlift");
        } else if (cat === "BENCH") {
          value = getPRValue(stats, "bench-press");
        } else if (cat === "SQUAT") {
          value = getPRValue(stats, "squat");
        } else if (cat === "DEADLIFT") {
          value = getPRValue(stats, "deadlift");
        }
        return {
          id: r.id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          level: r.level,
          value: Math.round(value * 10) / 10,
          unit,
        };
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, data.limit ?? 50);

    return { rows: enriched };
  });
