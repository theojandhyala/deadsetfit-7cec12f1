# DEADSET — App Store Submission Guide

This app is a TanStack Start web app. To ship it on the App Store you wrap it with **Capacitor** (a thin native shell) and submit through Xcode.

## 1. Local setup (one time)

```bash
bun add -D @capacitor/cli
bun add @capacitor/core @capacitor/ios @capacitor/android @capacitor/splash-screen @capacitor/status-bar
bun run build
npx cap add ios
npx cap add android
npx cap sync
```

`capacitor.config.ts` is already in the repo. By default it loads the live site at `https://deadsetfit.org` — perfect for iterating without resubmitting.

## 2. App Store-ready build

Before the final submission, comment out `server.url` in `capacitor.config.ts` so the app ships the bundled web build. App Review can reject shells that depend on a live website for core functionality:

```ts
// server: { url: "https://deadsetfit.org", cleartext: false },
```

Then:

```bash
npm run appstore:check
APPSTORE_STRICT=1 node scripts/appstore-check.mjs
npx cap sync ios
npx cap open ios
```

Xcode opens. In Xcode:

- Set **Team** (your Apple Developer account)
- Set **Bundle Identifier**: `org.deadsetfit.app`
- Set **Version** + **Build**
- Product → Archive → Distribute App → App Store Connect

## 3. Required App Store assets (you provide)

| Asset              | Size                                | Notes                                     |
| ------------------ | ----------------------------------- | ----------------------------------------- |
| App icon           | 1024×1024 PNG, no alpha             | Use the DEADSET red-on-black mark         |
| iPhone screenshots | 1290×2796 (6.7")                    | At least 3 — Train, Friends, Profile tabs |
| iPad screenshots   | 2048×2732 (optional)                | Only if you ship iPad                     |
| Launch screen      | Already wired                       | Uses `splash-2732.png` from CDN           |
| Privacy policy URL | `https://deadsetfit.org/privacy`    | Already live                              |
| Support URL        | Pick one (e.g. mailto link or page) | Required                                  |

## 4. App Store Connect metadata

- **Name**: DEADSET
- **Subtitle**: Train. Build. Become.
- **Category**: Health & Fitness
- **Age rating**: 4+
- **Description**: pull from `src/components/Landing.tsx` value props
- **Keywords**: gym, workout, PR, bench, squat, deadlift, strength, lifting log, program

## 5. Things to disclose in App Review

- The app uses **email + Google sign-in** (Lovable Cloud / Supabase auth).
- The app makes **AI calls** for the coach feature (Lovable AI Gateway).
- The app accepts **payments via Stripe** for Pro on web. The native iOS upgrade page currently blocks Stripe checkout because Apple requires **In-App Purchase** for digital subscriptions. Before submitting a paid iOS build, either integrate StoreKit/RevenueCat or ship iOS as free-tier only.

## 6. Pre-submission QA checklist

- Run `npm run appstore:check`.
- Disable `server.url`, then run `APPSTORE_STRICT=1 node scripts/appstore-check.mjs`.
- Fresh-install the iOS build on a real iPhone, create an account, complete onboarding, start and finish a workout, log food/water, open Profile, open Privacy/Terms, and verify the Pro page does not show Stripe checkout.
- Test offline launch after first install. The shell should render the bundled app and show recoverable network states for auth, sync, AI, and billing features.
- Verify screenshots are from the current UI and do not show test payment banners, debug copy, or placeholder data.
- Confirm App Privacy answers cover account identifiers, workout/health-adjacent data, photos uploaded for physique scans, purchase history, diagnostics, and AI processing.

## 7. Updating after release

Because `capacitor.config.ts` can point at the live site, most updates are just `bun run build` + deploy — no resubmission needed. Resubmit only when you change native config, icons, splash, or permissions.
