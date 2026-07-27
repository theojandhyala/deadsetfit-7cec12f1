import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Loader2, TriangleAlert } from "lucide-react";
import { usePro } from "@/hooks/usePro";
import { verifyCheckoutSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

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
  const [verifiedPro, setVerifiedPro] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    // Webhook may race with redirect; poll a few times
    let i = 0;
    const verify = async () => {
      setVerifyError(null);
      try {
        const result = await verifyCheckoutSession({
          data: { sessionId, environment: getStripeEnvironment() },
        });
        if (result.isPro) {
          setVerifiedPro(true);
          await refresh();
          return;
        }
      } catch (error) {
        setVerifyError(error instanceof Error ? error.message : "Could not verify checkout yet");
      }
      await refresh();
    };
    void verify();
    const id = setInterval(() => {
      i++;
      void verify();
      if (verifiedPro || isPro) {
        clearInterval(id);
        return;
      }
      if (i > 8) {
        clearInterval(id);
        setTimedOut(true);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [isPro, refresh, sessionId, verifiedPro]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-grit-bg flex flex-col items-center justify-center px-6 text-center">
        <TriangleAlert size={44} className="text-accent-red mb-4" />
        <h1 className="font-display text-3xl uppercase tracking-wider text-grit-text">
          No checkout found
        </h1>
        <p className="mt-2 text-sm text-grit">Start from the Pro page to choose a plan.</p>
        <Link
          to="/upgrade"
          className="mt-7 rounded bg-accent-red px-7 py-3 font-display text-sm uppercase tracking-widest text-white"
        >
          View plans
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grit-bg flex flex-col items-center justify-center px-6 text-center">
      {isPro || verifiedPro ? (
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
          <TriangleAlert size={44} className="text-accent-red mb-4" />
          <h1 className="font-display text-3xl uppercase tracking-wider text-grit-text">
            Payment processing
          </h1>
          <p className="mt-2 text-sm text-grit">
            {verifyError || "Your payment may still be confirming. Check again shortly."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-7 rounded bg-accent-red px-7 py-3 font-display text-sm uppercase tracking-widest text-white"
          >
            Check again
          </button>
          <Link to="/train" className="mt-4 text-xs uppercase tracking-widest text-grit">
            Back to training
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
