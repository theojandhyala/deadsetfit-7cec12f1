import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScanInput = z.object({
  imageDataUrl: z.string().startsWith("data:image/"),
  goal: z.string(),
  weightKg: z.number().optional(),
});

export const analyzePhysique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScanInput.parse(d))
  .handler(async ({ data }) => {
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
  "verdict": "ONE bold uppercase motivating sentence under 90 chars"
}
Be honest but constructive. If the image is not a clear physique photo, return all zeros and verdict "RETAKE WITH BETTER LIGHTING AND POSE".`;
    const user = `Goal: ${data.goal}. ${data.weightKg ? `Weight: ${data.weightKg}kg.` : ""} Analyze.`;
    return await chatVisionJSON<{
      bodyFatEstimate: number;
      muscleScore: number;
      symmetryScore: number;
      leanMassNote: string;
      strengths: string[];
      weaknesses: string[];
      focus: string[];
      verdict: string;
    }>({ system: sys, user, imageDataUrl: data.imageDataUrl });
  });
