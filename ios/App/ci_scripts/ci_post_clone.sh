#!/bin/sh
# Xcode Cloud post-clone step.
#
# The iOS app is a Capacitor shell around the Vite web build, and
# ios/App/App/public is gitignored — so the cloned repo has NO web assets.
# Without this script the archive succeeds but ships an empty app (or fails
# outright), which is why builds 119-121 never reached TestFlight.
#
# Xcode Cloud runs this from ci_scripts/, so step up to the repo root.
set -e

cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "--- Installing Node ---"
# The Xcode Cloud image does not ship Node; Homebrew is available.
if ! command -v node >/dev/null 2>&1; then
  brew install node
fi
node --version
npm --version

echo "--- Installing dependencies ---"
# Prefer the lockfile for reproducibility, but don't hard-fail the build if the
# lockfile and package.json have drifted.
npm ci --no-audit --no-fund || npm install --no-audit --no-fund

echo "--- Building web bundle ---"
npm run build

echo "--- Syncing web assets into the iOS project ---"
npx cap sync ios

echo "--- Verifying the bundle landed ---"
test -f ios/App/App/public/index.html || {
  echo "ERROR: ios/App/App/public/index.html missing after cap sync"
  exit 1
}
echo "Post-clone complete."
