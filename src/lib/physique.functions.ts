import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPro } from "@/lib/require-pro.server";

const ScanInput = z.object({
  imageDataUrl: z.string().startsWith("data:image/").max(5_000_000),
  goal: z.string(),
  weightKg: z.number().optional(),
});

const VALID_EXERCISE_IDS = [
  "bench-press","incline-db-press","cable-fly","dips","push-ups",
  "deadlift","pull-ups","lat-pulldown","seated-row","face-pull",
  "squat","rdl","leg-press","lunges","leg-curl",
  "ohp","lateral-raise","front-raise","rear-delt-fly",
  "barbell-curl","hammer-curl","skull-crushers","tricep-pushdown",
  "plank","hanging-leg-raise","cable-crunch","ab-wheel",
];

export const analyzePhysique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScanInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPro(context.supabase, context.userId);
    const { chatVisionJSON } = await import("./ai-gateway.server");
    const sys = `You are an elite physique coach analyzing a progress photo. Reply with strict JSON only:
{
  "bodyFatEstimate": <number 5-40>,
  "muscleScore": <0-100>,
  "symmetryScore": <0-100>,
  "leanMassNote": "ONE uppercase sentence under 70 chars",
  "strengths": ["SHORT POINT","SHORT POINT","SHORT POINT"],
  "weaknesses": ["SHORT POINT","SHORT POINT","SHORT POINT"],
  "focus": ["MUSCLE GROUP","MUSCLE GROUP","MUSCLE GROUP"],
  "verdict": "ONE bold uppercase motivating sentence under 90 chars",
  "exerciseRecommendations": [
    {"exerciseId":"<id>","reason":"SHORT UPPERCASE REASON UNDER 60 CHARS"},
    {"exerciseId":"<id>","reason":"..."},
    {"exerciseId":"<id>","reason":"..."},
    {"exerciseId":"<id>","reason":"..."}
  ]
}
exerciseId MUST be one of: ${VALID_EXERCISE_IDS.join(", ")}.
Pick 4 exercises that directly address the identified weaknesses and focus areas.
Be honest but constructive. If the image is not a clear physique photo, return all zeros, empty arrays, and verdict "RETAKE WITH BETTER LIGHTING AND POSE".`;
    const user = `Goal: ${data.goal}. ${data.weightKg ? `Weight: ${data.weightKg}kg.` : ""} Analyze the physique and recommend 4 targeted exercises.`;
    const result = await chatVisionJSON<{
      bodyFatEstimate: number;
      muscleScore: number;
      symmetryScore: number;
      leanMassNote: string;
      strengths: string[];
      weaknesses: string[];
      focus: string[];
      verdict: string;
      exerciseRecommendations?: { exerciseId: string; reason: string }[];
    }>({ system: sys, user, imageDataUrl: data.imageDataUrl });

    // Filter out invalid exercise ids
    if (result.exerciseRecommendations) {
      result.exerciseRecommendations = result.exerciseRecommendations.filter((r) =>
        VALID_EXERCISE_IDS.includes(r.exerciseId),
      );
    }
    return result;
  });
