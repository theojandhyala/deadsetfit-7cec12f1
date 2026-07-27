import { useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { DEFAULT_STATE } from "./default-state";

const KEY = "grit_app_state_v1";
const OWNER_KEY = "grit_app_state_owner_v1";
const PENDING_SYNC_KEY = "grit_app_state_pending_sync_v1";

// Matches the server's user_state payload cap (api/rpc.ts). Above this the push
// is rejected, so we skip it rather than fail silently every 1.2s.
const MAX_SYNC_BYTES = 2_000_000;

const listeners = new Set<() => void>();
const syncListeners = new Set<() => void>();

// Optional UI hook so the (framework-agnostic) store can surface a real toast
// on quota / oversize problems instead of failing silently.
let onSyncIssue: ((message: string) => void) | null = null;
let lastSyncIssue = "";
export function setSyncIssueHandler(fn: ((message: string) => void) | null) {
  onSyncIssue = fn;
}
function reportSyncIssue(message: string) {
  if (message === lastSyncIssue) return; // don't spam the same toast every write
  lastSyncIssue = message;
  onSyncIssue?.(message);
  console.warn(message);
}

let remoteSyncEnabled = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushSaver: ((json: string) => Promise<void>) | null = null;
let syncUserId: string | null = null;
let syncReady = false;

function notifySync() {
  syncListeners.forEach((l) => l());
}

// Snapshot cache: the state object is parsed at most once per mutation and
// keeps a stable identity between mutations, so React subscribers only
// re-render on real changes and never re-parse multi-hundred-KB JSON
// (check-in photos live in this blob) on every render.
let stateVersion = 0;
let cachedVersion = -1;
let cachedState: AppState = DEFAULT_STATE;

function bumpVersion() {
  stateVersion++;
}

function parseFromStorage(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) } as AppState;
  } catch {
    return DEFAULT_STATE;
  }
}

function read(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  if (cachedVersion !== stateVersion) {
    cachedState = parseFromStorage();
    cachedVersion = stateVersion;
  }
  return cachedState;
}

function write(state: AppState) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(state);
  try {
    localStorage.setItem(KEY, serialized);
  } catch (e) {
    // Quota exceeded — don't let it throw out of a React event handler and
    // lose the in-progress interaction; the in-memory cache still updates.
    reportSyncIssue("This device's storage is full — remove some progress photos to keep saving.");
    console.warn("localStorage write failed", e);
  }
  // We already hold the parsed object — seed the cache directly.
  bumpVersion();
  cachedState = state;
  cachedVersion = stateVersion;
  listeners.forEach((l) => l());
  if (remoteSyncEnabled && pushSaver) {
    if (pushTimer) clearTimeout(pushTimer);
    const saver = pushSaver;
    const json = serialized;
    if (json.length > MAX_SYNC_BYTES) {
      // Server rejects oversized blobs. Skip the push (and don't stash a second
      // oversized copy under PENDING_SYNC_KEY, which would amplify the quota
      // problem) — data stays safe on-device; cloud backup pauses until trimmed.
      reportSyncIssue(
        "Your data is too large to back up to the cloud — remove some progress photos to re-enable sync.",
      );
      return;
    }
    pushTimer = setTimeout(() => {
      saver(json)
        .then(() => {
          clearPendingRemoteState(json);
          lastSyncIssue = "";
        })
        .catch((e) => {
          markPendingRemoteState(json);
          console.warn("state sync failed", e);
        });
    }, 1200);
  }
}

function markPendingRemoteState(json: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_SYNC_KEY, json);
  } catch {
    /* ignore */
  }
}

function readPendingRemoteState() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(PENDING_SYNC_KEY);
  } catch {
    return null;
  }
}

function clearPendingRemoteState(json?: string) {
  if (typeof window === "undefined") return;
  try {
    if (json) {
      const current = localStorage.getItem(PENDING_SYNC_KEY);
      if (current && current !== json) return;
    }
    localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    /* ignore */
  }
}

export function getState(): AppState {
  return read();
}

export function getLocalStateOwner() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(OWNER_KEY);
}

export function setLocalStateOwner(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OWNER_KEY, userId);
}

export function setState(updater: (s: AppState) => AppState) {
  const next = updater(read());
  write(next);
}

/** Replace local state from a remote payload without pushing it back.
 *  (Writes localStorage directly — never touches the push pipeline.) */
export function hydrateFromRemote(remote: Partial<AppState>, userId?: string) {
  const current = read();
  const merged = { ...DEFAULT_STATE, ...current, ...remote } as AppState;
  if (!remote.profile && current.profile) merged.profile = current.profile;
  if (!remote.schedule && current.schedule) merged.schedule = current.schedule;
  // Invariant: every armor-rescued day must exist in completedDates. A remote
  // blob that field-replaces one without the other would waste the shield and
  // trigger a double-spend on the next armor run.
  const rescued = merged.streakArmor?.usedDates ?? [];
  if (rescued.length) {
    const days = new Set(merged.completedDates);
    for (const d of rescued) days.add(d);
    merged.completedDates = [...days];
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(merged));
      if (userId) localStorage.setItem(OWNER_KEY, userId);
    } catch (e) {
      console.warn("hydrate write failed", e);
    }
  }
  bumpVersion();
  cachedState = merged;
  cachedVersion = stateVersion;
  listeners.forEach((l) => l());
}

export function clearLocalState() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OWNER_KEY);
    // The pending stash is part of this state — leaving it behind would flush
    // the previous user's unsynced data into the next account's remote.
    localStorage.removeItem(PENDING_SYNC_KEY);
  }
  bumpVersion();
  listeners.forEach((l) => l());
}

/** Reconcile a stashed pending blob (local edits that never reached the
 *  server) BEFORE hydrating from remote. The pending blob is strictly newer
 *  than the fetched remote, so the caller must skip hydrate when this
 *  returns true — otherwise an older remote clobbers the newer local state
 *  and the next debounced push destroys it on the server too.
 *  Returns true when a pending blob exists (pushed or still stashed). */
export async function reconcilePendingRemoteState(
  saver: (json: string) => Promise<void>,
): Promise<boolean> {
  const pending = readPendingRemoteState();
  if (!pending) return false;
  if (pending.length > MAX_SYNC_BYTES) {
    // A stashed oversized blob would fail forever — drop it and let the
    // remote hydrate proceed.
    clearPendingRemoteState(pending);
    return false;
  }
  try {
    await saver(pending);
    clearPendingRemoteState(pending);
  } catch (e) {
    // Push failed (still offline?) — keep the stash for the next retry, and
    // still report "local is newer" so hydrate doesn't wipe it.
    console.warn("pending state reconcile failed", e);
  }
  return true;
}

export function beginRemoteStateLoad(userId: string) {
  syncUserId = userId;
  syncReady = false;
  notifySync();
}

export function finishRemoteStateLoad(userId: string) {
  if (syncUserId === userId) {
    syncReady = true;
    notifySync();
  }
}

export function clearRemoteStateStatus() {
  syncUserId = null;
  syncReady = false;
  notifySync();
}

export function isRemoteStateReady(userId: string) {
  return syncUserId === userId && syncReady;
}

export function waitForRemoteState(userId: string, timeoutMs = 4000) {
  if (isRemoteStateReady(userId)) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      syncListeners.delete(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = () => {
      if (isRemoteStateReady(userId)) done();
    };
    const timer = setTimeout(done, timeoutMs);
    syncListeners.add(listener);
  });
}

let unloadFlushRegistered = false;
function registerUnloadFlush() {
  if (unloadFlushRegistered || typeof window === "undefined") return;
  unloadFlushRegistered = true;
  // iOS kills backgrounded WKWebviews aggressively; flush the debounced write
  // when the app is hidden/closed so the last ~1.2s of changes aren't lost.
  const flush = () => {
    void flushRemoteState();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function enableRemoteSync(saver: (json: string) => Promise<void>) {
  remoteSyncEnabled = true;
  pushSaver = saver;
  registerUnloadFlush();
  const pending = readPendingRemoteState();
  if (pending) {
    if (pending.length > MAX_SYNC_BYTES) {
      // A previously-stashed oversized blob would fail forever — drop it.
      clearPendingRemoteState(pending);
    } else {
      saver(pending)
        .then(() => clearPendingRemoteState(pending))
        .catch((e) => console.warn("pending state sync failed", e));
    }
  }
}

/** Force-flush any pending push immediately and also push current state. */
export async function flushRemoteState() {
  if (!remoteSyncEnabled || !pushSaver) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  const pending = readPendingRemoteState();
  try {
    if (pending) {
      await pushSaver(pending);
      clearPendingRemoteState(pending);
    }
    const json = JSON.stringify(read());
    await pushSaver(json);
    clearPendingRemoteState(json);
  } catch (e) {
    markPendingRemoteState(JSON.stringify(read()));
    console.warn("flushRemoteState failed", e);
  }
}

export function disableRemoteSync() {
  remoteSyncEnabled = false;
  pushSaver = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = () => {
    bumpVersion();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): [AppState, (u: (s: AppState) => AppState) => void] {
  const state = useSyncExternalStore(subscribe, read, () => DEFAULT_STATE);
  return [state, setState];
}
