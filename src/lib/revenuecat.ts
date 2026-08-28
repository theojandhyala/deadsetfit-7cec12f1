import {
  ENTITLEMENT_VERIFICATION_MODE,
  PURCHASES_ARE_COMPLETED_BY_TYPE,
  Purchases,
  STOREKIT_VERSION,
  type CustomerInfo,
} from "@revenuecat/purchases-capacitor";

import { isNativeIos } from "@/lib/platform";

export const REVENUECAT_PRO_ENTITLEMENT = "pro";

// RevenueCat public SDK keys are designed to ship in the client binary. The
// environment override keeps alternate builds possible without making the App
// Store build dependent on a deployment dashboard setting.
const revenueCatEnvKey = (
  import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined
)?.trim();
const REVENUECAT_IOS_API_KEY =
  revenueCatEnvKey?.startsWith("appl_") && revenueCatEnvKey.length > 12
    ? revenueCatEnvKey
    : "appl_mdjAKLIMJMfPvLfxNpUaQmBPWkJ";

export type RevenueCatProEntitlement = {
  active: boolean;
  productId: string | null;
  expirationDate: string | null;
  willRenew: boolean;
};

let configurePromise: Promise<void> | null = null;
let configured = false;
let currentAppUserId: string | null = null;
let identityQueue: Promise<void> = Promise.resolve();

function queueIdentityChange(change: () => Promise<void>): Promise<void> {
  identityQueue = identityQueue.catch(() => undefined).then(change);
  return identityQueue;
}

export function isRevenueCatRuntimeAvailable(
  nativeIos = isNativeIos(),
  apiKey = REVENUECAT_IOS_API_KEY,
): boolean {
  return nativeIos && apiKey.startsWith("appl_") && apiKey.length > 12;
}

export function revenueCatProFromCustomerInfo(
  customerInfo: Pick<CustomerInfo, "entitlements">,
): RevenueCatProEntitlement {
  const entitlement = customerInfo.entitlements.active[REVENUECAT_PRO_ENTITLEMENT];
  const verificationFailed =
    customerInfo.entitlements.verification === "FAILED" || entitlement?.verification === "FAILED";
  return {
    active: entitlement?.isActive === true && !verificationFailed,
    productId: entitlement?.productIdentifier ?? null,
    expirationDate: entitlement?.expirationDate ?? null,
    willRenew: entitlement?.willRenew === true,
  };
}

async function configureSdk(appUserId?: string | null): Promise<boolean> {
  if (!isRevenueCatRuntimeAvailable()) return false;

  if (!configurePromise) {
    configurePromise = Purchases.configure({
      apiKey: REVENUECAT_IOS_API_KEY,
      appUserID: appUserId || undefined,
      purchasesAreCompletedBy: {
        type: PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP,
        storeKitVersion: STOREKIT_VERSION.STOREKIT_2,
      },
      entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
      automaticDeviceIdentifierCollectionEnabled: false,
      diagnosticsEnabled: false,
      shouldShowInAppMessagesAutomatically: true,
    })
      .then(() => {
        configured = true;
        currentAppUserId = appUserId || null;
      })
      .catch((error) => {
        configurePromise = null;
        configured = false;
        currentAppUserId = null;
        throw error;
      });
  }

  await configurePromise;
  return configured;
}

export async function identifyRevenueCatUser(appUserId: string): Promise<boolean> {
  if (!(await configureSdk(appUserId))) return false;
  if (currentAppUserId === appUserId) return true;

  identityQueue = queueIdentityChange(async () => {
    const { appUserID } = await Purchases.getAppUserID();
    if (appUserID !== appUserId) await Purchases.logIn({ appUserID: appUserId });
    currentAppUserId = appUserId;
  });
  await identityQueue;
  return true;
}

export async function logOutRevenueCatUser(): Promise<void> {
  if (!configured || !currentAppUserId) return;
  identityQueue = queueIdentityChange(async () => {
    await Purchases.logOut();
    currentAppUserId = null;
  });
  await identityQueue;
}

export async function syncRevenueCatPurchases(appUserId?: string | null): Promise<boolean> {
  const ready = appUserId ? await identifyRevenueCatUser(appUserId) : await configureSdk(null);
  if (!ready) return false;
  await Purchases.syncPurchases();
  return true;
}

export async function recordRevenueCatPurchase(
  productId: string,
  appUserId?: string | null,
): Promise<boolean> {
  const ready = appUserId ? await identifyRevenueCatUser(appUserId) : await configureSdk(null);
  if (!ready) return false;
  await Purchases.recordPurchase({ productID: productId });
  return true;
}

export async function getRevenueCatProEntitlement(
  appUserId?: string | null,
): Promise<RevenueCatProEntitlement> {
  const ready = appUserId ? await identifyRevenueCatUser(appUserId) : await configureSdk(null);
  if (!ready) {
    return { active: false, productId: null, expirationDate: null, willRenew: false };
  }
  const { customerInfo } = await Purchases.getCustomerInfo();
  return revenueCatProFromCustomerInfo(customerInfo);
}

export function notifyRevenueCatUpdated(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("deadset:revenuecat-updated"));
}
