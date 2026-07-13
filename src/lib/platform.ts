type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

export function getRuntimePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const platform = window.Capacitor?.getPlatform?.();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}

export function isNativeIos(): boolean {
  if (typeof window === "undefined") return false;
  return getRuntimePlatform() === "ios" && window.Capacitor?.isNativePlatform?.() === true;
}
