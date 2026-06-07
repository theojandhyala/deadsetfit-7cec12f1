import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Send, Sparkles, Crown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "@/lib/storage";
import { coachChat } from "@/lib/coach.functions";
import { getPRValue, PR_CATALOG } from "@/lib/fifa-stats";
import { calculateStreak } from "@/lib/calc";
import { usePro } from "@/hooks/usePro";

export const Route = createFileRoute("/coach")({
  head: () => ({ meta: [{ title: "DEADSET — AI Coach" }] }),
  component: CoachPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "deadset_coach_thread_v1";

const SUGGESTIONS = [
  "How can I break my bench plateau?",
  "Build me a 20-min warm-up for leg day",
  "My lower back is tight after deadlifts — what now?",
  "Should I bulk or cut at my current numbers?",
];

function loadThread(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  } catch {
    return [];
  }
}

function CoachPage() {
  const navigate = useNavigate();
  const { isPro, loading: proLoading } = usePro();
  const [state] = useAppState();
  const chat = useServerFn(coachChat);
  const [messages, setMessages] = useState<Msg[]>(() => loadThread());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (proLoading) {
    return (
      <div className="min-h-screen bg-grit-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-grit" size={24} />
      </div>
    );
  }

  if (!isPro) {
    return (
      <div className="flex flex-col min-h-dvh bg-grit-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <header className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-grit">
          <button onClick={() => navigate({ to: "/profile" as never })} className="p-1 -ml-1">
            <ChevronLeft size={20} />
          </button>
          <Sparkles size={16} className="text-accent-red" />
          <p className="display text-lg font-extrabold uppercase text-grit leading-none">DEADSET Coach</p>
        </header>
        <div className="flex-1 px-6 py-10">
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-red/15 border border-accent-red/40 mb-5">
              <Crown size={28} className="text-accent-red" />
            </div>
            <h2 className="font-display text-3xl uppercase tracking-wider text-grit-text leading-tight">
              AI Coach is Pro
            </h2>
            <p className="mt-3 text-sm text-grit">
              Unlimited personalized coaching on lifts, recovery, programming, plateaus, and form — built around your real PRs and training history.
            </p>
            <ul className="mt-6 space-y-2 text-left text-sm text-grit-text">
              {[
                "Personalized to your stats & goals",
                "Plateau-breaking advice",
                "Form & technique help",
                "Programming guidance",
              ].map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check size={14} className="text-accent-red mt-0.5 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/upgrade"
              className="mt-7 inline-block w-full rounded-md bg-accent-red px-6 py-3.5 font-display text-sm uppercase tracking-widest text-white hover:bg-accent-red/90 transition-colors"
            >
              Unlock Coach — $4.99/mo
            </Link>
            <p className="mt-3 text-[10px] text-grit uppercase tracking-widest">Cancel anytime</p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const p = state.profile;
  function getBest(id: string) {
    const def = PR_CATALOG.find((d) => d.id === id);
    if (!def) return undefined;
    const v = getPRValue(state, def);
    return v > 0 ? v : undefined;
  }
  const context = p
    ? {
        goal: p.goal,
        experience: p.experience,
        weightKg: p.weightKg,
        heightCm: p.heightCm,
        benchKg: getBest("bench-press"),
        squatKg: getBest("squat"),
        deadliftKg: getBest("deadlift"),
        streak: calculateStreak(state.completedDates),
      }
    : undefined;

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { reply } = await chat({ data: { messages: next.slice(-20), context } });
      setMessages((m) => [...m, { role: "assistant", content: reply || "…" }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Coach failed");
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function clearThread() {
    if (!confirm("Clear coach history?")) return;
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col h-dvh" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-grit">
        <button onClick={() => navigate({ to: "/profile" as never })} className="p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <Sparkles size={16} className="text-accent-red" />
        <p className="display text-lg font-extrabold uppercase text-grit leading-none">DEADSET Coach</p>
        {messages.length > 0 && (
          <button onClick={clearThread} className="ml-auto label-cap text-[10px] text-grit-dim">Clear</button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-6">
            <p className="text-sm text-grit-dim mb-4">Ask anything about lifting, recovery, programming, or form.</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-3 py-2.5 text-xs text-grit bg-grit-card border border-grit hover:border-accent-red transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="bg-accent-red text-white px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap">
                {m.content}
              </div>
            ) : (
              <div className="text-grit text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
            )}
          </div>
        ))}

        {sending && (
          <div className="text-grit-dim text-xs italic">Coach is thinking…</div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-grit p-3 flex items-end gap-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask your coach…"
          disabled={sending}
          className="input-grit flex-1 resize-none max-h-32 py-2.5"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-accent-red text-white p-3 disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
