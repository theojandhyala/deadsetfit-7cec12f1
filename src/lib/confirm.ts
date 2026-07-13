// Promise-based in-app replacements for window.confirm / window.prompt.
// Native dialogs are unreliable inside iOS WKWebView and embedded webviews —
// the ConfirmSheet component (mounted at root) renders these instead.

export interface ConfirmRequest {
  kind: "confirm" | "text";
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling for destructive actions */
  danger?: boolean;
  /** Require this exact word to be typed before confirm enables */
  typedWord?: string;
  /** For kind "text": placeholder of the free-text field */
  placeholder?: string;
}

export type ConfirmDetail = {
  request: ConfirmRequest;
  resolve: (result: boolean | string | null) => void;
};

const EVENT_NAME = "deadset:confirm";

function dispatch(request: ConfirmRequest): Promise<boolean | string | null> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmDetail>(EVENT_NAME, { detail: { request, resolve } }));
  });
}

/** In-app confirm dialog. Resolves true when confirmed. */
export async function askConfirm(request: Omit<ConfirmRequest, "kind">): Promise<boolean> {
  return (await dispatch({ ...request, kind: "confirm" })) === true;
}

/** In-app text prompt. Resolves the entered string, or null when cancelled. */
export async function askText(request: Omit<ConfirmRequest, "kind">): Promise<string | null> {
  const result = await dispatch({ ...request, kind: "text" });
  return typeof result === "string" ? result : null;
}

export function onConfirmRequest(listener: (detail: ConfirmDetail) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => listener((event as CustomEvent<ConfirmDetail>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

/** Race a promise against a deadline — used to keep sign-out snappy offline. */
export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}
