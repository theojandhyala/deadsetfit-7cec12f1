import { useCallback, useEffect, useState } from "react";
import { Users, Copy, LogOut, Plus, Crown, Shield, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  createCrew,
  getCrewLadder,
  getMyCrew,
  joinCrew,
  leaveCrew,
  type Crew,
  type CrewLadderRow,
  type CrewMember,
  type CrewWeek,
} from "@/lib/crew.functions";
import { askConfirm } from "@/lib/confirm";

function errorText(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Crews: the gym or team an athlete trains with. Joined by a short code,
 * ranked inside, and stacked against every other crew.
 */
export function CrewPanel() {
  const [crew, setCrew] = useState<Crew | null>(null);
  const [role, setRole] = useState<string | undefined>();
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [week, setWeek] = useState<CrewWeek | null>(null);
  const [ladder, setLadder] = useState<CrewLadderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mine = await getMyCrew();
      setCrew(mine.crew);
      setRole(mine.role);
      setMembers(mine.members ?? []);
      setWeek(mine.week ?? null);
      const board = await getCrewLadder({ data: { limit: 10 } });
      setLadder(board.crews ?? []);
    } catch (e) {
      toast.error(errorText(e, "Couldn't load crews"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate() {
    if (name.trim().length < 2) return toast.error("Give the crew a name");
    if (!/^[A-Za-z0-9]{2,6}$/.test(tag.trim())) return toast.error("Tag: 2-6 letters or numbers");
    setBusy(true);
    try {
      await createCrew({ data: { name: name.trim(), tag: tag.trim().toUpperCase() } });
      toast.success("Crew created");
      setMode("none");
      setName("");
      setTag("");
      await load();
    } catch (e) {
      toast.error(errorText(e, "Couldn't create the crew"));
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    if (code.trim().length < 4) return toast.error("Enter the crew code");
    setBusy(true);
    try {
      const res = await joinCrew({ data: { code: code.trim().toUpperCase() } });
      toast.success(`Joined ${res.crew.name}`);
      setMode("none");
      setCode("");
      await load();
    } catch (e) {
      toast.error(errorText(e, "Couldn't join that crew"));
    } finally {
      setBusy(false);
    }
  }

  async function onLeave() {
    const ok = await askConfirm({
      title: "Leave crew?",
      message:
        role === "owner"
          ? "You'll hand the crew to the longest-standing member. If you're the last one, the crew is retired."
          : "You'll drop off this crew's board.",
      confirmLabel: "Leave",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await leaveCrew();
      await load();
      toast.success("Left the crew");
    } catch (e) {
      toast.error(errorText(e, "Couldn't leave"));
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!crew) return;
    navigator.clipboard
      ?.writeText(crew.invite_code)
      .then(() => toast.success("Code copied — send it to your gym"))
      .catch(() => toast.error("Couldn't copy"));
  }

  if (loading) {
    return (
      <section className="deadset-section">
        <div className="deadset-3d-panel flex items-center justify-center bg-grit-card p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-red border-t-transparent" />
        </div>
      </section>
    );
  }

  return (
    <section className="deadset-section">
      <div className="deadset-section-title mb-2">
        <h2 className="display text-xl font-extrabold uppercase leading-none text-grit">Crew</h2>
        <button onClick={load} className="icon-btn text-grit-dim" aria-label="Refresh crews">
          <RefreshCw size={14} />
        </button>
      </div>

      {crew ? (
        <div className="deadset-3d-panel border border-grit bg-grit-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="label-cap bg-accent-red px-1.5 py-0.5 text-[9px] text-white">
                  {crew.tag}
                </span>
                <p className="display truncate text-lg font-extrabold uppercase text-white">
                  {crew.name}
                </p>
              </div>
              <p className="mt-1 text-[10px] text-grit-dim">
                {members.length} {members.length === 1 ? "member" : "members"}
                {role === "owner" ? " · you own this crew" : ""}
              </p>
            </div>
            <button onClick={onLeave} disabled={busy} className="icon-btn text-grit-dim">
              <LogOut size={16} />
            </button>
          </div>

          <button
            onClick={copyCode}
            className="btn-ghost mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 text-xs"
          >
            <Copy size={14} /> Invite code: <span className="text-white">{crew.invite_code}</span>
          </button>

          {week && (
            <div className="mt-4 border border-grit bg-[#101010] p-3">
              <div className="flex items-baseline justify-between">
                <p className="label-cap text-[10px] text-accent-red">This week</p>
                <p className="text-[10px] text-grit-dim">
                  {week.active}/{members.length} training
                </p>
              </div>
              <p className="display mt-1 text-3xl font-extrabold leading-none text-white">
                {week.volumeKg.toLocaleString()}
                <span className="ml-1 text-xs text-grit-dim">kg moved</span>
              </p>
              <p className="mt-1 text-[10px] text-grit-dim">
                {week.sessions} {week.sessions === 1 ? "session" : "sessions"} · {week.prs} PRs
              </p>
              {week.volumeKg > 0 && (
                <div className="mt-3 space-y-1.5">
                  {members
                    .filter((m) => m.weekVolumeKg > 0)
                    .sort((a, b) => b.weekVolumeKg - a.weekVolumeKg)
                    .map((m) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 truncate text-[10px] text-grit-dim">
                          {m.display_name || m.username || "Athlete"}
                        </span>
                        <div className="h-2 flex-1 bg-[#1a1a1a]">
                          <div
                            className="h-full bg-accent-red"
                            style={{
                              width: `${Math.max(3, Math.round((m.weekVolumeKg / week.volumeKg) * 100))}%`,
                            }}
                          />
                        </div>
                        <span className="w-14 text-right text-[10px] text-white">
                          {m.weekVolumeKg.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <p className="label-cap mt-4 mb-1 text-[10px] text-grit-dim">All time</p>
          <div className="divide-y divide-[#1f1f1f]">
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <span className="w-5 text-right text-xs text-grit-dim">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">
                    {m.display_name || m.username || "Athlete"}
                    {m.role === "owner" && (
                      <Crown size={11} className="ml-1 inline text-accent-red" />
                    )}
                  </p>
                  {m.username && <p className="text-[10px] text-grit-dim">@{m.username}</p>}
                </div>
                <span className="display text-sm font-extrabold text-accent-red">
                  {m.grit_points}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : mode === "none" ? (
        <div className="deadset-3d-panel border border-grit bg-grit-card p-5 text-center">
          <Users size={22} className="mx-auto mb-2 text-grit-dim" />
          <p className="text-sm text-grit-dim">
            Train with your gym. Crews rank their own members and go head to head with every other
            crew.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("join")}
              className="btn-ghost min-h-[44px] text-xs"
            >
              Join with code
            </button>
            <button
              onClick={() => setMode("create")}
              className="btn-grit flex min-h-[44px] items-center justify-center gap-1.5 text-xs"
            >
              <Plus size={14} /> Start a crew
            </button>
          </div>
        </div>
      ) : (
        <div className="deadset-3d-panel border border-grit bg-grit-card p-4">
          {mode === "create" ? (
            <>
              <p className="label-cap mb-2 text-[10px] text-grit-dim">Start a crew</p>
              <input
                defaultValue=""
                onChange={(e) => setName(e.target.value)}
                placeholder="Crew name"
                maxLength={30}
                className="mb-2 w-full rounded-lg border border-grit bg-[#101010] px-3 py-3 text-sm text-white"
              />
              <input
                defaultValue=""
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                placeholder="Tag (2-6 chars, e.g. IRON)"
                maxLength={6}
                className="mb-3 w-full rounded-lg border border-grit bg-[#101010] px-3 py-3 text-sm uppercase text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode("none")} className="btn-ghost min-h-[44px] text-xs">
                  Cancel
                </button>
                <button
                  onClick={onCreate}
                  disabled={busy}
                  className="btn-grit min-h-[44px] text-xs"
                >
                  Create
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="label-cap mb-2 text-[10px] text-grit-dim">Join a crew</p>
              <input
                defaultValue=""
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Invite code"
                maxLength={10}
                className="mb-3 w-full rounded-lg border border-grit bg-[#101010] px-3 py-3 text-center text-lg tracking-[0.3em] text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode("none")} className="btn-ghost min-h-[44px] text-xs">
                  Cancel
                </button>
                <button onClick={onJoin} disabled={busy} className="btn-grit min-h-[44px] text-xs">
                  Join
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {ladder.length > 0 && (
        <div className="mt-4">
          <p className="label-cap mb-2 flex items-center gap-1.5 text-[10px] text-grit-dim">
            <Shield size={11} className="text-accent-red" /> Crew ladder
          </p>
          <div className="deadset-3d-panel divide-y divide-[#1f1f1f] border border-grit bg-grit-card px-4">
            {ladder.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-3 py-2.5"
                style={{ opacity: crew && c.id === crew.id ? 1 : 0.85 }}
              >
                <span className="w-5 text-right text-xs text-grit-dim">{i + 1}</span>
                <span className="label-cap border border-grit px-1.5 py-0.5 text-[9px] text-grit-dim">
                  {c.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{c.name}</p>
                  <p className="text-[10px] text-grit-dim">
                    {c.members} {c.members === 1 ? "member" : "members"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="display text-sm font-extrabold text-accent-red">{c.avgGrit}</p>
                  <p className="label-cap text-[8px] text-grit-dim">avg grit</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
