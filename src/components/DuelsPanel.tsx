import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Swords, Plus, X, Check, Crown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { usePro } from "@/hooks/usePro";
import { openPaywall } from "@/lib/paywall-events";
import {
  getDuels,
  createDuel,
  respondDuel,
  searchAthletes,
  type Duel,
  type DuelMetric,
} from "@/lib/social.functions";

const METRICS: { key: DuelMetric; label: string; unit: string }[] = [
  { key: "volume", label: "Most volume", unit: "kg" },
  { key: "sessions", label: "Most sessions", unit: "" },
  { key: "prs", label: "Most PRs", unit: "" },
];

function metricUnit(m: DuelMetric) {
  return METRICS.find((x) => x.key === m)?.unit ?? "";
}
function daysLeft(end: string | null): string {
  if (!end) return "";
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const d = Math.ceil(ms / 86400000);
  return d <= 1 ? "ends today" : `${d}d left`;
}

export function DuelsPanel() {
  const { isPro, loading: proLoading } = usePro();
  const [duels, setDuels] = useState<Duel[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setDuels(await getDuels());
    } catch {
      setDuels((d) => d ?? []);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: string, action: "accept" | "decline" | "cancel") {
    setBusy(id);
    try {
      await respondDuel({ data: { duelId: id, action } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update duel");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="label-cap flex items-center gap-1.5 text-accent-red">
          <Swords size={12} /> Duels
        </p>
        <button
          onClick={() => (isPro || proLoading ? setCreating(true) : openPaywall("h2h"))}
          className="label-cap text-[10px] inline-flex items-center gap-1 text-accent-red press"
        >
          <Plus size={12} /> New duel
        </button>
      </div>

      {duels === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-accent-red" size={18} />
        </div>
      ) : duels.length === 0 ? (
        <div className="bg-grit-card border border-grit rounded-2xl p-5 text-center">
          <p className="text-sm text-grit-dim">
            No duels yet. Challenge a friend to a week of most volume, sessions or PRs.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {duels.map((d) => (
            <DuelCard key={d.id} duel={d} busy={busy === d.id} onRespond={respond} />
          ))}
        </div>
      )}

      {creating && <NewDuelModal onClose={() => setCreating(false)} onCreated={load} />}
    </div>
  );
}

function DuelCard({
  duel: d,
  busy,
  onRespond,
}: {
  duel: Duel;
  busy: boolean;
  onRespond: (id: string, a: "accept" | "decline" | "cancel") => void;
}) {
  const metric = METRICS.find((m) => m.key === d.metric);
  const name = d.opponent.display_name || d.opponent.username || "Athlete";
  const youLead = d.myScore > d.theirScore;
  const fmt = (n: number) =>
    d.metric === "volume" ? `${Math.round((n / 1000) * 10) / 10}t` : String(n);

  return (
    <div className="bg-grit-card border border-grit rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <Link
          to="/athlete/$id"
          params={{ id: d.opponent.id }}
          className="flex items-center gap-2 min-w-0 press"
        >
          <div className="w-7 h-7 rounded-full overflow-hidden bg-[#1a1a1a] flex items-center justify-center shrink-0 border border-grit">
            {d.opponent.avatar_url ? (
              <img src={d.opponent.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-grit">{name[0]?.toUpperCase()}</span>
            )}
          </div>
          <span className="text-sm font-bold text-grit truncate">vs {name}</span>
        </Link>
        <span className="label-cap text-[9px] text-grit-dim shrink-0">{metric?.label}</span>
      </div>

      {d.status === "active" || d.status === "completed" ? (
        <>
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 text-center">
              <p className="label-cap text-[9px] text-grit-dim">You</p>
              <p
                className="display text-2xl font-extrabold tabular-nums"
                style={{ color: youLead ? "#22c55e" : "#f5f5f0" }}
              >
                {fmt(d.myScore)}
              </p>
            </div>
            <span className="display font-extrabold text-grit-dim">vs</span>
            <div className="flex-1 text-center">
              <p className="label-cap text-[9px] text-grit-dim truncate">{name}</p>
              <p
                className="display text-2xl font-extrabold tabular-nums"
                style={{ color: !youLead && d.theirScore > d.myScore ? "#e63222" : "#f5f5f0" }}
              >
                {fmt(d.theirScore)}
              </p>
            </div>
          </div>
          <p
            className="text-center text-[11px] mt-1"
            style={{
              color: d.ended
                ? d.winner === "me"
                  ? "#22c55e"
                  : d.winner === "them"
                    ? "#e63222"
                    : "#8a8a8a"
                : "#8a8a8a",
            }}
          >
            {d.ended
              ? d.winner === "me"
                ? "🏆 You won"
                : d.winner === "them"
                  ? "You lost — run it back"
                  : "Dead tie"
              : daysLeft(d.end_at)}
          </p>
        </>
      ) : d.status === "pending" ? (
        d.needsMyResponse ? (
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onRespond(d.id, "accept")}
              disabled={busy}
              className="btn-grit flex-1 py-2 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Check size={13} /> Accept
            </button>
            <button
              onClick={() => onRespond(d.id, "decline")}
              disabled={busy}
              className="btn-ghost flex-1 py-2 text-xs disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-grit-dim">Waiting for {name} to accept…</span>
            <button
              onClick={() => onRespond(d.id, "cancel")}
              disabled={busy}
              className="label-cap text-[10px] text-grit-dim press disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}

function NewDuelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    Array<{
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>
  >([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [metric, setMetric] = useState<DuelMetric>("volume");
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selected) return;
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setResults(await searchAthletes({ data: { q: q.trim() } }));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, selected]);

  async function send() {
    if (!selected) return;
    setSending(true);
    try {
      await createDuel({ data: { opponentId: selected.id, metric } });
      toast.success(`Challenge sent to ${selected.name}`);
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create duel");
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-grit-card border border-grit rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-grit-dim press"
        >
          <X size={18} />
        </button>
        <p className="display font-extrabold uppercase text-grit text-lg flex items-center gap-2 mb-3">
          <Swords size={16} className="text-accent-red" /> New duel
        </p>

        {selected ? (
          <div className="flex items-center gap-2 mb-4 bg-[#141414] border border-grit rounded-xl px-3 py-2">
            <Crown size={14} className="text-accent-red" />
            <span className="text-sm font-bold text-grit flex-1 truncate">{selected.name}</span>
            <button
              onClick={() => setSelected(null)}
              className="label-cap text-[10px] text-grit-dim press"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="mb-3">
            <div className="flex items-center gap-2 bg-[#141414] border border-grit rounded-xl px-3">
              <Search size={14} className="text-grit-dim" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search opponent by name / @user"
                className="flex-1 bg-transparent text-sm text-grit placeholder:text-grit-dim outline-none py-2.5"
              />
            </div>
            {results.length > 0 && (
              <div className="mt-2 max-h-44 overflow-y-auto flex flex-col gap-1">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() =>
                      setSelected({ id: r.id, name: r.display_name || r.username || "Athlete" })
                    }
                    className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#141414] text-left press"
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-[#1a1a1a] flex items-center justify-center shrink-0 border border-grit">
                      {r.avatar_url ? (
                        <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px] text-grit">
                          {(r.display_name || r.username || "A")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-grit truncate">
                      {r.display_name || r.username || "Athlete"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="label-cap text-[10px] text-grit-dim mb-1.5">This week, win by…</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`py-2 rounded-lg text-[11px] font-bold border press ${metric === m.key ? "bg-accent-red text-white border-accent-red" : "border-grit text-grit-dim"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={send}
          disabled={!selected || sending}
          className="btn-grit w-full py-3 inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Swords size={15} />}
          Send challenge
        </button>
      </div>
    </div>
  );
}
