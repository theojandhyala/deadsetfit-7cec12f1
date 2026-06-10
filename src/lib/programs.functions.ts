import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatJSON } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DayItem = z.object({
  name: z.string(),
  primary_muscles: z.array(z.string()),
});
const DayInput = z.object({
  label: z.string(),
  items: z.array(DayItem),
});

const SmartSuggestInput = z.object({
  goal: z.string(),
  experience: z.string(),
  days: z.array(DayInput),
  candidates: z
    .array(z.object({ id: z.string(), name: z.string(), primary_muscles: z.array(z.string()) }))
    .max(400),
});

export const smartSuggest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SmartSuggestInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are an elite strength coach reviewing a weekly training program.
Reply STRICT JSON only:
{"gaps":[{"day":"label","muscle":"muscle-slug","reason":"short reason","suggested_ids":["uuid","uuid"]}]}
suggested_ids MUST be picked from the provided candidates list (by id). Max 4 gaps. Max 2 ids per gap.
Look for: undertrained muscles (rear-delts, rotator-cuff, hamstrings, calves, core), imbalances (push >> pull), missing direct work.`;
    const user = `Goal: ${data.goal}. Experience: ${data.experience}.
Program:
${data.days.map((d) => `- ${d.label}: ${d.items.map((i) => `${i.name} [${i.primary_muscles.join(",")}]`).join("; ") || "(empty)"}`).join("\n")}

Candidate library (id — name — muscles):
${data.candidates
  .slice(0, 200)
  .map((c) => `${c.id} — ${c.name} — ${c.primary_muscles.join(",")}`)
  .join("\n")}

Return gaps with suggested_ids drawn ONLY from the candidate ids above.`;
    return await chatJSON<{
      gaps: { day: string; muscle: string; reason: string; suggested_ids: string[] }[];
    }>({ system: sys, user });
  });
