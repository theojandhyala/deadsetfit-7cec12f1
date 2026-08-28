const BOOT_SCREEN_ID = "deadset-boot-screen";

let appBootFinished = false;

/**
 * Dismisses the launch layer only after React has committed the real destination
 * and the browser has had two frames to lay it out and paint it. The static
 * layer lives outside #root, so React starting is not mistaken for the app
 * being ready.
 */
export function finishAppBoot(): void {
  if (appBootFinished || typeof document === "undefined") return;
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("bootPreview") === "1"
  ) {
    return;
  }
  appBootFinished = true;

  const revealApp = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const bootScreen = document.getElementById(BOOT_SCREEN_ID);
        document.documentElement.dataset.deadsetAppReady = "true";
        if (!bootScreen) return;

        bootScreen.classList.add("boot--finished");
        const remove = () => bootScreen.remove();
        bootScreen.addEventListener("transitionend", remove, { once: true });
        window.setTimeout(remove, 650);
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", revealApp, { once: true });
  } else {
    revealApp();
  }
}
