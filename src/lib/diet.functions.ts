import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatJSON, chatVisionJSON } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// === Photo food analysis ===
const PhotoInput = z.object({ imageDataUrl: z.string().min(20).max(5_000_000) });

export const analyzeFoodPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PhotoInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a nutritionist. Identify the meal in the photo and estimate macros for the visible portion. Reply with strict JSON only:
{"name":"...","calories":0,"protein":0,"carbs":0,"fats":0,"confidence":"low|medium|high","notes":"..."}`;
    return await chatVisionJSON<{
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      confidence: string;
      notes: string;
    }>({
      system: sys,
      user: "Identify this food and estimate nutrition for the visible portion.",
      imageDataUrl: data.imageDataUrl,
    });
  });

// === Barcode lookup via Open Food Facts (no API key) ===
const BarcodeInput = z.object({ barcode: z.string().regex(/^[0-9]{6,14}$/) });

export const lookupBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BarcodeInput.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${data.barcode}.json`, {
      headers: { "User-Agent": "DEADSET-App/1.0" },
    });
    if (!res.ok) throw new Error("Lookup failed");
    const json = (await res.json()) as {
      status: number;
      product?: {
        product_name?: string;
        brands?: string;
        nutriments?: {
          "energy-kcal_100g"?: number;
          proteins_100g?: number;
          carbohydrates_100g?: number;
          fat_100g?: number;
        };
        serving_size?: string;
      };
    };
    if (json.status !== 1 || !json.product) throw new Error("Product not found");
    const p = json.product;
    const n = p.nutriments || {};
    return {
      name: [p.brands, p.product_name].filter(Boolean).join(" — ") || "Unknown product",
      calories: Math.round(n["energy-kcal_100g"] ?? 0),
      protein: Math.round(n.proteins_100g ?? 0),
      carbs: Math.round(n.carbohydrates_100g ?? 0),
      fats: Math.round(n.fat_100g ?? 0),
      serving: p.serving_size ?? "100g",
    };
  });

// === Weekly nutrition report ===
const WeeklyInput = z.object({
  goal: z.string(),
  targetCalories: z.number(),
  targetProtein: z.number(),
  days: z
    .array(
      z.object({
        date: z.string(),
        calories: z.number(),
        protein: z.number(),
        carbs: z.number(),
        fats: z.number(),
        waterMl: z.number(),
      }),
    )
    .min(1)
    .max(14),
});

export const weeklyNutritionReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WeeklyInput.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are an elite sports nutritionist reviewing a week of intake. Reply with strict JSON only:
{"grade":"A+|A|B|C|D|F","adherence":0,"avgCalories":0,"avgProtein":0,"hydrationScore":0,"wins":["..."],"misses":["..."],"action":"one specific action for next week"}
Where adherence and hydrationScore are 0-100.`;
    const user = `Goal: ${data.goal}. Target ${data.targetCalories} kcal / ${data.targetProtein}g protein.\nLog:\n${data.days.map((d) => `${d.date}: ${d.calories}kcal P${d.protein} C${d.carbs} F${d.fats} water:${d.waterMl}ml`).join("\n")}`;
    return await chatJSON<{
      grade: string;
      adherence: number;
      avgCalories: number;
      avgProtein: number;
      hydrationScore: number;
      wins: string[];
      misses: string[];
      action: string;
    }>({
      system: sys,
      user,
    });
  });
