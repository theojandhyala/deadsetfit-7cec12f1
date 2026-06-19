import type { Session } from "@supabase/supabase-js";

const SESSION_LOG_KEY = "deadset_session_logs_v1";
const SESSION_SNAPSHOT_KEY = "deadset_session_snapshot_v1";
const PROFILE_BOOTSTRAP_PREFIX = "deadset_profile_bootstrap_";
const MAX_LOGS = 80;

type SessionLogEntry = {
  at: string;
  event: string;
  route?: string;
  details?: Record<string, string | number | boolean | null>;
};

type ProfileBootstrapSnapshot = {
  checkedAt: number;
  onboarded: boolean;
  complete: boolean;
  hasUsername: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function userRef(userId?: string | null) {
  return userId ? `${userId.slice(0, 8)}…` : null;
}

function sessionDetails(session: Session | null) {
  return {
    hasSession: Boolean(session),
    user: userRef(session?.user?.id),
    provider: session?.user?.app_metadata?.provider ?? null,
    expiresAt: session?.expires_at ?? null,
  };
}

function exposeLogReader() {
  if (!isBrowser()) return;
  (window as Window & { DEADSET_SESSION_LOGS?: () => SessionLogEntry[] }).DEADSET_SESSION_LOGS =
    () => readSessionLogs();
}

export function readSessionLogs(): SessionLogEntry[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_LOG_KEY) || "[]") as SessionLogEntry[];
  } catch {
    return [];
  }
}

export function logSessionEvent(
  event: string,
  details: Record<string, string | number | boolean | null> = {},
) {
  if (!isBrowser()) return;
  const entry: SessionLogEntry = {
    at: new Date().toISOString(),
    event,
    route: window.location.pathname,
    details,
  };
  const logs = [...readSessionLogs(), entry].slice(-MAX_LOGS);
  sessionStorage.setItem(SESSION_LOG_KEY, JSON.stringify(logs));
  exposeLogReader();
  console.info(`[DEADSET session] ${event}`, entry.details ?? {});
}

export function recordSessionSnapshot(source: string, session: Session | null) {
  if (!isBrowser()) return;
  if (!session) {
    sessionStorage.removeItem(SESSION_SNAPSHOT_KEY);
    logSessionEvent(`${source}:no-session`, { hasSession: false });
    return;
  }
  sessionStorage.setItem(
    SESSION_SNAPSHOT_KEY,
    JSON.stringify({
      cachedAt: Date.now(),
      userId: session.user.id,
      expiresAt: session.expires_at ?? null,
      provider: session.user.app_metadata?.provider ?? null,
    }),
  );
  logSessionEvent(`${source}:session`, sessionDetails(session));
}

export async function getLoggedSession(source: string, timeoutMs = 2500): Promise<Session | null> {
  if (!isBrowser()) return null;
  logSessionEvent(`${source}:get-session-start`);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<"timeout">((resolve) => {
        timeoutId = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
    ]);
    if (result === "timeout") {
      logSessionEvent(`${source}:get-session-timeout`, { timeoutMs });
      return null;
    }
    const session = result.data.session ?? null;
    recordSessionSnapshot(source, session);
    return session;
  } catch (e) {
    logSessionEvent(`${source}:get-session-error`, {
      message: e instanceof Error ? e.message : "Unknown error",
    });
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function cacheProfileBootstrap(
  userId: string,
  snapshot: Omit<ProfileBootstrapSnapshot, "checkedAt">,
) {
  if (!isBrowser()) return;
  sessionStorage.setItem(
    `${PROFILE_BOOTSTRAP_PREFIX}${userId}`,
    JSON.stringify({ ...snapshot, checkedAt: Date.now() } satisfies ProfileBootstrapSnapshot),
  );
  logSessionEvent("profile-bootstrap-cache:set", {
    user: userRef(userId),
    onboarded: snapshot.onboarded,
    complete: snapshot.complete,
    hasUsername: snapshot.hasUsername,
  });
}

export function getCachedProfileBootstrap(userId: string, maxAgeMs = 60_000) {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(`${PROFILE_BOOTSTRAP_PREFIX}${userId}`);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as ProfileBootstrapSnapshot;
    if (Date.now() - snapshot.checkedAt > maxAgeMs) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function clearSessionDiagnostics() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(SESSION_SNAPSHOT_KEY);
  sessionStorage.removeItem(SESSION_LOG_KEY);
  exposeLogReader();
  console.info("[DEADSET session] session-diagnostics:cleared");
}