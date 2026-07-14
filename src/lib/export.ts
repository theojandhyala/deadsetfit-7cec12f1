import { getState } from "./storage";
import type { WorkoutSession } from "./types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Deliver a generated file to the user. On platforms where anchor downloads
 * don't work (iOS Capacitor webview), the Web Share API with file support is
 * available — prefer the share sheet there. Everywhere else, fall back to a
 * Blob object-URL + temporary anchor click.
 */
async function deliverFile(filename: string, content: string, mimeType: string): Promise<void> {
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      // User dismissed the share sheet — not an error, and nothing to download.
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Anything else (e.g. share failed mid-flight): fall through to anchor.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download a full JSON backup of everything stored on this device. */
export async function exportJsonBackup(): Promise<void> {
  const json = JSON.stringify(getState(), null, 2);
  await deliverFile(`deadset-backup-${todayIso()}.json`, json, "application/json");
}

/**
 * Build a CSV of workout history: one row per logged set. Only sessions with
 * `endedAt` set are included — unfinished sessions never count anywhere in
 * this app, so they must not appear in exports either.
 */
export function buildWorkoutCsv(sessions: WorkoutSession[]): string {
  const rows: string[] = ["date,workout,exercise,set,reps,weight_kg,rpe,pr"];
  const finished = sessions
    .filter((s) => s.endedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const session of finished) {
    for (const exercise of session.exercises) {
      exercise.sets.forEach((set, i) => {
        rows.push(
          [
            csvEscape(session.date),
            csvEscape(session.label),
            csvEscape(exercise.name),
            i + 1,
            set.reps,
            set.weight,
            set.rpe ?? "",
            set.isPR ? "yes" : "",
          ].join(","),
        );
      });
    }
  }
  return rows.join("\n");
}

/**
 * Download workout history as CSV. Returns false when there are no finished
 * sessions to export (so the caller can tell the user), true otherwise.
 */
export async function exportWorkoutCsv(): Promise<boolean> {
  const sessions = getState().sessions.filter((s) => s.endedAt);
  if (sessions.length === 0) return false;
  await deliverFile(`deadset-workouts-${todayIso()}.csv`, buildWorkoutCsv(sessions), "text/csv");
  return true;
}
