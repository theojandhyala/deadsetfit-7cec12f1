import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppState } from "./types";

const KEY = "grit_app_state_v1";

const DEFAULT_STATE: AppState = {
  profile: null,
  schedule: null,
  logs: [],
  checkIns: [],
  weights: [],
  measurements: [],
  foodLog: [],
  mealPlan: null,
  completedDates: [],
  programs: [],
  activeProgramId: null,
};

const listeners = new Set<() => void>();

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
}

export function getState(): AppState {
  return read();
}

export function setState(updater: (s: AppState) => AppState) {
  const next = updater(read());
  write(next);
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
