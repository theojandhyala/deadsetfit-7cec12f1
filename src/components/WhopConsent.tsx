import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { getWhopConsent, initializeWhopPixel, setWhopConsent, type WhopConsent } from "../lib/whop";

export function WhopConsentBanner() {
  const [consent, setConsent] = useState<WhopConsent>(() => getWhopConsent());

  useEffect(() => {
    if (consent === "granted") initializeWhopPixel();
  }, [consent]);

  if (consent !== null) return null;

  return (
    <aside
      aria-label="Advertising measurement choice"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-white/15 bg-[#111]/95 px-4 py-3 text-white shadow-2xl backdrop-blur"
      role="dialog"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-xs leading-5 text-white/65">
          <span className="font-extrabold text-white">Optional analytics.</span>{" "}
          Help us measure App Store clicks. You can decline and still use everything.{" "}
          <Link className="underline underline-offset-2 hover:text-white" to="/privacy">
            Privacy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
        <button
          className="min-h-10 rounded-lg bg-[#f13a2c] px-4 text-xs font-extrabold text-white"
          onClick={() => {
            setWhopConsent("granted");
            setConsent("granted");
          }}
          type="button"
        >
          Allow
        </button>
        <button
          className="min-h-10 rounded-lg border border-white/20 px-4 text-xs font-bold text-white/75"
          onClick={() => {
            setWhopConsent("denied");
            setConsent("denied");
          }}
          type="button"
        >
          Decline
        </button>
        </div>
      </div>
    </aside>
  );
}
