import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { DEFAULT_STATE } from "./default-state";

const KEY = "grit_app_state_v1";

const listeners = new Set<() => void>();

let remoteSyncEnabled = false;
let suppressNextPush = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushSaver: ((json: string) => Promise<void>) | null = null;

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
    if (suppressNextPush) { suppressNextPush = false; return; }
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

export function setState(updater: (s: AppState) => AppState) {
  const next = updater(read());
  write(next);
}

/** Replace local state from a remote payload without pushing it back. */
export function hydrateFromRemote(remote: Partial<AppState>) {
  suppressNextPush = true;
  const merged = { ...DEFAULT_STATE, ...remote } as AppState;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(merged));
  listeners.forEach((l) => l());
}

export function clearLocalState() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function enableRemoteSync(saver: (json: string) => Promise<void>) {
  remoteSyncEnabled = true;
  pushSaver = saver;
}

export function disableRemoteSync() {
  remoteSyncEnabled = false;
  pushSaver = null;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
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
    () => JSON.stringify(DEFAULT_STATE)
  );
  const parsed: AppState = mounted ? JSON.parse(state) : DEFAULT_STATE;
  return [parsed, setState];
}
