import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, saveProfile } from "@/lib/profile.functions";

/**
 * Blocking modal: if the signed-in user has no username yet, force them to
 * pick one. Saves instantly and dismisses.
 */
export function UsernameGate() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(saveProfile);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
  }, []);

  if (!open) return null;

  const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  const valid = clean.length >= 3;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await save({ data: { username: clean, display_name: clean } });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save username");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm rounded-2xl border-2 border-accent-red bg-grit-card p-6 shadow-2xl">
        <h2 className="display text-2xl font-extrabold uppercase text-grit mb-1">
          Pick a username
        </h2>
        <p className="text-sm text-[#8a8a8a] mb-5">
          Public. Shown on leaderboards and your profile.
        </p>
        <div className="flex items-center gap-2 mb-2 border-b-2 border-grit focus-within:border-accent-red">
          <span className="text-2xl font-display font-extrabold text-grit-dim pb-2">@</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
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
  );
}
