import { existsSync, readFileSync } from "node:fs";

const strict = process.env.APPSTORE_STRICT === "1";
const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, pass, detail, level = "error") {
  checks.push({ name, pass, detail, level });
}

const packageJson = JSON.parse(read("package.json"));
const capacitorConfig = existsSync("capacitor.config.ts") ? read("capacitor.config.ts") : "";
const activeCapacitorConfig = capacitorConfig
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");
const upgradePage = existsSync("src/routes/upgrade.tsx") ? read("src/routes/upgrade.tsx") : "";
const infoPlist = existsSync("ios/App/App/Info.plist") ? read("ios/App/App/Info.plist") : "";
const platformUtil = existsSync("src/lib/platform.ts") ? read("src/lib/platform.ts") : "";
const rpcClient = existsSync("src/lib/rpc-client.ts") ? read("src/lib/rpc-client.ts") : "";

check("package.json exists", !!packageJson.name, "Project metadata is readable.");
check(
  "production build script",
  packageJson.scripts?.build?.includes("vite build"),
  "Build script runs Vite.",
);
check(
  "full check script",
  packageJson.scripts?.check?.includes("tsc --noEmit"),
  "Check script runs TypeScript.",
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
  "Stripe blocked on native iOS",
  upgradePage.includes("iosNative ?") && upgradePage.includes("Checkout disabled on iPhone"),
  "Upgrade page blocks Stripe checkout inside native iOS.",
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
  "AI RPC production origin",
  rpcClient.includes('DEFAULT_API_ORIGIN = "https://deadsetfit.org"') &&
    rpcClient.includes("VITE_API_ORIGIN"),
  "AI client has a production API fallback and configurable override.",
);
check(
  "AI RPC native/localhost fallback",
  rpcClient.includes("isNativeShell()") &&
    rpcClient.includes('window.location.hostname === "localhost"') &&
    rpcClient.includes('window.location.hostname === "127.0.0.1"'),
  "Native and local shells route AI requests to the live DEADSET API.",
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
