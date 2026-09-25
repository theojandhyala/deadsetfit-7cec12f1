import { z } from "zod";

export const activityQuery = z.object({
  userId: z.string().uuid(),
  before: z
    .object({ createdAt: z.string().datetime({ offset: true }), id: z.string().uuid() })
    .optional(),
});
export type ActivityQuery = z.infer<typeof activityQuery>;
export interface ActivityPost {
  id: string;
  user_id: string;
  kind: string;
  content: string;
  image_url: string | null;
  metadata: unknown;
  created_at: string;
}
export interface ActivityPage {
  posts: ActivityPost[];
  next: ActivityQuery["before"] | null;
}

export function activityPage(rows: ActivityPost[]): ActivityPage {
  const posts = rows.slice(0, 12);
  const last = posts.at(-1);
  return {
    posts,
    next: rows.length > 12 && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/** Public post metadata is user-supplied; never render arbitrary objects or NaN as a PR. */
export function activitySummary(post: Pick<ActivityPost, "kind" | "metadata">) {
  const meta =
    post.metadata && typeof post.metadata === "object" && !Array.isArray(post.metadata)
      ? (post.metadata as Record<string, unknown>)
      : {};
  const lift = typeof meta.lift === "string" ? meta.lift.trim().slice(0, 80) : "";
  const weight =
    typeof meta.weight === "number" && Number.isFinite(meta.weight) && meta.weight > 0
      ? meta.weight
      : null;
  const reps =
    typeof meta.reps === "number" && Number.isInteger(meta.reps) && meta.reps > 0
      ? meta.reps
      : null;
  if (post.kind === "pr" && lift && weight !== null)
    return { title: lift, detail: `${weight} kg${reps ? ` × ${reps}` : ""}`, label: "Shared PR" };
  return {
    title:
      post.kind === "workout"
        ? "Work put in"
        : post.kind === "progress"
          ? "Progress update"
          : post.kind === "pr"
            ? "Personal record"
            : "From the gym",
    detail: "",
    label:
      post.kind === "pr"
        ? "Shared PR"
        : post.kind === "workout"
          ? "Workout"
          : post.kind === "progress"
            ? "Progress"
            : "Update",
  };
}

export function safeActivityImage(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? url : null;
  } catch {
    return null;
  }
}
