# DEADSET — App Store Connect Listing Kit

Everything below is paste-ready for App Store Connect (appstoreconnect.apple.com
→ My Apps → **+ New App**). Build **1.0 (3)** is already uploaded and will appear
under the app's TestFlight/Build section once processing finishes (~15 min).

## New App form

| Field | Value |
|---|---|
| Platform | iOS |
| Name | **DEADSET — Gym Workout Tracker** (30-char limit; fallback if taken: `DEADSET Workout Tracker`) |
| Primary language | English (U.K.) |
| Bundle ID | `org.deadsetfit.app` |
| SKU | `deadset-ios-001` |
| User access | Full Access |

## App Information

| Field | Value |
|---|---|
| Subtitle (30 chars) | `Track lifts. PRs. Rank up.` |
| Primary category | Health & Fitness |
| Secondary category | Sports (optional) |
| Content rights | Does not use third-party content |
| Age rating | Answer **None/No** to every content question except: Unrestricted Web Access → **No**, Gambling → **No**. Expected result: **4+** (12+ if user-generated content prompts it — the questionnaire may add it for social features; accept what it computes). |

## Version Information (1.0)

**Promotional text** (170 chars, can change anytime):
```
Train. Log. Rank up. DEADSET turns your training into a ranked game — live set logging, automatic PR detection, streaks, leagues and head-to-head challenges.
```

**Description**:
```
DEADSET is the gym tracker built for lifters who want proof, not vibes. Log
sets as you lift, and every rep is checked against your history — real PRs,
detected automatically, never self-reported.

TRAIN
• Build your own week — every day, exercise, set, rep and weight — or start
  from a proven split in one tap
• Live set logging designed for the gym floor: tap to tick a set, no typing
• Automatic PR detection with instant celebrations
• Plate math and warm-up ramps for every working weight

TRACK
• Bodyweight, measurements and progress photo check-ins
• Strength standards and rep-max tables for your big lifts
• Consistency heatmap, weekly tonnage and muscle-group balance
• Food, water and macro logging — as simple or detailed as you want

COMPETE
• Earn grit for every session, PR and streak day
• Climb ranked divisions from Bronze to Elite
• Leaderboards for grit, bench, squat, deadlift and total
• Challenge friends head-to-head and post your lifts to the crew feed

Your data stays yours: export everything as JSON or CSV any time, and sync
workouts both ways with Apple Health so watch sessions count toward your
streak and your gym sessions close your rings.

Free to train — no card required.
```

**Keywords** (100 chars max, no spaces after commas):
```
gym,workout,tracker,lifting,PR,bench,squat,deadlift,strength,log,fitness,bodybuilding,streak
```

| Field | Value |
|---|---|
| Support URL | `https://deadsetfit.org/guide` |
| Marketing URL | `https://deadsetfit.org` |
| Copyright | `© 2026 Theo Jandhyala` — this DOES show on the App Store product page, and it's fully yours to set. |

## App Privacy (questionnaire)

Data collection: **Yes, we collect data.**

| Data type | Collected? | Linked to identity? | Tracking? | Purpose |
|---|---|---|---|---|
| Contact Info → Email Address | Yes | Yes | No | App Functionality (account) |
| Health & Fitness → Fitness | Yes | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality (progress photos, avatar) |
| User Content → Other User Content | Yes | Yes | No | App Functionality (posts, comments) |
| Location → Coarse Location | Yes | Yes | No | App Functionality (city-level nearby athletes; optional) |
| Identifiers → User ID | Yes | Yes | No | App Functionality |

Everything else: **Not collected.** Tracking (across apps/websites): **No** for all.

Privacy Policy URL: `https://deadsetfit.org/privacy`

## App Review Information

| Field | Value |
|---|---|
| Sign-in required | **Yes** |
| Demo account | **CREATE A FRESH ACCOUNT FOR THIS** — sign up in the app with e.g. `review@deadsetfit.org` + a throwaway password, run it through onboarding once, then paste those credentials here. Do NOT use your personal account. |
| Notes | `Sign-up is free and requires no card. DEADSET Pro (subscriptions) is sold on our website only and is intentionally not purchasable or advertised anywhere in the iOS app. HealthKit is used to import Apple Watch workouts and export finished gym sessions; the app is fully functional if Health access is declined. User-generated content (posts/comments) supports in-app reporting and user blocking from every post and profile.` |

## Pricing & Availability

- Price: **Free** (0.00)
- Availability: all territories (default)

## Build

- Attach build **1.0 (3)** (uploaded 16 Jul 2026 — appears after processing).
- Export compliance: already answered in the binary (`ITSAppUsesNonExemptEncryption = false`) — no prompt expected.

## Screenshots (6.9", 1320×2868 — capture rig ready on iPhone 17 Pro Max sim)

Suggested set, in order:
1. Train dashboard (today's mission + week strip)
2. Live workout logger (sets ticked, PR flame)
3. PR celebration / NEW PR banner
4. Profile athlete card (rank, stats)
5. Progress (heatmap + strength standards)
6. Diet dashboard (fuel + macros)

Then: **Add for Review → Submit for Review.**
