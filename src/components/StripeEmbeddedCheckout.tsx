import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useCallback, useEffect, useState } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/payments.functions";
import { withTimeout } from "@/lib/account-restore";

interface Props {
  priceId: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, returnUrl }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slowCheckout, setSlowCheckout] = useState(false);

  const loadHostedCheckout = useCallback(async () => {
    setError(null);
    setSlowCheckout(false);
    try {
      const result = await withTimeout(
        createCheckoutSession({
          data: {
            priceId,
            returnUrl: returnUrl || window.location.href,
            environment: getStripeEnvironment(),
            uiMode: "hosted_page",
          },
        }),
        { error: "Stripe checkout took too long. Please try again." },
        15000,
      );
      if ("error" in result) throw new Error(result.error);
      if (!result.url) throw new Error("Stripe checkout did not return a payment link");
      window.location.href = result.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed to load");
    }
  }, [priceId, returnUrl]);

  const loadClientSecret = useCallback(async () => {
    setError(null);
    setSlowCheckout(false);
    setClientSecret(null);
    setHostedUrl(null);
    try {
      const result = await withTimeout(
        createCheckoutSession({
          data: {
            priceId,
            returnUrl: returnUrl || window.location.href,
            environment: getStripeEnvironment(),
            uiMode: "embedded_page",
          },
        }),
        { error: "Checkout is taking too long. Please try again." },
        15000,
      );
      if ("error" in result) throw new Error(result.error);
      if (result.url) setHostedUrl(result.url);
      if (!result.clientSecret) throw new Error("No checkout session was returned");
      setClientSecret(result.clientSecret);
    } catch (e) {
      try {
        const fallback = await withTimeout(
          createCheckoutSession({
            data: {
              priceId,
              returnUrl: returnUrl || window.location.href,
              environment: getStripeEnvironment(),
              uiMode: "hosted_page",
            },
          }),
          { error: "Stripe checkout took too long. Please try again." },
          15000,
        );
        if ("error" in fallback) throw new Error(fallback.error, { cause: e });
        if (!fallback.url) {
          throw new Error("Stripe checkout did not return a payment link", { cause: e });
        }
        setHostedUrl(fallback.url);
        setError("Embedded checkout could not load. Use secure Stripe checkout instead.");
      } catch (fallbackError) {
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : e instanceof Error
              ? e.message
              : "Checkout failed to load",
        );
      }
    }
  }, [priceId, returnUrl]);

  useEffect(() => {
    loadClientSecret();
  }, [loadClientSecret]);

  useEffect(() => {
    if (clientSecret || error) return;
    const timer = window.setTimeout(() => setSlowCheckout(true), 6500);
    return () => window.clearTimeout(timer);
  }, [clientSecret, error]);

  if (error) {
    return (
      <div className="deadset-3d-panel border border-accent-red/40 bg-accent-red/10 p-5 text-center animate-slide-up">
        <p className="label-cap text-xs text-accent-red">Checkout couldn&apos;t load</p>
        <p className="mt-2 text-sm text-grit">{error}</p>
        <div className="mt-5 grid gap-2">
          {hostedUrl ? (
            <a href={hostedUrl} className="btn-grit w-full py-3">
              Open secure Stripe checkout
            </a>
          ) : (
            <button onClick={loadHostedCheckout} className="btn-grit w-full py-3">
              Open secure Stripe checkout
            </button>
          )}
          <button onClick={loadClientSecret} className="btn-ghost w-full py-3">
            Try embedded again
          </button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="deadset-3d-panel border border-grit bg-grit-card p-8 text-center animate-slide-up">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent-red border-t-transparent" />
        <p className="label-cap mt-4 text-xs text-grit-dim">Loading secure checkout</p>
        {slowCheckout && (
          <div className="mt-5 grid gap-2">
            <p className="text-xs text-grit-dim">
              Stripe is taking longer than normal. You can retry or open the hosted checkout.
            </p>
            <button onClick={loadHostedCheckout} className="btn-grit w-full py-3">
              Open secure Stripe checkout
            </button>
            <button onClick={loadClientSecret} className="btn-ghost w-full py-3">
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      id="checkout"
      className="deadset-3d-panel border border-grit bg-[#080808] p-2 animate-slide-up"
    >
      {hostedUrl && (
        <a
          href={hostedUrl}
          className="mb-2 flex items-center justify-center border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-accent-red"
        >
          Checkout not showing? Open Stripe checkout
        </a>
      )}
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
