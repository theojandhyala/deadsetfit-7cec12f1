import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  identifyRevenueCatUser,
  isRevenueCatRuntimeAvailable,
  logOutRevenueCatUser,
  notifyRevenueCatUpdated,
  syncRevenueCatPurchases,
} from "@/lib/revenuecat";

const MIGRATION_KEY_PREFIX = "deadset_revenuecat_migration_v1";

function needsHistoricalSync(userId: string): boolean {
  try {
    return localStorage.getItem(`${MIGRATION_KEY_PREFIX}:${userId}`) !== "complete";
  } catch {
    return true;
  }
}

function markHistoricalSyncComplete(userId: string): void {
  try {
    localStorage.setItem(`${MIGRATION_KEY_PREFIX}:${userId}`, "complete");
  } catch {
    // A storage-restricted device can safely retry this idempotent migration.
  }
}

export function RevenueCatSync() {
  useEffect(() => {
    if (!isRevenueCatRuntimeAvailable()) return;

    let cancelled = false;
    const identifyAndSync = async (userId: string) => {
      try {
        await identifyRevenueCatUser(userId);
        if (needsHistoricalSync(userId)) {
          await syncRevenueCatPurchases(userId);
          markHistoricalSyncComplete(userId);
        }
        if (!cancelled) notifyRevenueCatUpdated();
      } catch (error) {
        console.warn("RevenueCat subscription sync failed", error);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) void identifyAndSync(data.session.user.id);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user.id) void identifyAndSync(session.user.id);
    });

    const onExplicitLogout = () => {
      void logOutRevenueCatUser().catch((error) => {
        console.warn("RevenueCat sign-out failed", error);
      });
    };
    window.addEventListener("deadset:explicit-logout", onExplicitLogout);

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      window.removeEventListener("deadset:explicit-logout", onExplicitLogout);
    };
  }, []);

  return null;
}
