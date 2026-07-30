import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { onConfirmRequest, type ConfirmDetail } from "@/lib/confirm";

/**
 * In-app replacement for window.confirm / window.prompt — native dialogs are
 * unreliable inside iOS WKWebView. Mounted once at the root; opened via
 * askConfirm()/askText() from @/lib/confirm.
 */
export function ConfirmSheet() {
  const [active, setActive] = useState<ConfirmDetail | null>(null);
  const [typed, setTyped] = useState("");
  // Remount the uncontrolled inputs whenever a new request arrives so a
  // replaced dialog never shows the previous request's typed text.
  const [reqSeq, setReqSeq] = useState(0);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      onConfirmRequest((detail) => {
        setTyped("");
        setReqSeq((n) => n + 1);
        setActive((current) => {
          // A second request while one is open cancels the first.
          current?.resolve(current.request.kind === "text" ? null : false);
          return detail;
        });
      }),
    [],
  );

  if (!active) return null;
  const { request } = active;
  const needsWord = request.kind === "confirm" && !!request.typedWord;
  const wordOk = !needsWord || typed.trim().toUpperCase() === request.typedWord!.toUpperCase();

  function finish(result: boolean | string | null) {
    active?.resolve(result);
    setActive(null);
    setTyped("");
  }

  function confirm() {
    if (request.kind === "text") {
      const value = (textRef.current?.value ?? "").trim();
      finish(value.length > 0 ? value : null);
      return;
    }
    if (!wordOk) return;
    finish(true);
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center"
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80"
        onClick={() => finish(request.kind === "text" ? null : false)}
      />
      <div
        className="relative w-full max-w-md bg-grit-card border rounded-t-3xl rounded-b-none p-6 animate-slide-up"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        {request.danger && (
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-accent-red" />
            <span className="label-cap text-[10px] text-accent-red">This can't be undone</span>
          </div>
        )}
        <h2 className="text-xl uppercase leading-tight text-grit">{request.title}</h2>
        {request.message && (
          <p className="text-sm text-grit-dim mt-2 leading-relaxed whitespace-pre-line">
            {request.message}
          </p>
        )}

        {needsWord && (
          <div className="mt-4">
            <p className="label-cap text-[10px] mb-1.5">Type {request.typedWord} to confirm</p>
            <input
              key={reqSeq}
              defaultValue=""
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              className="input-grit"
              aria-label={`Type ${request.typedWord} to confirm`}
            />
          </div>
        )}
        {request.kind === "text" && (
          <input
            key={reqSeq}
            ref={textRef}
            defaultValue=""
            placeholder={request.placeholder}
            autoComplete="off"
            className="input-grit mt-4"
            aria-label={request.placeholder ?? "Your answer"}
          />
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={() => finish(request.kind === "text" ? null : false)}
            className="btn-ghost py-3"
          >
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={confirm}
            disabled={needsWord && !wordOk}
            className="btn-grit py-3 disabled:opacity-40"
          >
            {request.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
