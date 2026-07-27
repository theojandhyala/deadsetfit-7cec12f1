import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AtSign } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, saveProfile } from "@/lib/profile.functions";
import { flushRemoteState, useAppState } from "@/lib/storage";

/**
 * Blocking modal: if the signed-in user has no username yet, force them to
 * pick one. Saves instantly and dismisses.
 */
export function UsernameGate() {
  const fetchProfile = getMyProfile;
  const save = saveProfile;
  const [, setAppState] = useAppState();
  const [open, setOpen] = useState(false);
  // DOM-owned input (defaultValue + ref); onChange sanitizes the DOM value
  // imperatively and mirrors a shadow copy for the validity check. A controlled
  // value= binding freezes typing in the iOS WKWebView.
  const inputRef = useRef<HTMLInputElement>(null);
  const [clean, setClean] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function check() {
    // Onboarding asks for name + username itself — popping this gate on top of
    // it made new users pick a username twice. It stays a safety net for
    // profiles that somehow reach the app without one.
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth")) {
      setOpen(false);
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setOpen(false);
        return;
      }
      const profile = await fetchProfile().catch(() => null);
      if (profile && !profile.username) setOpen(true);
      else setOpen(false);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    check();
    const { data } = supabase.auth.onAuthStateChange(() => check());
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  const valid = clean.length >= 3;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await save({ data: { username: clean, display_name: clean } });
      setAppState((state) =>
        state.profile ? { ...state, profile: { ...state.profile, username: clean } } : state,
      );
      await flushRemoteState().catch(() => {});
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save username");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 px-6">
      <div className="deadset-panel w-full max-w-sm p-6">
        <div className="relative">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-accent-red/40 bg-accent-red/10 text-accent-red">
              <AtSign size={18} />
            </span>
            <div>
              <p className="deadset-kicker">Athlete identity</p>
              <h2 className="display mt-2 text-3xl font-black uppercase leading-none text-grit">
                Claim your name
              </h2>
            </div>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-grit-dim">
            This is how you appear on leaderboards, rival cards and your public profile.
          </p>
          <div className="flex items-center gap-2 mb-2 border-b-2 border-grit focus-within:border-accent-red">
            <span className="text-2xl font-display font-extrabold text-grit-dim pb-2">@</span>
            <input
              ref={inputRef}
              autoFocus
              defaultValue=""
              onChange={(e) => {
                const c = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_]/g, "")
                  .slice(0, 20);
                e.target.value = c;
                setClean(c);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="bg-transparent outline-none text-2xl font-display font-extrabold text-grit flex-1 pb-2 min-w-0"
              placeholder="ironwolf"
            />
          </div>
          <p className="text-xs text-grit-dim mb-4">3–20 chars · a–z, 0–9, _</p>
          {error && <p className="text-xs text-accent-red mb-3">{error}</p>}
          <button
            disabled={!valid || saving}
            onClick={submit}
            className="btn-grit w-full disabled:opacity-50"
          >
            {saving ? "Saving…" : "Lock it in"}
          </button>
        </div>
      </div>
    </div>
  );
}
