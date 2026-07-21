// Auto-post a completed workout to the social feed so the feed is alive with
// real activity instead of being manual-only. Best-effort: silently no-ops when
// the user isn't signed in or the network fails.
import { createPost } from "./social.functions";
import type { WorkoutSession } from "./types";

export async function shareWorkoutToFeed(s: WorkoutSession) {
  try {
    const workingSets = s.exercises.reduce(
      (n, e) => n + e.sets.filter((set) => set.kind !== "warmup").length,
      0,
    );
    if (workingSets === 0) return; // nothing logged — don't post an empty session
    const prNote = s.prCount ? `, ${s.prCount} new PR${s.prCount > 1 ? "s" : ""} 🔥` : "";
    const content = `Finished ${s.label} — ${s.exercises.length} exercise${s.exercises.length === 1 ? "" : "s"}, ${workingSets} set${workingSets === 1 ? "" : "s"}${prNote}.`;
    await createPost({
      data: {
        kind: s.prCount ? "pr" : "workout",
        content,
        metadata: {
          volume: Math.round(s.totalVolume),
          prCount: s.prCount,
          sets: workingSets,
          exercises: s.exercises.length,
          label: s.label,
        },
      },
    });
  } catch {
    /* best-effort — never block workout completion on a feed post */
  }
}
