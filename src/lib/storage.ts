import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { DEFAULT_STATE } from "./default-state";

const KEY = "grit_app_state_v1";
const OWNER_KEY = "grit_app_state_owner_v1";
const PENDING_SYNC_KEY = "grit_app_state_pending_sync_v1";

const listeners = new Set<() => void>();
const syncListeners = new Set<() => void>();

let remoteSyncEnabled = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushSaver: ((json: string) => Promise<void>) | null = null;
let syncUserId: string | null = null;
let syncReady = false;

function notifySync() {
  syncListeners.forEach((l) => l());
}

function read(): AppState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) } as AppState;
  } catch {
    return DEFAULT_STATE;
  }
}

function write(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
  if (remoteSyncEnabled && pushSaver) {
    if (pushTimer) clearTimeout(pushTimer);
    const saver = pushSaver;
    const json = JSON.stringify(state);
    pushTimer = setTimeout(() => {
      saver(json)
        .then(() => clearPendingRemoteState(json))
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
    localStorage.setItem(KEY, JSON.stringify(merged));
    if (userId) localStorage.setItem(OWNER_KEY, userId);
  }
  listeners.forEach((l) => l());
}

export function clearLocalState() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OWNER_KEY);
  }
  listeners.forEach((l) => l());
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

export function enableRemoteSync(saver: (json: string) => Promise<void>) {
  remoteSyncEnabled = true;
  pushSaver = saver;
  const pending = readPendingRemoteState();
  if (pending) {
    saver(pending)
      .then(() => clearPendingRemoteState(pending))
      .catch((e) => console.warn("pending state sync failed", e));
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
  const onStorage = () => l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): [AppState, (u: (s: AppState) => AppState) => void] {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(read()),
    () => JSON.stringify(DEFAULT_STATE),
  );
  const parsed: AppState = mounted ? JSON.parse(state) : DEFAULT_STATE;
  return [parsed, setState];
}
