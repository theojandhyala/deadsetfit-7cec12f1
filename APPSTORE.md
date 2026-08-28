# DEADSET App Store Release Guide

This repository ships DEADSET as a bundled Capacitor iPhone app. The public website is an App Store campaign page; it is not the product runtime. Core screens are packaged in the binary and network features use DEADSET's Cloudflare and Supabase services.

## Release identity

- App Store ID: `6783511541`
- Bundle identifier: `org.deadsetfit.app`
- Version: `1.2`
- Build: `142`
- Device family: iPhone
- Minimum iOS version: iOS 15
- Category: Health & Fitness
- Support URL: `https://deadsetfit.org`
- Support email: `support@deadsetfit.org`
- Privacy policy: `https://deadsetfit.org/privacy`
- Terms: `https://deadsetfit.org/terms`

The Rest Activity extension must use the same version and build as the main app.

## Production architecture

- UI: Vite, React, TanStack Router and Capacitor
- Website/API: Cloudflare at `deadsetfit.org`
- Accounts and synced data: Supabase project `fqfdygbveeztgxwkbmfi`
- Google and Apple sign-in: DEADSET-owned OAuth broker on `deadsetfit.org`
- iPhone subscriptions: Apple StoreKit 2 only
- Subscription analytics and cross-device entitlement sync: RevenueCat
- Apple Watch data: imported through HealthKit when the user opts in
- Workout export: completed DEADSET sessions can be written to Apple Health

Do not add a Capacitor `server.url` for release. The App Store binary must continue to use `webDir: "dist/client"`.

## Release checks

From the repository root:

```bash
npm ci
npm run check
npm audit --omit=dev
node scripts/check-bundle-config.mjs
APPSTORE_STRICT=1 node scripts/appstore-check.mjs
npx cap sync ios
xcodebuild \
  -project ios/App/DeadSet.xcodeproj \
  -scheme DeadSet \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

The strict readiness check probes both Google and Apple OAuth in web and native modes. Run it while online. A passing simulator build proves compilation, not App Store product configuration, signing or real-device HealthKit behavior.

## Manual QA

Test a fresh install and an update from the previous public build on a real iPhone.

1. Confirm the native launch screen, session loader and signup-first welcome appear without a blank or web-browser flash.
2. Create an account with email, Google and Apple. Confirm provider consent screens name DEADSET or `deadsetfit.org`, never Lovable.
3. Complete onboarding, create a weekly schedule, set exercises, sets and rep targets, then confirm the weekly set grid and Strength Map reflect that plan.
4. Start a scheduled workout, swap an exercise before its first set, log sets, use the rest timer and finish the workout.
5. Force-quit during a workout and confirm the active session resumes without losing logged sets.
6. Log food and water, inspect progress, rankings and every bottom-tab destination. Send, accept, decline and cancel friend requests; confirm mutual friends can compare public PRs and Strength Maps side by side.
7. Connect Apple Health, verify steps and activity data, then finish a workout and confirm it appears in Apple Fitness.
8. Buy the monthly Pro product in the sandbox. Verify the seven-day introductory offer for an eligible sandbox account, immediate monthly pricing for an ineligible account, entitlement, restore, Manage Subscription and cancellation behavior.
9. Sign out and back in on another device. Confirm cloud training data and Pro access return.
10. Test account deletion, notification permission denial and approval, the five-second Lock Screen notification test, camera/photo denial, offline launch and recovery from network errors.
11. Open Privacy, Terms, Support and Rate DEADSET from Settings.
12. Run VoiceOver, Dynamic Type and keyboard focus checks on onboarding, schedule editing, live workout and paywall screens.

## Subscription review

The app recognizes these immutable product identifiers:

- `org.deadsetfit.pro.monthly`
- `org.deadsetfit.pro.annual`

Only `org.deadsetfit.pro.monthly` is offered for a new purchase in version 1.2. Before submission, confirm it is approved in App Store Connect, priced at £5.99 in the UK, and configured with a one-week introductory free trial. `org.deadsetfit.pro.annual` remains recognized only for existing legacy entitlements and must not be presented as a newly offered plan. RevenueCat observes StoreKit transactions; it does not replace Apple's purchase sheet.

The iPhone app must not expose Stripe, a web checkout, external purchase instructions or buttons that route users around Apple's in-app purchase system. Legacy web subscriptions may still be recognized after sign-in, but new iPhone purchases use StoreKit.

## App Review notes

Provide App Review with a working non-Pro reviewer account and concise navigation steps. Include these facts:

- A reviewer can build a schedule in Plan and start a workout in Train.
- Apple Health is optional. The app remains usable when Health permission is denied.
- Camera and photo access are optional and used for progress check-ins and avatars.
- Sign in with Apple and Google return through `deadsetfit.org` to the bundled app.
- Pro is sold through Apple's monthly subscription. The annual identifier is recognized only for existing legacy entitlements.
- Restore Purchases and Manage Subscription are on the Pro screen.
- Account deletion is available inside Profile.

Never give App Review an expired account, a production paywall that cannot load, or instructions that depend on an unreleased website state.

## App Store assets

- 1024 x 1024 icon with no alpha channel
- Current iPhone screenshots for the display sizes requested by App Store Connect
- Screenshots showing Train, the weekly set grid, Strength Map, live workout, friend comparison and Apple Fitness integration
- Accurate app description, keywords, privacy answers and age rating
- Current support and privacy URLs
- Version 1.2 release notes matching the in-app New in 1.2 summary

Suggested release notes:

> DEADSET 1.2 turns your plan into visible progress. Find athletes reliably by name or @username, discover lifters in your city, manage every friend-request state and compare accepted friends side by side. This update also adds contextual Lock Screen notification setup and testing, clearer social error recovery, stronger onboarding, weekly set maps and Strength Map progression.

## Archive and upload

1. Open `ios/App/DeadSet.xcodeproj` in Xcode.
2. Select the DEADSET development team and confirm automatic signing has no errors.
3. Select Any iOS Device (arm64).
4. Choose Product > Archive.
5. In Organizer, run Validate App before Distribute App.
6. Upload to App Store Connect and wait for processing.
7. Attach build 142 to version 1.2 and complete export compliance and content-rights questions. The approved monthly subscription remains available to the app; do not present the annual legacy product as a new plan.
8. Test the processed build in TestFlight before submitting it for review.

Every bundled product update requires a new App Store build and review. Website deployment alone does not update the installed app.
