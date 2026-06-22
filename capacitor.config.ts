import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for wrapping DEADSET as an iOS / Android app.
 *
 * Quick start (run locally, not in Lovable preview):
 *   1. bun add -D @capacitor/cli && bun add @capacitor/core @capacitor/ios @capacitor/android @capacitor/splash-screen
 *   2. bun run build
 *   3. npx cap add ios && npx cap add android
 *   4. npx cap sync
 *   5. npx cap open ios   (opens Xcode for App Store submission)
 *
 * The `server.url` below points to the published Lovable site so the wrapper
 * always loads the latest deploy. For App Store review, comment out
 * `server.url` and ship the bundled `dist/` folder instead.
 */
const config: CapacitorConfig = {
  appId: "org.deadsetfit.app",
  appName: "DEADSET",
  webDir: "dist",
  backgroundColor: "#0a0a0a",
  server: {
    url: "https://deadsetfit.org",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0a0a0a",
  },
  android: {
    backgroundColor: "#0a0a0a",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0a0a0a",
      androidSplashResourceName: "splash",
      iosSpinnerStyle: "small",
      spinnerColor: "#E10600",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
    },
  },
};

export default config;
