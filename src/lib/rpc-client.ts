import { restoreSupabaseSession, supabase } from "@/integrations/supabase/client";

const DEFAULT_API_ORIGIN = "https://deadsetfit.org";

function configuredApiOrigin() {
  const value = import.meta.env.VITE_API_ORIGIN;
  return typeof value === "string" && value.trim() ? value.trim().replace(/\/$/, "") : "";
}

function isNativeShell() {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "ionic:" ||
    window.Capacitor?.isNativePlatform?.() === true
  );
}

function rpcUrl() {
  const explicit = configuredApiOrigin();
  if (explicit) return `${explicit}/api/rpc`;
  if (isNativeShell()) return `${DEFAULT_API_ORIGIN}/api/rpc`;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${DEFAULT_API_ORIGIN}/api/rpc`;
  }
  return "/api/rpc";
}

export async function callRpc<T>(fn: string, data?: unknown): Promise<T> {
  const send = async (token?: string) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      return await fetch(rpcUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ fn, data }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("DEADSET took too long to respond. Check your connection and try again.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  await restoreSupabaseSession().catch(() => {});
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let res = await send(session?.access_token);

  // A tab can wake up with an expired access token before the background
  // refresher runs. Refresh once and replay only after an auth rejection.
  if (res.status === 401 && session) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (!error && refreshed.session?.access_token) {
      res = await send(refreshed.session.access_token);
    }
  }

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: "The server returned an invalid response" }));
    throw new Error(err.error ?? `RPC ${fn} failed (${res.status})`);
  }
  const json = await res.json().catch(() => {
    throw new Error("The server returned an invalid response");
  });
  if (json.error) throw new Error(json.error);
  return json.result as T;
}
