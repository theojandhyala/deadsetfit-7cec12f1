// Cross-platform "rest is over" feedback. No native plugin needed: a short Web
// Audio chime works inside the iOS WKWebView (after the first user gesture, which
// a live workout always has), and navigator.vibrate is a best-effort buzz on the
// platforms that support it (Android/web; a no-op on iOS Safari).
export function restDoneChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const now = ctx.currentTime;
      // Two quick rising blips — distinct, not annoying.
      [880, 1175].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        const t0 = now + i * 0.16;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 0.16);
      });
      setTimeout(() => ctx.close().catch(() => {}), 600);
    }
  } catch {
    /* audio not available — ignore */
  }
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* vibrate unsupported — ignore */
  }
}
