import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export const APPLE_PRO_PRODUCTS = {
  monthly: "org.deadsetfit.pro.monthly",
  yearly: "org.deadsetfit.pro.annual",
} as const;

export type AppleProduct = {
  id: string;
  displayName: string;
  description: string;
  displayPrice: string;
  periodUnit?: string;
  periodValue?: number;
  introductoryOffer?: {
    paymentMode: string;
    displayPrice: string;
    periodUnit: string;
    periodValue: number;
    periodCount: number;
  };
  eligibleForIntroOffer?: boolean;
};

export type AppleEntitlement = {
  active: boolean;
  pending?: boolean;
  cancelled?: boolean;
  productId?: string;
  originalTransactionId?: string;
  expirationDate?: string;
};

type DeadSetStorePlugin = {
  getProducts(): Promise<{ products: AppleProduct[] }>;
  getEntitlement(): Promise<AppleEntitlement>;
  purchase(options: { productId: string; appAccountToken?: string }): Promise<AppleEntitlement>;
  restore(): Promise<AppleEntitlement>;
  manageSubscriptions(): Promise<void>;
  addListener(
    eventName: "entitlementChanged",
    listener: (entitlement: AppleEntitlement) => void,
  ): Promise<PluginListenerHandle>;
};

const DeadSetStore = registerPlugin<DeadSetStorePlugin>("DeadSetStore");

export async function getAppleProducts(): Promise<AppleProduct[]> {
  return (await DeadSetStore.getProducts()).products;
}

export function getAppleEntitlement(): Promise<AppleEntitlement> {
  return DeadSetStore.getEntitlement();
}

export function purchaseApplePro(productId: string, appAccountToken?: string) {
  return DeadSetStore.purchase({ productId, appAccountToken });
}

export function restoreApplePro() {
  return DeadSetStore.restore();
}

export function manageApplePro() {
  return DeadSetStore.manageSubscriptions();
}

export function onAppleEntitlementChanged(listener: (entitlement: AppleEntitlement) => void) {
  return DeadSetStore.addListener("entitlementChanged", listener);
}
