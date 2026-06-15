import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PumpInput = z.object({
  label: z.string(),
  totalVolume: z.number(),
  prCount: z.number(),
  sets: z.number(),
  durationMin: z.number(),
  exercises: z
    .array(
      z.object({
        name: z.string(),
        sets: z.number(),
        topWeight: z.number(),
        topReps: z.number(),
      }),
    )
    .max(20),
});

export const scorePump = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PumpInput.parse(d))
  .handler(async ({ data }) => {
    const { chatJSON } = await import("./ai-gateway.server");
    const sys = `You are an elite hypertrophy coach. Reply with strict JSON only:
{"score": 0-100, "note": "ONE punchy uppercase sentence under 70 chars"}
Score reflects training stimulus (volume, intensity, PRs, density). Note is motivational, no fluff.`;
    const user = `Workout: ${data.label}. Duration ${data.durationMin}min. ${data.sets} sets. ${data.totalVolume}kg total volume. ${data.prCount} PRs.
Top sets: ${data.exercises.map((e) => `${e.name} ${e.sets}x ${e.topWeight}kg×${e.topReps}`).join("; ")}.
Rate the pump.`;
    return await chatJSON<{ score: number; note: string }>({ system: sys, user });
  });
