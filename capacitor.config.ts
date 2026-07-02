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
    // Info.plist usage description overrides. Copy these into
    // ios/App/App/Info.plist after `npx cap add ios` if Capacitor doesn't merge them.
    // Apple requires clear, specific reasons for every sensitive permission.
    infoPlist: {
      NSCameraUsageDescription:
        "DEADSET uses the camera to scan meals for macro tracking and to capture physique photos for AI-guided coaching.",
      NSPhotoLibraryUsageDescription:
        "DEADSET reads photos so you can import progress pictures and meals from your library.",
      NSPhotoLibraryAddUsageDescription:
        "DEADSET saves progress pictures, PR share cards, and workout summaries to your photo library.",
      NSMotionUsageDescription:
        "DEADSET reads motion data to track steps, runs, and workout intensity for your training log.",
      NSLocationWhenInUseUsageDescription:
        "DEADSET uses your location during runs to record distance, pace, and route on the map.",
      NSMicrophoneUsageDescription:
        "DEADSET uses the microphone only when you record voice notes with the AI coach.",
      NSHealthShareUsageDescription:
        "DEADSET reads workout, heart rate, and body metrics from Apple Health to enrich your training analytics.",
      NSHealthUpdateUsageDescription:
        "DEADSET writes completed workouts and body measurements back to Apple Health so your data stays in sync.",
      ITSAppUsesNonExemptEncryption: false,
    },
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
