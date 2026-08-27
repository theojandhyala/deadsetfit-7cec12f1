import { Capacitor } from "@capacitor/core";

import { getState } from "./storage";
import type { CompletedSet, WorkoutSession } from "./types";

export type DeliveryResult = "delivered" | "cancelled" | "failed";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Deliver a generated file to the user. Anchor downloads silently no-op inside
 * the iOS Capacitor webview, so the share sheet is the only handover there.
 * Desktop browsers also pass canShare({files}) — they must NOT get the share
 * sheet (Safari would offer AirDrop/Mail with no way to save to disk), so the
 * share path is gated to the native shell.
 */
async function deliverFile(
  filename: string,
  content: string,
  mimeType: string,
): Promise<DeliveryResult> {
  const blob = new Blob([content], { type: mimeType });

  if (Capacitor.isNativePlatform()) {
    const file = new File([blob], filename, { type: mimeType });
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file] });
        return "delivered";
      } catch (e) {
        // User dismissed the share sheet — nothing was delivered.
        if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
        // Anything else (e.g. share failed mid-flight): fall through to anchor.
      }
    }
  }

  // Anchor downloads no-op inside the iOS webview — never claim success there.
  if (Capacitor.isNativePlatform()) return "failed";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "delivered";
}

/** Download a full JSON backup of everything stored on this device. */
export async function exportJsonBackup(): Promise<DeliveryResult> {
  const json = JSON.stringify(getState(), null, 2);
  return deliverFile(`deadset-backup-${todayIso()}.json`, json, "application/json");
}

/** How a row should describe itself: "working", "warmup", "drop", "hold"... */
function setType(set: CompletedSet): string {
  if (set.mode === "duration") return set.kind ? `${set.kind}-hold` : "hold";
  if (set.mode === "distance") return set.kind ? `${set.kind}-distance` : "distance";
  return set.kind ?? "working";
}

/**
 * Build a CSV of workout history: one row per logged set. Only sessions with
 * `endedAt` set are included — unfinished sessions never count anywhere in
 * this app, so they must not appear in exports either.
 */
export function buildWorkoutCsv(sessions: WorkoutSession[]): string {
  // set_type, seconds and meters are not optional extras: without them a
  // plank exports as "0 reps, 0 kg" and a rowing interval as nothing at all,
  // which would silently drop whole movements out of an athlete's own data.
  const rows: string[] = [
    "date,workout,exercise,set,set_type,reps,weight_kg,seconds,meters,rpe,pr",
  ];
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
            csvEscape(setType(set)),
            set.reps,
            set.weight,
            set.seconds ?? "",
            set.meters ?? "",
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
 * Download workout history as CSV. Returns "empty" when there are no finished
 * sessions to export, otherwise reports whether the file was delivered or the
 * user cancelled the (native) share sheet.
 */
export async function exportWorkoutCsv(): Promise<DeliveryResult | "empty"> {
  const sessions = getState().sessions.filter((s) => s.endedAt);
  if (sessions.length === 0) return "empty";
  return deliverFile(`deadset-workouts-${todayIso()}.csv`, buildWorkoutCsv(sessions), "text/csv");
}
