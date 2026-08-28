import { existsSync, readFileSync, readdirSync } from "node:fs";

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
const launchStoryboard = existsSync("ios/App/App/Base.lproj/LaunchScreen.storyboard")
  ? read("ios/App/App/Base.lproj/LaunchScreen.storyboard")
  : "";
const indexHtml = existsSync("index.html") ? read("index.html") : "";
const staticAuthPage = existsSync("auth/index.html") ? read("auth/index.html") : "";
const indexRoute = existsSync("src/routes/index.tsx") ? read("src/routes/index.tsx") : "";
const nativeWelcome = existsSync("src/components/NativeWelcome.tsx")
  ? read("src/components/NativeWelcome.tsx")
  : "";
const entitlements = existsSync("ios/App/App/App.entitlements")
  ? read("ios/App/App/App.entitlements")
  : "";
const privacyManifest = existsSync("ios/App/App/PrivacyInfo.xcprivacy")
  ? read("ios/App/App/PrivacyInfo.xcprivacy")
  : "";
const platformUtil = existsSync("src/lib/platform.ts") ? read("src/lib/platform.ts") : "";
const rpcClient = existsSync("src/lib/rpc-client.ts") ? read("src/lib/rpc-client.ts") : "";
const authClient = existsSync("src/auth/plain.ts") ? read("src/auth/plain.ts") : "";
const viewController = existsSync("ios/App/App/MyViewController.swift")
  ? read("ios/App/App/MyViewController.swift")
  : "";
const localPlugins = existsSync("ios/App/App")
  ? readdirSync("ios/App/App").filter((name) => name.endsWith("Plugin.swift"))
  : [];
const restTimer = existsSync("src/components/RestTimer.tsx")
  ? read("src/components/RestTimer.tsx")
  : "";
const restTimerLib = existsSync("src/lib/rest-timer.ts") ? read("src/lib/rest-timer.ts") : "";
const oauthClient = existsSync("src/auth/oauth.ts") ? read("src/auth/oauth.ts") : "";
const oauthServer = existsSync("src/lib/oauth.server.ts") ? read("src/lib/oauth.server.ts") : "";
const appleOAuthServer = existsSync("src/lib/apple-oauth.server.ts")
  ? read("src/lib/apple-oauth.server.ts")
  : "";
const appleCredentialMigration = existsSync(
  "supabase/migrations/20260815153000_apple_oauth_revocation.sql",
)
  ? read("supabase/migrations/20260815153000_apple_oauth_revocation.sql")
  : "";
const worker = existsSync("src/cloudflare-worker.ts") ? read("src/cloudflare-worker.ts") : "";
const nativeAuthBridge = existsSync("auth/native-callback/index.html")
  ? read("auth/native-callback/index.html")
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
const appReviewClient = existsSync("src/lib/app-review.ts") ? read("src/lib/app-review.ts") : "";
const appReviewWatcher = existsSync("src/components/AppReviewWatcher.tsx")
  ? read("src/components/AppReviewWatcher.tsx")
  : "";
const appReviewPlugin = existsSync("ios/App/App/AppReviewPlugin.swift")
  ? read("ios/App/App/AppReviewPlugin.swift")
  : "";
const storeKitPlugin = existsSync("ios/App/App/StoreKitPlugin.swift")
  ? read("ios/App/App/StoreKitPlugin.swift")
  : "";
const storeKitClient = existsSync("src/lib/storekit.ts") ? read("src/lib/storekit.ts") : "";
const revenueCatClient = existsSync("src/lib/revenuecat.ts") ? read("src/lib/revenuecat.ts") : "";
const revenueCatSync = existsSync("src/components/RevenueCatSync.tsx")
  ? read("src/components/RevenueCatSync.tsx")
  : "";
const rootRoute = existsSync("src/routes/__root.tsx") ? read("src/routes/__root.tsx") : "";
const privacyPage = existsSync("src/routes/privacy.tsx") ? read("src/routes/privacy.tsx") : "";
const landingPage = existsSync("src/components/Landing.tsx")
  ? read("src/components/Landing.tsx")
  : "";
const publicRedirects = existsSync("public/_redirects") ? read("public/_redirects") : "";
const xcodeProject = existsSync("ios/App/DeadSet.xcodeproj/project.pbxproj")
  ? read("ios/App/DeadSet.xcodeproj/project.pbxproj")
  : "";
const whatsNew = existsSync("src/lib/whats-new.ts") ? read("src/lib/whats-new.ts") : "";
const weeklySetGrid = existsSync("src/components/WeeklySetGrid.tsx")
  ? read("src/components/WeeklySetGrid.tsx")
  : "";
const plannedSetGrid = existsSync("src/lib/planned-set-grid.ts")
  ? read("src/lib/planned-set-grid.ts")
  : "";
const muscleGrowthCoach = existsSync("src/components/MuscleGrowthCoach.tsx")
  ? read("src/components/MuscleGrowthCoach.tsx")
  : "";
const strengthTutorial = existsSync("src/components/StrengthEngineTutorial.tsx")
  ? read("src/components/StrengthEngineTutorial.tsx")
  : "";
const onboardingPage = existsSync("src/routes/onboarding.tsx")
  ? read("src/routes/onboarding.tsx")
  : "";
const planPage = existsSync("src/routes/_tabs.plan.tsx") ? read("src/routes/_tabs.plan.tsx") : "";
const strengthPage = existsSync("src/routes/_tabs.strength.tsx")
  ? read("src/routes/_tabs.strength.tsx")
  : "";
const athletePage = existsSync("src/routes/_tabs.athlete.$id.tsx")
  ? read("src/routes/_tabs.athlete.$id.tsx")
  : "";
const fifaStats = existsSync("src/lib/fifa-stats.ts") ? read("src/lib/fifa-stats.ts") : "";

check("package.json exists", !!packageJson.name, "Project metadata is readable.");
check(
  "production build script",
  packageJson.scripts?.build?.includes("vite build"),
  "Build script runs Vite.",
);
check(
  "first update version",
  (xcodeProject.match(/MARKETING_VERSION = 1\.2;/g)?.length ?? 0) >= 6 &&
    (xcodeProject.match(/CURRENT_PROJECT_VERSION = 143;/g)?.length ?? 0) >= 6 &&
    whatsNew.includes("WHATS_NEW_VERSION = 202608288"),
  "The app, activity extension and watch targets are versioned as 1.2 (143), with a matching in-app update summary.",
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
  "weekly planned-set map",
  existsSync("src/lib/planned-set-grid.test.ts") &&
    weeklySetGrid.includes("buildPlannedSetGrid") &&
    plannedSetGrid.includes("exerciseConfig") &&
    plannedSetGrid.includes("state.programs") &&
    planPage.includes("<WeeklySetGrid") &&
    strengthPage.includes("<WeeklySetGrid"),
  "Plan and Strength share a tested weekly square grid derived from scheduled exercises and active program sets.",
);
check(
  "earned muscle progression",
  muscleGrowthCoach.includes("progressionBoard") &&
    muscleGrowthCoach.includes("HOLD LOAD") &&
    muscleGrowthCoach.includes("NEXT LOAD") &&
    muscleGrowthCoach.includes("Earn more load") &&
    strengthTutorial.includes("Plan → lift → progress") &&
    strengthTutorial.includes("prefers-reduced-motion") &&
    onboardingPage.includes("<StrengthEngineTutorial"),
  "Muscle Lab ties next-load guidance to logged performance and onboarding explains the Plan-to-progress loop with Reduce Motion support.",
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
check(
  "App Store-only public website",
  landingPage.includes("https://apps.apple.com/app/deadset/id6783511541") &&
    landingPage.includes("Download on the App Store") &&
    !landingPage.includes('to="/auth"') &&
    !landingPage.toLowerCase().includes("stripe") &&
    rootRoute.includes("WebMarketingRedirect") &&
    !indexHtml.includes('rel="manifest"') &&
    publicRedirects.includes("/auth / 302"),
  "Browser visitors see the App Store campaign, former app routes are retired, and native OAuth keeps its dedicated callback.",
);
check(
  "splash asset",
  existsSync("src/assets/splash-2732.png.asset.json"),
  "Splash asset metadata exists.",
);
check(
  "native cold-start experience",
  infoPlist.includes("<string>LaunchScreen</string>") &&
    launchStoryboard.includes('image="Splash"') &&
    indexHtml.includes('id="deadset-boot-screen"') &&
    indexHtml.includes('class="boot-mark"') &&
    !indexHtml.includes('class="boot-logo"') &&
    !indexHtml.includes('src="/icon-512.png"') &&
    indexHtml.includes("Preparing your training") &&
    indexRoute.includes("NativeSessionLoading") &&
    indexRoute.includes("finishAppBoot") &&
    indexRoute.includes("NativeWelcome"),
  "The native launch image hands off to a persistent readiness loader and only reveals a fully painted destination.",
);
check(
  "auth and loader wordmarks",
  staticAuthPage.includes('<h1 class="brand">DEAD<span>SET</span></h1>') &&
    staticAuthPage.includes(".page::-webkit-scrollbar") &&
    staticAuthPage.includes("scrollbar-width: none") &&
    !staticAuthPage.includes('class="brand-image"') &&
    indexHtml.includes('<span class="boot-dead">DEAD</span>') &&
    indexHtml.includes('<span class="boot-set">SET</span>'),
  "Authentication restores the compact neon wordmark, while launch uses standalone animated lettering with no boxed app icon or visible side scrollbar.",
);
check(
  "signup-first native welcome",
  nativeWelcome.includes('nativeAuthHref("signup")') &&
    nativeWelcome.includes('nativeAuthHref("signin")') &&
    nativeWelcome.includes("/auth/index.html?mode=${mode}") &&
    oauthClient.includes('get("mode") === "signin"') &&
    authClient.includes("authModeFromUrl(window.location.href)"),
  "First launch prioritizes account creation and provides a direct returning-user sign-in path.",
);
check(
  "iPhone portrait and arm64 release support",
  infoPlist.includes("<string>arm64</string>") &&
    !infoPlist.includes("UIInterfaceOrientationLandscapeLeft") &&
    !infoPlist.includes("UIInterfaceOrientationLandscapeRight"),
  "The iPhone-only interface declares the architecture it ships and only the orientation it supports.",
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
  "App Store rating requests",
  existsSync("src/lib/app-review.test.ts") &&
    rootRoute.includes("<AppReviewWatcher />") &&
    appReviewWatcher.includes("deadset_native_review_state_v2") &&
    appReviewClient.includes("REVIEW_MILESTONES = [3, 10, 25]") &&
    appReviewClient.includes("action=write-review") &&
    appReviewPlugin.includes("AppStore.requestReview(in: scene)") &&
    appReviewPlugin.includes('CAPPluginMethod(name: "open"') &&
    settingsPage.includes("Rate DEADSET"),
  "Successful workouts can trigger Apple's rating sheet, while Settings always provides a direct write-review link.",
);
check(
  "visible support and version details",
  settingsPage.includes("support@deadsetfit.org") &&
    settingsPage.includes("App.getInfo()") &&
    settingsPage.includes("Contact support"),
  "Settings provides direct support and reports the installed native version/build.",
);
check(
  "StoreKit subscription products",
  storeKitPlugin.includes("org.deadsetfit.pro.monthly") &&
    storeKitPlugin.includes("org.deadsetfit.pro.annual") &&
    storeKitClient.includes("org.deadsetfit.pro.monthly") &&
    storeKitClient.includes("org.deadsetfit.pro.annual"),
  "Native and web layers use the same two immutable App Store product identifiers.",
);
check(
  "verified Apple entitlement",
  storeKitPlugin.includes("Transaction.currentEntitlements") &&
    storeKitPlugin.includes("case .verified") &&
    proProvider.includes("getAppleEntitlement") &&
    !proProvider.includes("iosFree"),
  "Only StoreKit-verified, unexpired, non-revoked purchases unlock Pro on iPhone.",
);
check(
  "Apple purchase recovery",
  storeKitPlugin.includes("AppStore.sync()") &&
    storeKitPlugin.includes("showManageSubscriptions") &&
    upgradePage.includes("Restore purchases") &&
    upgradePage.includes("purchaseApplePro"),
  "The iPhone paywall can purchase, restore, and manage Apple subscriptions.",
);
check(
  "StoreKit seven-day trial disclosure",
  storeKitPlugin.includes("introductoryOffer") &&
    storeKitPlugin.includes("isEligibleForIntroOffer") &&
    upgradePage.includes("isSevenDayFreeTrial") &&
    upgradePage.includes("Start my 7-day free trial"),
  "The iPhone paywall reads Apple's configured offer and eligibility before advertising the seven-day trial.",
);
check(
  "RevenueCat StoreKit 2 tracking",
  packageJson.dependencies?.["@revenuecat/purchases-capacitor"] &&
    revenueCatClient.includes("PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP") &&
    revenueCatClient.includes("STOREKIT_VERSION.STOREKIT_2") &&
    revenueCatClient.includes("recordPurchase") &&
    revenueCatClient.includes("syncPurchases") &&
    upgradePage.includes("recordRevenueCatPurchase") &&
    upgradePage.includes("syncRevenueCatPurchases"),
  "RevenueCat observes the existing StoreKit 2 checkout and records both new and restored purchases.",
);
check(
  "RevenueCat identity and disclosure",
  revenueCatSync.includes("session.user.id") &&
    revenueCatSync.includes("deadset:explicit-logout") &&
    rootRoute.includes("<RevenueCatSync />") &&
    privacyPage.includes("RevenueCat") &&
    /subscription receipt and\s+entitlement/.test(privacyPage),
  "RevenueCat customers use account IDs, explicit logout is handled, and subscription processing is disclosed.",
);
check(
  "Stripe isolated from native checkout",
  upgradePage.includes("startApplePurchase") &&
    upgradePage.includes("iosNative ?") &&
    proProvider.includes("!nativeIos && session && isPaymentsConfigured()") &&
    !paywallSheet.includes("deadsetfit.org/upgrade") &&
    !storeKitPlugin.toLowerCase().includes("stripe"),
  "Native checkout uses StoreKit; no Stripe path is exposed in the iPhone purchase flow.",
);
check(
  "Apple subscription terms",
  termsPage.includes("processed by Apple") &&
    termsPage.includes("renew automatically") &&
    termsPage.includes("App Store account") &&
    termsPage.includes("New subscriptions") &&
    termsPage.includes("iPhone app"),
  "Terms describe the Apple-only purchase path and preserve legacy subscription obligations.",
);
check(
  "camera usage string",
  infoPlist.includes("NSCameraUsageDescription"),
  "Info.plist declares NSCameraUsageDescription (required — camera is used for check-in photos).",
);
// The nearby-athletes city fill calls navigator.geolocation. WKWebView only
// raises the permission prompt when the host app declares a purpose string, and
// App Privacy declares Coarse Location — a binary without this contradicts it.
check(
  "location usage string",
  !/navigator\.geolocation/.test(friendsPage) ||
    infoPlist.includes("NSLocationWhenInUseUsageDescription"),
  "Info.plist declares NSLocationWhenInUseUsageDescription for the optional city lookup.",
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
  "PurchaseHistory",
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
  "Sign in with Apple revocation",
  appleOAuthServer.includes("exchangeAppleAuthorizationCode") &&
    appleOAuthServer.includes("revokeAppleRefreshToken") &&
    oauthServer.includes("storeAppleRefreshToken") &&
    rpcServer.includes("revokeAppleRefreshToken") &&
    appleCredentialMigration.includes("oauth_credentials") &&
    appleCredentialMigration.includes("enable row level security") &&
    appleCredentialMigration.includes("revoke all"),
  "Apple authorization codes are exchanged, the service-only revocation credential is retained, and account deletion revokes it.",
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
  "friend requests and strength comparisons",
  friendsPage.includes("getFriendConnections") &&
    friendsPage.includes("updateFriendship") &&
    friendsPage.includes("Friend requests") &&
    rpcServer.includes("async getFriendConnections") &&
    rpcServer.includes("async updateFriendship") &&
    athletePage.includes("MuscleHeadToHead") &&
    fifaStats.includes("strengthMap"),
  "Friendship is request-based, handled on both client and server, and mutual friends can compare public Strength Maps.",
);
// Crew names and tags are athlete-authored and shown on the public ladder, so
// they are a user-generated surface in their own right. Guideline 1.2 wants a
// report path for every such surface, and blocking has to hold inside a crew.
const crewPanel = existsSync("src/components/CrewPanel.tsx")
  ? read("src/components/CrewPanel.tsx")
  : "";
check(
  "crew safety controls",
  !crewPanel ||
    (crewPanel.includes("reportContent") &&
      rpcServer.includes("crewId") &&
      rpcServer.includes("reported_crew_id") &&
      rpcServer.includes("blockedUserIds(supabaseAdmin, viewerId)")),
  "Crews are reportable and crew rosters respect blocks.",
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
// A plugin can compile, ship inside the binary, and still be unreachable from
// JavaScript: this Capacitor version does not auto-discover classes living in the
// app target, so an unregistered plugin fails silently with no error anywhere.
// RestActivityPlugin shipped exactly that way until it was caught at runtime.
const unregisteredPlugins = localPlugins.filter(
  (file) => !viewController.includes(`registerPluginInstance(${file.replace(".swift", "")}()`),
);
check(
  "app-local iOS plugins are registered",
  localPlugins.length > 0 && unregisteredPlugins.length === 0,
  unregisteredPlugins.length === 0
    ? `All ${localPlugins.length} app-local Capacitor plugin(s) are registered in MyViewController.`
    : `Not registered in MyViewController, so unreachable from JavaScript: ${unregisteredPlugins.join(", ")}`,
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
  oauthClient.includes('NATIVE_AUTH_CALLBACK = "org.deadsetfit.app://auth/callback"') &&
    oauthClient.includes('NATIVE_AUTH_BRIDGE = "https://deadsetfit.org/auth/native-callback"') &&
    authClient.includes("NATIVE_AUTH_CALLBACK") &&
    authClient.includes("NATIVE_AUTH_BRIDGE") &&
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
