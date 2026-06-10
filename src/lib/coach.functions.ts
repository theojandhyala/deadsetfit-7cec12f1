import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatText } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const CoachInput = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  context: z
    .object({
      goal: z.string().optional(),
      experience: z.string().optional(),
      weightKg: z.number().optional(),
      heightCm: z.number().optional(),
      benchKg: z.number().optional(),
      squatKg: z.number().optional(),
      deadliftKg: z.number().optional(),
      streak: z.number().optional(),
    })
    .optional(),
});

export const coachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CoachInput.parse(d))
  .handler(async ({ data }) => {
    const c = data.context ?? {};
    const ctxLines = [
      c.goal && `Goal: ${c.goal}`,
      c.experience && `Experience: ${c.experience}`,
      c.weightKg && `Bodyweight: ${c.weightKg}kg`,
      c.heightCm && `Height: ${c.heightCm}cm`,
      c.benchKg && `Bench 1RM: ${c.benchKg}kg`,
      c.squatKg && `Squat 1RM: ${c.squatKg}kg`,
      c.deadliftKg && `Deadlift 1RM: ${c.deadliftKg}kg`,
      typeof c.streak === "number" && `Current streak: ${c.streak} days`,
    ]
      .filter(Boolean)
      .join("\n");

    const system = `You are DEADSET Coach — a direct, no-fluff strength & conditioning coach inside the DEADSET fitness app.
Tone: brief, practical, motivating, never preachy. Use lbs only if the user does, otherwise kg.
Format: short answers (1-3 short paragraphs or a tight bulleted list). Never lecture. Never refuse safe training questions.
Always assume the athlete is healthy unless told otherwise; recommend seeing a doctor only for sharp pain, numbness, or chest issues.
Avoid emoji walls. No medical diagnosis. No supplements that aren't food/creatine/whey/caffeine.

Athlete profile:
${ctxLines || "(no profile context provided)"}
`;

    const reply = await chatText({
      system,
      messages: data.messages,
    });
    return { reply };
  });
