import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
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
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Webhook may race with redirect; poll a few times
    let i = 0;
    const id = setInterval(() => {
      i++;
      refresh();
      if (i > 8) {
        clearInterval(id);
        setTimedOut(true);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [refresh, attempt]);

  return (
    <div className="min-h-screen bg-grit-bg flex flex-col items-center justify-center px-6 text-center">
      {isPro ? (
        <>
          <Crown size={56} className="text-accent-red mb-4" />
          <h1 className="font-display text-4xl uppercase tracking-wider text-grit-text">
            You're Pro
          </h1>
          <p className="mt-2 text-sm text-grit">All features unlocked. Now go lift.</p>
          <Link
            to="/train"
            className="mt-8 rounded bg-accent-red px-8 py-3 font-display text-sm uppercase tracking-widest text-white"
          >
            Start training
          </Link>
        </>
      ) : timedOut ? (
        <>
          <Crown size={56} className="text-accent-red mb-4" />
          <h1 className="font-display text-2xl uppercase tracking-wider text-grit-text">
            Almost there
          </h1>
          <p className="mt-2 text-sm text-grit">
            This is taking longer than expected — your payment went through and Pro will
            activate automatically in a few minutes.
          </p>
          <button
            onClick={() => {
              setTimedOut(false);
              setAttempt((a) => a + 1);
            }}
            className="mt-8 rounded bg-accent-red px-8 py-3 font-display text-sm uppercase tracking-widest text-white"
          >
            Try again
          </button>
          <Link
            to="/train"
            className="mt-4 text-xs text-grit uppercase tracking-widest underline"
          >
            Go to Training
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="animate-spin text-accent-red mb-4" size={32} />
          <h1 className="font-display text-2xl uppercase tracking-wider text-grit-text">
            Activating Pro…
          </h1>
          <p className="mt-2 text-xs text-grit uppercase tracking-widest">
            Confirming your subscription
          </p>
        </>
      )}
    </div>
  );
}
