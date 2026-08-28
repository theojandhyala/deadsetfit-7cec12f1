# DEADSET App Store Release Brief

Updated: August 28, 2026

## Positioning

DEADSET should be sold as the gym app that answers three questions with minimal friction:

1. What am I training today?
2. What did I lift last time?
3. Am I getting stronger?

The differentiator is not an oversized feature list. It is a fast workout loop with unusually deep
progression, planning, and competition underneath it.

## Recommended Listing

**Name:** DEADSET: Gym Workout Log

**Subtitle:** Plan Workouts. Track Every PR.

**Promotional text:** Build your full training week, walk into the gym knowing exactly what is next,
log every set, and turn consistency into visible progress.

**Keywords:** gym,workout,tracker,lifting,strength,PR,program,fitness,bodybuilding,exercise,training,log

**Primary category:** Health & Fitness

**Secondary category:** Sports

### Description

FORGE YOUR BODY. PROVE EVERY REP.

DEADSET keeps your training week clear and your progress impossible to miss. Build a schedule around
the days and equipment you have, choose every exercise, set your sets and reps up front, then open the
app and train the next workout.

PLAN THE WHOLE WEEK

- Build three-, four-, five-, or six-day schedules
- Choose from the exercise catalogue or create your own movements
- Set exercises, sets, reps, supersets, rest, tempo, RIR, and progression rules
- Edit any day whenever your training changes
- Opt into iPhone reminders that follow the selected training days and time

LOG WITHOUT LOSING FOCUS

- See your previous performance before each set
- Log weight, reps, RPE, warmups, drop sets, and AMRAPs
- Use superset-aware rest timers, plate loading, and warm-up ramps
- Resume an interrupted session without losing the workout

SEE REAL PROGRESS

- Automatic personal-record detection
- Lift history, estimated one-rep max, volume, measurements, and progress photos
- A bodyweight-adjusted Strength Map showing trained, untrained, and developing muscle groups
- A weekly square set map built from the exercises and set targets in your plan
- Earned next-load recommendations based on completed sets, plus Ghost Mode
- Strength standards, streaks, achievements, and seasonal ranks

TRAIN WITH PEOPLE

- Send, accept, decline, cancel, and remove friend requests
- Compare public PRs and Strength Maps side by side with accepted friends
- Share training updates
- Compete in ranked leagues and head-to-head challenges
- Report or block users directly in the app

Eligible new members receive a seven-day free trial, then DEADSET is £5.99 per month in the UK or
Apple's displayed local price. One membership unlocks workout planning, logging, Strength Map,
muscle development, progression, competition, recovery, and history tools.

DEADSET provides fitness information and tracking, not medical advice. Consult a qualified
professional before beginning a new training program.

## Screenshot Order

Use the generated 6.9-inch assets in `artifacts/app-store/ios-6.9`:

1. `01-today.png` - immediate clarity: what to train today.
2. `02-logger.png` - the core logging and PR loop.
3. `03-ranked.png` - differentiated identity, competition, and retention.

Before submission, capture at least two more real screens from the release archive:

4. Weekly set grid showing how scheduled exercises distribute sets across the week.
5. Strength Map and Muscle Lab showing trained muscles and an earned next-load recommendation.
6. Accepted-friend comparison showing side-by-side public Strength Maps using seeded review-safe accounts.

Do not use device frames supplied by other brands. Do not show unfinished, empty, or placeholder
states. Keep all screenshot claims visible and achievable in the submitted build.

## App Privacy Answers

The App Store Connect privacy questionnaire must match `ios/App/App/PrivacyInfo.xcprivacy`.

Declare data linked to the user, not used for tracking:

- Name
- Email address
- User ID
- Health
- Fitness
- Photos or videos
- Other user content
- Purchase history
- Other usage data

Purposes are app functionality and product personalization, with analytics only for aggregated
usage/attribution data. Health and fitness data must never be declared or used for advertising,
data-broker sharing, credit, employment, or insurance decisions.

Privacy Policy URL: `https://deadsetfit.org/privacy`

## Review Notes

Provide App Review with:

- A durable review account with completed onboarding and representative sample workouts.
- Exact steps to open Plan, inspect the weekly set grid, edit a day, start a workout, log a set, finish it, and view the Strength Map.
- Exact steps to send and accept a friend request, then open the mutual PR and Strength Map comparison.
- A note that Apple Health is optional and only appears on a physical supported device.
- A note that workout notifications are optional local reminders, requested in context during setup or from Settings, with a five-second delivery test in Settings.
- A note that DEADSET is not a regulated medical device and makes no diagnosis or treatment claim.
- A note explaining the iOS Pro experience and every platform-specific limitation.
- Working contact details monitored during review.

Never submit with a review account that triggers the username-claim overlay, an empty plan, a payment
error, or an unavailable social-login button.

## Submission Gates

Run:

```sh
npm run appstore:check
npm run appstore:strict
```

`appstore:strict` must pass immediately before archiving. It live-checks both Google and Apple
provider redirects.

Also verify in a release-signed build on a physical iPhone:

- Fresh email signup, email confirmation, login, logout, and password reset
- Google and Apple signup and returning login
- Account deletion, including Sign in with Apple token revocation
- Onboarding and non-empty starter-plan generation for both setup modes and every equipment choice
- Schedule create, edit, reorder, and persistence after relaunch
- Start, interrupt, resume, and finish workout
- Offline launch and local logging followed by successful reconnect
- Apple Health permission denial, partial permission, connect, import, export, and disconnect
- Workout notification denial, approval, time change, plan change, delivery, tap-through, and disable
- Camera/photo denial and successful progress-photo selection
- Friend request send, accept, decline and cancel; removal; mutual Strength Map comparison; reports, blocks, challenges, and leaderboards
- Dynamic Type, VoiceOver, Reduce Motion, dark appearance, and all supported iPhone sizes
- No clipped text, keyboard obstruction, horizontal overflow, blank loading state, or console error

## External Release Blockers

These cannot be completed only in the repository:

- Keep the first-party DEADSET Google OAuth client, Apple Services ID, and authentication broker
  active, then run `npm run appstore:strict` immediately before archiving. Lovable is not part of
  the current authentication path.
- Verify Google and Apple signup and returning login on a physical iPhone through
  the HTTPS callback bridge and `org.deadsetfit.app://auth/callback`.
- Confirm the first-party Apple code exchange, service-only refresh-token storage, and Sign in with
  Apple revocation during account deletion on a physical iPhone.
- Confirm the monthly StoreKit product loads at Apple's localized price, shows the one-week trial only
  to eligible accounts, purchases, restores and opens Apple's subscription-management screen in the
  submitted build. The annual identifier is legacy-entitlement-only and Stripe must remain unavailable
  inside the iOS app.
- Complete App Store Connect privacy answers, age rating, category, support URL, screenshots, review
  account, and export-compliance questions.
- Confirm Cloudflare production secrets for Supabase, Stripe, and webhooks.

Do not mark the release ready while any blocker above still applies.
