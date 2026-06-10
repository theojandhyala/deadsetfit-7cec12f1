import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatJSON } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScheduleInput = z.object({
  goal: z.string(),
  experience: z.string(),
  daysPerWeek: z.number(),
  equipment: z.string(),
});

export const generateSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScheduleInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a strength coach. Reply with strict JSON only.
The JSON shape must be:
{"days":{"MON":{"label":"PUSH — CHEST / SHOULDERS / TRICEPS","exerciseIds":["bench-press","ohp"]}, ...all 7 days...}}
Use only these exerciseIds: bench-press, incline-db-press, cable-fly, dips, push-ups, deadlift, pull-ups, lat-pulldown, seated-row, face-pull, squat, rdl, leg-press, lunges, leg-curl, ohp, lateral-raise, front-raise, rear-delt-fly, barbell-curl, hammer-curl, skull-crushers, tricep-pushdown, plank, hanging-leg-raise, cable-crunch, ab-wheel.
Labels must be uppercase, e.g. "PUSH — CHEST / SHOULDERS / TRICEPS", "PULL — BACK / BICEPS", "LEGS — QUADS / HAMS / GLUTES", "REST".
Include exactly ${data.daysPerWeek} training days and the rest as REST with empty exerciseIds.`;
    const user = `Goal: ${data.goal}. Experience: ${data.experience}. Days/week: ${data.daysPerWeek}. Equipment: ${data.equipment}. Build the split.`;
    return await chatJSON<{ days: Record<string, { label: string; exerciseIds: string[] }> }>({
      system: sys,
      user,
    });
  });

const MealsInput = z.object({
  goal: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fats: z.number(),
  dislikes: z.string().optional(),
  constraints: z.string().optional(),
});

export const generateMeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MealsInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a sports nutritionist. Reply with strict JSON only:
{"breakfast":{"name":"...","calories":0,"protein":0,"carbs":0,"fats":0},"lunch":{...},"dinner":{...},"snack":{...}}
Total of all 4 meals should approximate the daily targets.`;
    const constraintsPart = data.constraints
      ? ` Preferences/restrictions: ${data.constraints}.`
      : "";
    const user = `Goal: ${data.goal}. Target ${data.calories} kcal, P${data.protein} C${data.carbs} F${data.fats}. Dislikes: ${data.dislikes || "none"}.${constraintsPart} Suggest practical, varied meals.`;
    return await chatJSON<{
      breakfast: { name: string; calories: number; protein: number; carbs: number; fats: number };
      lunch: { name: string; calories: number; protein: number; carbs: number; fats: number };
      dinner: { name: string; calories: number; protein: number; carbs: number; fats: number };
      snack: { name: string; calories: number; protein: number; carbs: number; fats: number };
    }>({ system: sys, user });
  });

const SwapInput = z.object({
  name: z.string(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fats: z.number(),
});

export const swapMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SwapInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `Reply with strict JSON only: {"name":"...","calories":0,"protein":0,"carbs":0,"fats":0}. Suggest one alternative meal with matching macros (±10%).`;
    const user = `Current: ${data.name} (${data.calories} kcal, P${data.protein} C${data.carbs} F${data.fats}). Give one different but similar-macro alternative.`;
    return await chatJSON<{
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    }>({
      system: sys,
      user,
    });
  });
