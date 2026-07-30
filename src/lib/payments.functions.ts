import { callRpc } from "./rpc-client";

export type StripeEnv = "sandbox" | "live";

export const createCheckoutSession = ({
  data,
}: {
  data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
    uiMode?: "embedded_page" | "hosted_page";
  };
}) =>
  callRpc<
    | { clientSecret: string; url?: string }
    | { url: string; clientSecret?: string }
    | { error: string }
  >("createCheckoutSession", data);

export const createPortalSession = ({
  data,
}: {
  data: { returnUrl?: string; environment: StripeEnv };
}) => callRpc<{ url: string } | { error: string }>("createPortalSession", data);

export type SubscriptionStatus = {
  isPro: boolean;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export const getSubscriptionStatus = ({ data }: { data: { environment: StripeEnv } }) =>
  callRpc<SubscriptionStatus>("getSubscriptionStatus", data);

export const verifyCheckoutSession = ({
  data,
}: {
  data: { sessionId: string; environment: StripeEnv };
}) => callRpc<SubscriptionStatus & { verified: boolean }>("verifyCheckoutSession", data);
