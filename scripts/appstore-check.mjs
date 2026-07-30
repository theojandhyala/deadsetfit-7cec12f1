import { existsSync, readFileSync } from "node:fs";

const strict = process.env.APPSTORE_STRICT === "1";
const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, pass, detail, level = "error") {
  checks.push({ name, pass, detail, level });
}

/** Probes DEADSET's broker entry point and requires DEADSET's callback. */
async function probeOAuthProvider(provider) {
  const expectedHost = provider === "google" ? "accounts.google.com" : "appleid.apple.com";
  const brokerOrigin = "https://deadsetfit.org";

  try {
    const results = await Promise.all(
      ["web", "native"].map(async (flow) => {
        const url = new URL(`${brokerOrigin}/api/auth/${provider}/start`);
        url.searchParams.set("state", "deadset-appstore-readiness-check");
        url.searchParams.set("flow", flow);
        url.searchParams.set("origin", brokerOrigin);
        const response = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(10_000),
        });
        const location = new URL(response.headers.get("location") ?? "http://invalid.local");
        return {
          status: response.status,
          // A misconfigured provider redirects back to /auth/#error=… instead.
          valid:
            response.status >= 300 &&
            response.status < 400 &&
            location.hostname === expectedHost &&
            location.searchParams.get("redirect_uri") ===
              `${brokerOrigin}/api/auth/${provider}/callback`,
        };
      }),
    );
    const pass = results.every((result) => result.valid);
    return {
      pass,
      detail: pass
        ? `${provider} sign-in starts on deadsetfit.org and hands off to ${expectedHost} for web and iPhone.`
        : `${provider} start returned HTTP ${results.map((result) => result.status).join("/")}; check the worker's ${provider === "google" ? "GOOGLE_OAUTH_CLIENT_ID/SECRET" : "APPLE_OAUTH_CLIENT_ID"} and docs/oauth-setup.md.`,
    };
  } catch (error) {
    return {
      pass: false,
      detail: `${provider} probe failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

const packageJson = JSON.parse(read("package.json"));
const capacitorConfig = existsSync("capacitor.config.ts") ? read("capacitor.config.ts") : "";
const activeCapacitorConfig = capacitorConfig
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");
const upgradePage = existsSync("src/routes/upgrade.tsx") ? read("src/routes/upgrade.tsx") : "";
const infoPlist = existsSync("ios/App/App/Info.plist") ? read("ios/App/App/Info.plist") : "";
const entitlements = existsSync("ios/App/App/App.entitlements")
  ? read("ios/App/App/App.entitlements")
  : "";
const privacyManifest = existsSync("ios/App/App/PrivacyInfo.xcprivacy")
  ? read("ios/App/App/PrivacyInfo.xcprivacy")
  : "";
const platformUtil = existsSync("src/lib/platform.ts") ? read("src/lib/platform.ts") : "";
const rpcClient = existsSync("src/lib/rpc-client.ts") ? read("src/lib/rpc-client.ts") : "";
const authClient = existsSync("src/auth/plain.ts") ? read("src/auth/plain.ts") : "";
const restTimer = existsSync("src/components/RestTimer.tsx")
  ? read("src/components/RestTimer.tsx")
  : "";
const restTimerLib = existsSync("src/lib/rest-timer.ts") ? read("src/lib/rest-timer.ts") : "";
const oauthClient = existsSync("src/auth/oauth.ts") ? read("src/auth/oauth.ts") : "";
const oauthServer = existsSync("src/lib/oauth.server.ts") ? read("src/lib/oauth.server.ts") : "";
const worker = existsSync("src/cloudflare-worker.ts") ? read("src/cloudflare-worker.ts") : "";
const nativeAuthBridge = existsSync("auth/native-callback.html")
  ? read("auth/native-callback.html")
  : "";
const profilePage = existsSync("src/routes/_tabs.profile.tsx")
  ? read("src/routes/_tabs.profile.tsx")
  : "";
const proProvider = existsSync("src/hooks/usePro.tsx") ? read("src/hooks/usePro.tsx") : "";
const paywallSheet = existsSync("src/components/PaywallSheet.tsx")
  ? read("src/components/PaywallSheet.tsx")
  : "";
const paywallEvents = existsSync("src/lib/paywall-events.ts")
  ? read("src/lib/paywall-events.ts")
  : "";
const upgradePrompts = existsSync("src/lib/upgrade-prompts.ts")
  ? read("src/lib/upgrade-prompts.ts")
  : "";
const termsPage = existsSync("src/routes/terms.tsx") ? read("src/routes/terms.tsx") : "";
const friendsPage = existsSync("src/routes/_tabs.friends.tsx")
  ? read("src/routes/_tabs.friends.tsx")
  : "";
const rpcServer = existsSync("api/rpc.ts") ? read("api/rpc.ts") : "";
const deviceReminders = existsSync("src/lib/device-reminders.ts")
  ? read("src/lib/device-reminders.ts")
  : "";
const settingsPage = existsSync("src/routes/settings.tsx") ? read("src/routes/settings.tsx") : "";

check("package.json exists", !!packageJson.name, "Project metadata is readable.");
check(
  "production build script",
  packageJson.scripts?.build?.includes("vite build"),
  "Build script runs Vite.",
);
check(
  "full check script",
  packageJson.scripts?.check?.includes("tsc --noEmit") &&
    packageJson.scripts?.check?.includes("eslint") &&
    packageJson.scripts?.check?.includes("vitest run"),
  "Check script runs TypeScript, lint, and regression tests.",
);
check(
  "core regression tests",
  existsSync("src/lib/calc.test.ts") &&
    existsSync("src/lib/progression.test.ts") &&
    existsSync("src/lib/competition.test.ts") &&
    existsSync("src/lib/rank.test.ts") &&
    existsSync("src/lib/device-reminders.test.ts"),
  "Schedule, progression, competition, rank, and reminder logic have automated coverage.",
);
check(
  "Capacitor config",
  capacitorConfig.includes("appId") && capacitorConfig.includes("webDir"),
  "Native wrapper config is present.",
);
check(
  "iOS project",
  existsSync("ios/App/DeadSet.xcodeproj"),
  "Xcode project exists at ios/App/DeadSet.xcodeproj.",
);
check(
  "bundled webDir",
  /webDir:\s*['"]dist\/client['"]/.test(capacitorConfig),
  "Capacitor points at dist/client.",
);
check("privacy route", existsSync("src/routes/privacy.tsx"), "Privacy policy route exists.");
check("terms route", existsSync("src/routes/terms.tsx"), "Terms route exists.");
check(
  "disclaimer route",
  existsSync("src/routes/disclaimer.tsx"),
  "Health disclaimer route exists.",
);
check("manifest", existsSync("public/manifest.json"), "Web manifest exists.");
check(
  "splash asset",
  existsSync("src/assets/splash-2732.png.asset.json"),
  "Splash asset metadata exists.",
);
check(
  "icon asset",
  existsSync("src/assets/icon-180.png.asset.json"),
  "iOS icon asset metadata exists.",
);
check(
  "native iOS detection",
  platformUtil.includes("isNativeIos") && platformUtil.includes("Capacitor"),
  "Runtime platform helper can detect native iOS.",
);
check(
  "scheduled workout reminders",
  packageJson.dependencies?.["@capacitor/local-notifications"] &&
    capacitorConfig.includes("LocalNotifications") &&
    deviceReminders.includes("requestPermissions") &&
    deviceReminders.includes("buildWorkoutReminderDrafts") &&
    settingsPage.includes("iPhone Workout Reminders"),
  "Opt-in local notifications follow the user's training schedule and can be configured in-app.",
);
check(
  "Stripe blocked on native iOS",
  upgradePage.includes('if (isNativeIos()) navigate({ to: "/profile", replace: true })') &&
    upgradePage.includes("iosNative ?") &&
    upgradePage.includes("Checkout disabled on iPhone") &&
    profilePage.includes("!nativeIos &&") &&
    paywallSheet.includes("isNativeIos() ?") &&
    !paywallSheet.includes("deadsetfit.org/upgrade") &&
    paywallEvents.includes("if (isNativeIos()) return") &&
    upgradePrompts.includes("if (isNativeIos()) return false") &&
    proProvider.includes("const iosFree = isNativeIos()"),
  "Stripe checkout, upgrade prompts, and external-purchase calls to action are absent inside native iOS; Safari remains the web subscription channel.",
);
check(
  "web-only subscription terms",
  /Web subscriptions are processed by\s+Stripe/.test(termsPage) &&
    !termsPage.includes("Subscriptions made via the Apple App Store"),
  "Terms describe the Stripe web subscription actually offered by DEADSET and do not claim an unavailable Apple subscription.",
);
check(
  "camera usage string",
  infoPlist.includes("NSCameraUsageDescription"),
  "Info.plist declares NSCameraUsageDescription (required — camera is used for check-in photos).",
);
check(
  "photo library usage string",
  infoPlist.includes("NSPhotoLibraryUsageDescription"),
  "Info.plist declares NSPhotoLibraryUsageDescription (photo picker for avatars/check-ins).",
);
check(
  "HealthKit usage strings",
  infoPlist.includes("NSHealthShareUsageDescription") &&
    infoPlist.includes("NSHealthUpdateUsageDescription"),
  "Info.plist explains the health data DEADSET reads and writes.",
);
check(
  "HealthKit entitlement",
  entitlements.includes("com.apple.developer.healthkit"),
  "The iOS target has the HealthKit entitlement.",
);
check(
  "Sign in with Apple entitlement",
  entitlements.includes("com.apple.developer.applesignin") &&
    entitlements.includes("<string>Default</string>"),
  "The iOS target is entitled to use Sign in with Apple.",
);
for (const type of [
  "EmailAddress",
  "UserID",
  "Health",
  "Fitness",
  "PhotosorVideos",
  "OtherUserContent",
]) {
  check(
    `privacy manifest: ${type}`,
    privacyManifest.includes(`NSPrivacyCollectedDataType${type}`),
    `PrivacyInfo.xcprivacy declares ${type} as collected and linked to the user.`,
  );
}
check(
  "privacy manifest: no tracking",
  privacyManifest.includes("<key>NSPrivacyTracking</key>") &&
    /<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(privacyManifest),
  "The native manifest declares that DEADSET does not track users.",
);
check(
  "in-app account deletion",
  profilePage.includes("async function deleteAccount") &&
    profilePage.includes("onClick={deleteAccount}") &&
    rpcServer.includes("async deleteMyAccount"),
  "Users can initiate account deletion in-app and the API removes their account.",
);
check(
  "social safety controls",
  friendsPage.includes("reportContent") &&
    friendsPage.includes("blockUser") &&
    rpcServer.includes("async reportContent") &&
    rpcServer.includes("async blockUser"),
  "User-generated social content has report and block controls on both client and server.",
);
check(
  "Google and Apple auth",
  authClient.includes('continueWithProvider("google")') &&
    authClient.includes('continueWithProvider("apple")'),
  "The signup-first auth screen offers Google and Apple OAuth.",
);
check(
  "resilient sign-in brokering",
  oauthClient.includes('OAUTH_BROKER_ORIGIN = "https://deadsetfit.org"') &&
    oauthClient.includes("/api/auth/") &&
    !/lovable/i.test(oauthClient) &&
    !/lovable/i.test(authClient) &&
    oauthServer.includes('BROKER_ORIGIN = "https://deadsetfit.org"') &&
    oauthServer.includes("verifyIdToken") &&
    oauthServer.includes("serviceRoleCanBelongToProject") &&
    !/lovable/i.test(oauthServer) &&
    worker.includes("handleOAuthRequest"),
  "Google and Apple use DEADSET-owned clients, callbacks, token verification, and Supabase sessions without a third-party OAuth broker.",
);
check(
  "rest timer survives leaving the app",
  restTimer.includes("restTimerState") &&
    restTimer.includes("scheduleRestAlert") &&
    restTimerLib.includes("allowWhileIdle") &&
    !restTimer.includes("setLeft((s) => s - 1)") &&
    infoPlist.includes("NSSupportsLiveActivities"),
  "Rest counts down from a deadline (not suspendable ticks), alerts at the deadline, and the app is entitled to Live Activities.",
);
check(
  "native OAuth callback",
  authClient.includes('nativeAuthCallback = "org.deadsetfit.app://auth/callback"') &&
    authClient.includes('nativeAuthBridge = "https://deadsetfit.org/auth/native-callback"') &&
    authClient.includes('import("@capacitor/browser")') &&
    authClient.includes('import("@capacitor/app")') &&
    authClient.includes("setSession") &&
    authClient.includes("exchangeCodeForSession") &&
    nativeAuthBridge.includes("org.deadsetfit.app://auth/callback") &&
    infoPlist.includes("<string>org.deadsetfit.app</string>"),
  "Native OAuth uses the system browser, a secure HTTPS bridge, an app deep link, and explicit token/code completion.",
);
check(
  "RPC production origin",
  rpcClient.includes('DEFAULT_API_ORIGIN = "https://deadsetfit.org"') &&
    rpcClient.includes("VITE_API_ORIGIN"),
  "The app client has a production API fallback and configurable override.",
);
check(
  "RPC native/localhost fallback",
  rpcClient.includes("isNativeShell()") &&
    rpcClient.includes('window.location.hostname === "localhost"') &&
    rpcClient.includes('window.location.hostname === "127.0.0.1"'),
  "Native and local shells route server requests to the live DEADSET API.",
);

const hasLiveServerUrl = /server:\s*{[\s\S]*url:\s*['"]https?:\/\//.test(activeCapacitorConfig);
check(
  "offline App Review build",
  !hasLiveServerUrl,
  hasLiveServerUrl
    ? "capacitor.config.ts still has server.url enabled. Use APPSTORE_STRICT=1 for final archive checks after commenting it out."
    : "server.url is disabled; app will use the bundled web build.",
  strict ? "error" : "warning",
);

if (strict) {
  const [google, apple] = await Promise.all([
    probeOAuthProvider("google"),
    probeOAuthProvider("apple"),
  ]);
  check("live Google provider", google.pass, google.detail);
  check("live Apple provider", apple.pass, apple.detail);
} else {
  check(
    "live social provider credentials",
    false,
    "Managed provider redirects require a live check. Run npm run appstore:strict before submission.",
    "warning",
  );
}

const warnings = checks.filter((item) => !item.pass && item.level === "warning");
const failures = checks.filter((item) => !item.pass && item.level !== "warning");

for (const item of checks) {
  const status = item.pass ? "PASS" : item.level === "warning" ? "WARN" : "FAIL";
  console.log(`${status} ${item.name} - ${item.detail}`);
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s).`);
}

if (failures.length) {
  console.error(`\n${failures.length} App Store readiness check(s) failed.`);
  process.exit(1);
}

console.log("\nApp Store readiness checks passed.");
