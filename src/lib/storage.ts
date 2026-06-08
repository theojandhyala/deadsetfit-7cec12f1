import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { DEFAULT_STATE } from "./default-state";

const KEY = "grit_app_state_v1";
const OWNER_KEY = "grit_app_state_owner_v1";

const listeners = new Set<() => void>();
const syncListeners = new Set<() => void>();

let remoteSyncEnabled = false;
let suppressNextPush = false;
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
    if (suppressNextPush) {
      suppressNextPush = false;
      return;
    }
    if (pushTimer) clearTimeout(pushTimer);
    const saver = pushSaver;
    pushTimer = setTimeout(() => {
      saver(JSON.stringify(state)).catch((e) => console.warn("state sync failed", e));
    }, 1200);
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

/** Replace local state from a remote payload without pushing it back. */
export function hydrateFromRemote(remote: Partial<AppState>, userId?: string) {
  suppressNextPush = true;
  const current = read();
  const merged = { ...DEFAULT_STATE, ...current, ...remote } as AppState;
  if (!remote.profile && current.profile) merged.profile = current.profile;
  if (!remote.schedule && current.schedule) merged.schedule = current.schedule;
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
}

/** Force-flush any pending push immediately and also push current state. */
export async function flushRemoteState() {
  if (!remoteSyncEnabled || !pushSaver) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  try {
    await pushSaver(JSON.stringify(read()));
  } catch (e) {
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
