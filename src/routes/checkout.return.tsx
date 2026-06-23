import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Loader2, TriangleAlert } from "lucide-react";
import { usePro } from "@/hooks/usePro";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "DEADSET — Welcome to Pro" }] }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { isPro, refresh } = usePro();
  const { session_id: sessionId } = Route.useSearch();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    // Webhook may race with redirect; poll a few times
    let i = 0;
    void refresh();
    const id = setInterval(() => {
      i++; refresh();
      if (i > 8) { clearInterval(id); setTimedOut(true); }
    }, 1500);
    return () => clearInterval(id);
  }, [refresh, sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-grit-bg flex flex-col items-center justify-center px-6 text-center">
        <TriangleAlert size={44} className="text-accent-red mb-4" />
        <h1 className="font-display text-3xl uppercase tracking-wider text-grit-text">No checkout found</h1>
        <p className="mt-2 text-sm text-grit">Start from the Pro page to choose a plan.</p>
        <Link to="/upgrade" className="mt-7 rounded bg-accent-red px-7 py-3 font-display text-sm uppercase tracking-widest text-white">View plans</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grit-bg flex flex-col items-center justify-center px-6 text-center">
      {isPro ? (
        <>
          <Crown size={56} className="text-accent-red mb-4" />
          <h1 className="font-display text-4xl uppercase tracking-wider text-grit-text">You're Pro</h1>
          <p className="mt-2 text-sm text-grit">All features unlocked. Now go lift.</p>
          <Link to="/train" className="mt-8 rounded bg-accent-red px-8 py-3 font-display text-sm uppercase tracking-widest text-white">
            Start training
          </Link>
        </>
      ) : timedOut ? (
        <>
          <TriangleAlert size={44} className="text-accent-red mb-4" />
          <h1 className="font-display text-3xl uppercase tracking-wider text-grit-text">Payment processing</h1>
          <p className="mt-2 text-sm text-grit">Your payment may still be confirming. Check again shortly.</p>
          <button onClick={() => { setTimedOut(false); void refresh(); }} className="mt-7 rounded bg-accent-red px-7 py-3 font-display text-sm uppercase tracking-widest text-white">Check again</button>
          <Link to="/train" className="mt-4 text-xs uppercase tracking-widest text-grit">Back to training</Link>
        </>
      ) : (
        <>
          <Loader2 className="animate-spin text-accent-red mb-4" size={32} />
          <h1 className="font-display text-2xl uppercase tracking-wider text-grit-text">Activating Pro…</h1>
          <p className="mt-2 text-xs text-grit uppercase tracking-widest">Confirming your subscription</p>
        </>
      )}
    </div>
  );
}
