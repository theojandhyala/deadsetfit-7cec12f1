import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatJSON } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LibraryExercise {
  id: string;
  slug: string;
  name: string;
  category: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  difficulty: number;
  instructions: string;
  pro_tip: string;
  youtube_query: string;
  warmup_note: string;
  stretch_note: string;
  is_compound: boolean;
}

const ListInput = z.object({
  category: z.string().optional(),
  equipment: z.string().optional(),
  muscle: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  search: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export const listExercises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("exercises").select("*").order("name").limit(data.limit);
    if (data.category) q = q.eq("category", data.category);
    if (data.equipment) q = q.eq("equipment", data.equipment);
    if (data.difficulty) q = q.eq("difficulty", data.difficulty);
    if (data.muscle) q = q.contains("primary_muscles", [data.muscle]);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { exercises: (rows ?? []) as LibraryExercise[] };
  });

export const countExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("exercises")
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const ALLOWED_EQUIPMENT = ["BARBELL", "DUMBBELL", "CABLE", "MACHINE", "BODYWEIGHT", "BANDS", "KETTLEBELL"];
const ALLOWED_CATEGORIES = ["PUSH", "PULL", "LEGS", "CORE", "CARDIO"];

const ExSchema = z.object({
  name: z.string().min(2).max(80),
  category: z.enum(["PUSH", "PULL", "LEGS", "CORE", "CARDIO"]),
  primary_muscles: z.array(z.string()).min(1).max(4),
  secondary_muscles: z.array(z.string()).max(4).default([]),
  equipment: z.enum(["BARBELL", "DUMBBELL", "CABLE", "MACHINE", "BODYWEIGHT", "BANDS", "KETTLEBELL"]),
  difficulty: z.number().int().min(1).max(5),
  instructions: z.string().min(10).max(300),
  pro_tip: z.string().min(5).max(220),
  youtube_query: z.string().min(3).max(80),
  warmup_note: z.string().max(160).default(""),
  stretch_note: z.string().max(160).default(""),
  is_compound: z.boolean().default(false),
});

const BatchInput = z.object({
  batchSize: z.number().int().min(5).max(30).default(20),
  focus: z.string().min(3).max(80),
});

/**
 * Generates a batch of exercises for a given focus (e.g. "barbell back",
 * "dumbbell shoulders", "kettlebell core"). The client orchestrates
 * multiple focus prompts to reach 500+. Idempotent: inserts skip on slug
 * conflict via upsert.
 */
export const generateExerciseBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BatchInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden: admin role required");
    const sys = `You are an elite strength coach building a hypertrophy + strength exercise library.
Reply with STRICT JSON only, shape:
{"exercises":[{"name":"...","category":"PUSH|PULL|LEGS|CORE|CARDIO","primary_muscles":["..."],"secondary_muscles":["..."],"equipment":"BARBELL|DUMBBELL|CABLE|MACHINE|BODYWEIGHT|BANDS|KETTLEBELL","difficulty":1-5,"instructions":"1-2 cue sentences","pro_tip":"1 elite-athlete tip","youtube_query":"3-6 word search","warmup_note":"short cue","stretch_note":"short cue","is_compound":true|false}]}
Use lowercase hyphenated muscle names like chest, upper-chest, lats, mid-back, rear-delts, side-delts, front-delts, biceps, triceps, forearms, brachialis, quads, hamstrings, glutes, calves, core, obliques, hip-flexors, traps, rotator-cuff.
No duplicates. Practical, well-known movements. Variety in difficulty and equipment.`;
    const user = `Generate exactly ${data.batchSize} distinct exercises focused on: ${data.focus}. Avoid the obvious staples (bench press, deadlift, back squat, OHP, lat pulldown, pull-ups, dips, push-ups, barbell curl) — go a level deeper.`;
    const out = await chatJSON<{ exercises: unknown[] }>({ system: sys, user });
    const parsed = z.object({ exercises: z.array(ExSchema).min(1) }).parse(out);

    // Dedupe on slug, then upsert
    const rows = parsed.exercises.map((e) => ({
      slug: slug(e.name),
      name: e.name,
      category: ALLOWED_CATEGORIES.includes(e.category) ? e.category : "PUSH",
      primary_muscles: e.primary_muscles,
      secondary_muscles: e.secondary_muscles,
      equipment: ALLOWED_EQUIPMENT.includes(e.equipment) ? e.equipment : "BODYWEIGHT",
      difficulty: e.difficulty,
      instructions: e.instructions,
      pro_tip: e.pro_tip,
      youtube_query: e.youtube_query,
      warmup_note: e.warmup_note,
      stretch_note: e.stretch_note,
      is_compound: e.is_compound,
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from("exercises")
      .upsert(rows, { onConflict: "slug", ignoreDuplicates: true })
      .select("slug");
    if (error) throw new Error(error.message);
    return { added: inserted?.length ?? 0, attempted: rows.length };
  });
