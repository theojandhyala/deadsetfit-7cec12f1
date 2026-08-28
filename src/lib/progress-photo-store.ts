import { supabase } from "@/integrations/supabase/client";

import type { CheckIn } from "./types";

/**
 * Where progress photos actually live.
 *
 * They used to be base64 data URLs inside the synced state blob. That blob is
 * capped at 2,000,000 bytes to match the server, and a stored check-in
 * measures ~122 KB for an ordinary photo — so somewhere between three and
 * sixteen of them fill the whole payload before a single workout is counted.
 * Past the cap the client stops pushing and cloud backup of everything, not
 * just the photos, silently pauses.
 *
 * Objects go to a private bucket under a folder named for the owner. Reads are
 * short-lived signed URLs: these are photographs of people's bodies and must
 * never sit behind a guessable public path.
 */

export const PROGRESS_PHOTO_BUCKET = "progress-photos";

/** Signed URLs are minted for an hour and cached for slightly less. */
const SIGNED_URL_TTL_SECONDS = 3600;
const CACHE_TTL_MS = (SIGNED_URL_TTL_SECONDS - 300) * 1000;

const signedUrlCache = new Map<string, { url: string; expires: number }>();

/** A check-in whose image is already an object, rather than inline bytes. */
export function isStoredPhoto(checkIn: Pick<CheckIn, "photoPath">): boolean {
  return !!checkIn.photoPath;
}

function objectPath(userId: string): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${id}.jpg`;
}

/** Turn a data URL into bytes without a network round trip. */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const [, mime, isBase64, payload] = match;
  try {
    if (isBase64) {
      const binary = atob(payload!);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload!)], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Upload a photo and return its object path.
 *
 * Throws on failure rather than returning null: the caller decides whether to
 * fall back to storing the bytes inline, and silently losing a check-in
 * somebody just posed for is not an option.
 */
export async function uploadProgressPhoto(blob: Blob, userId: string): Promise<string> {
  const path = objectPath(userId);
  const { error } = await supabase.storage.from(PROGRESS_PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** A signed, time-limited URL for one stored photo. */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(PROGRESS_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  signedUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + CACHE_TTL_MS });
  return data.signedUrl;
}

/**
 * A displayable source for a check-in, whichever era it comes from.
 *
 * Legacy entries carry their bytes inline and keep working untouched — an
 * athlete's existing photos must not disappear because storage moved.
 */
export async function resolveCheckInSrc(checkIn: CheckIn): Promise<string | null> {
  if (checkIn.photoPath) {
    const url = await signedPhotoUrl(checkIn.photoPath);
    // Fall back to inline bytes if the signature failed but they still exist —
    // during migration a check-in can legitimately carry both.
    if (url) return url;
  }
  return checkIn.photoDataUrl || null;
}

/** Remove a stored object. Best-effort: a stale object is not worth an error. */
export async function deleteStoredPhoto(path: string): Promise<void> {
  signedUrlCache.delete(path);
  await supabase.storage
    .from(PROGRESS_PHOTO_BUCKET)
    .remove([path])
    .catch(() => undefined);
}

/**
 * Move one legacy inline photo into storage.
 *
 * Returns the new check-in, or null when nothing could be done. Migration is
 * per-photo and idempotent so a partial run leaves a consistent state: every
 * check-in is either fully inline or fully stored, never half of each.
 */
export async function migrateCheckIn(checkIn: CheckIn, userId: string): Promise<CheckIn | null> {
  if (checkIn.photoPath || !checkIn.photoDataUrl) return null;
  const blob = dataUrlToBlob(checkIn.photoDataUrl);
  if (!blob) return null;
  const path = await uploadProgressPhoto(blob, userId);
  // The data URL is dropped here, which is the entire point: leaving it would
  // move the bytes without shrinking the blob they were bloating.
  return { date: checkIn.date, photoPath: path };
}

/** Longest edge of a stored check-in, in pixels. */
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.8;

/** Downscale a camera photo to something worth storing. */
function downscale(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode that photo."))),
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    image.src = url;
  });
}

/**
 * Turn a picked file into a check-in.
 *
 * Uploads when there is somewhere to upload to; keeps the bytes inline when
 * there is not. Falling back matters more than the storage saving: somebody
 * standing in a bathroom who just posed for this must not lose it because
 * they were offline or signed out. The migration pass moves it later.
 */
export async function captureCheckIn(file: File, userId: string | null): Promise<CheckIn> {
  const blob = await downscale(file);
  const date = new Date().toISOString();
  if (userId) {
    try {
      return { date, photoPath: await uploadProgressPhoto(blob, userId) };
    } catch {
      // Fall through to inline.
    }
  }
  return { date, photoDataUrl: await blobToDataUrl(blob) };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not encode that photo."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Move every legacy inline photo into storage, oldest first.
 *
 * Runs once in the background after sign-in. Without it, moving storage helps
 * only new photos and every athlete who already has a library stays exactly as
 * stuck as before — which was the whole problem.
 *
 * `apply` is called per successful photo rather than once at the end, so a run
 * interrupted by a closed app still banks the ones it finished.
 */
export async function migrateInlinePhotos(
  checkIns: CheckIn[],
  userId: string,
  apply: (date: string, migrated: CheckIn) => void,
): Promise<number> {
  let moved = 0;
  for (const checkIn of checkIns) {
    if (checkIn.photoPath || !checkIn.photoDataUrl) continue;
    try {
      const migrated = await migrateCheckIn(checkIn, userId);
      if (!migrated) continue;
      apply(checkIn.date, migrated);
      moved += 1;
    } catch {
      // One failure must not abandon the rest — a partially migrated library
      // is strictly smaller than an unmigrated one, and the next run resumes.
    }
  }
  return moved;
}
