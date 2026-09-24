/** Only compensate an occluded layout viewport, not browser pinch zoom. */
export function keyboardInset(
  layoutHeight: number,
  visibleHeight: number,
  offsetTop: number,
  scale = 1,
): number {
  if (
    ![layoutHeight, visibleHeight, offsetTop, scale].every(Number.isFinite) ||
    Math.abs(scale - 1) > 0.01
  )
    return 0;
  const inset = Math.max(0, layoutHeight - visibleHeight - Math.max(0, offsetTop));
  return inset > 80 ? Math.ceil(inset) : 0;
}

/** Keep the field and its continuation action reachable in WKWebView. */
export function installAuthKeyboardLayout(submit: HTMLButtonElement): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const layoutHeight = () => Math.max(window.innerHeight, document.documentElement.clientHeight);
  let frame = 0;
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const focused = document.activeElement;
      const editing = focused instanceof HTMLInputElement && !focused.readOnly && !focused.disabled;
      const inset = keyboardInset(layoutHeight(), viewport.height, 0, viewport.scale);
      document.documentElement.style.setProperty("--auth-keyboard-inset", `${inset}px`);
      if (!editing || inset === 0) return;
      const visibleBottom = viewport.offsetTop + viewport.height;
      // If the field and CTA cannot both fit, keep the field visible and let
      // the extra scroll space make the rest of the form reachable manually.
      const field = focused.getBoundingClientRect();
      const action = submit.getBoundingClientRect();
      // WKWebView's input accessory strip can sit inside the reported visual
      // viewport. Leave room for its 44pt controls as well as a 16pt gutter.
      const keyboardClearance = 60;
      const targetBottom =
        action.bottom - field.top < viewport.height - keyboardClearance - 16
          ? action.bottom
          : field.bottom;
      const delta = Math.max(0, targetBottom - visibleBottom + keyboardClearance);
      if (delta > 1) window.scrollBy({ top: delta, behavior: "instant" });
    });
  };
  viewport.addEventListener("resize", sync);
  // iOS also pans the visual viewport after the keyboard resize completes.
  viewport.addEventListener("scroll", sync);
  document.addEventListener("focusin", sync);
  document.addEventListener("focusout", sync);
  window.addEventListener("pageshow", sync);
  sync();
}
