import { supabase } from "@/integrations/supabase/client";

export async function callRpc<T>(fn: string, data?: unknown): Promise<T> {
  const send = async (token?: string) => fetch("/api/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ fn, data }),
    });

  const { data: { session } } = await supabase.auth.getSession();
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
    const err = await res.json().catch(() => ({ error: "The server returned an invalid response" }));
    throw new Error(err.error ?? `RPC ${fn} failed (${res.status})`);
  }
  const json = await res.json().catch(() => { throw new Error("The server returned an invalid response"); });
  if (json.error) throw new Error(json.error);
  return json.result as T;
}
