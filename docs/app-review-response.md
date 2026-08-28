# DEADSET App Review Package

Use this package for every submission. Replace bracketed values only with facts verified on the
submitted build. Keep the complete answer in App Review Notes and attach the physical-device video
to the Resolution Center response.

## App Review Notes

DEADSET is a training planner and workout tracker for recreational and experienced gym users. It
helps a user build a weekly exercise schedule, set sets/reps/weight targets, log live workouts,
track PRs and body metrics, review training and nutrition history, optionally connect Apple Health,
and participate in opt-in friend challenges and ranked leaderboards. It is not a medical device and
does not diagnose, treat, or prescribe.

TESTED DEVICES

- [physical iPhone model], [iOS version]
- [second physical device, if tested]
- iPhone 17 Pro simulator, iOS 26.5 (layout and launch smoke test only)

ACCESS
Review account: use the username/password supplied in App Store Connect's Sign-In Information.
The account has completed onboarding and contains representative training data. New registration
also works from Create My Account using email, Sign in with Apple, or Google. No sample files or
special network/VPN are required.

CORE REVIEW FLOW

1. Launch > Sign In > use the supplied review account.
2. Home shows today's planned session. Tap Start Workout, log weight/reps, complete a set, then
   Finish Workout.
3. Plan > choose a day > Edit to add/reorder exercises and set sets, reps, rest, and target weight.
4. Progress shows workout history, PRs, body metrics, nutrition and league progress.
5. Community/Friends shows profiles, challenges and leaderboards. Open a user's menu to Report or
   Block. Users can only submit ordinary profile/post/check-in content.
6. Profile > Settings contains optional Apple Health and local workout reminders. Permission prompts
   are requested only after the corresponding user action.
7. Profile > Delete My Account > type DELETE permanently removes the account and personal training
   data. Sign in with Apple authorization is revoked for Apple-created accounts.

IN-APP PURCHASES
DEADSET is an auto-renewing monthly membership sold through Apple StoreKit on iPhone. Completing
onboarding opens the mandatory membership screen. Eligible Apple Accounts are shown a seven-day
free introductory trial followed by Apple's localized monthly price; ineligible accounts are shown
the immediate monthly price. The screen includes renewal/cancellation disclosure, Restore
Purchases, Manage Subscription, Account & Privacy, Terms of Use and Privacy Policy. Products:

- org.deadsetfit.pro.monthly: DEADSET Pro Monthly, one month
- org.deadsetfit.pro.annual: legacy entitlement only; not offered by the current screen
  No Stripe purchase flow or external purchase link is shown in the iOS app. Stripe is used only on
  the separately accessed website.

EXTERNAL SERVICES

- Supabase: authentication, database and user media storage
- Cloudflare: first-party website/API hosting and OAuth callback broker
- Apple and Google: optional account sign-in
- Apple StoreKit: iOS subscriptions
- Apple Health/HealthKit: optional read/write of user-approved fitness data
- Open Food Facts: optional food catalog search
- Stripe: website-only subscriptions, unavailable in the iOS app

REGIONS AND CONTENT
The submitted app has the same features worldwide except for Apple/Google/Health/StoreKit service
availability controlled by those platforms. DEADSET is not in a regulated industry and contains no
protected third-party material requiring authorization. Exercise and nutrition information is
general fitness information; health features are optional and not used for advertising.

CONTACT
[Name, monitored email and phone number]

## Physical Device Recording Shot List

Record one continuous, readable video on the latest available iOS release. Start on the Home Screen
before tapping DEADSET. Do not edit a simulator recording to look like a device recording.

1. Launch DEADSET and show Create My Account, email signup, Apple and Google options.
2. Sign into the populated review account and show Home/today's session.
3. Open Plan, change a day's exercises and targets, save, then start that workout.
4. Enter weight/reps, complete a set, show rest timer, finish, and open Progress/history/PRs.
5. Open the membership screen; show the seven-day offer or eligibility message, monthly Apple
   price, subscription terms, restore, manage, Account & Privacy,
   Terms of Use and Privacy Policy. Do not complete a live purchase in the recording.
6. Open Friends/Community, a user menu, Report and Block; cancel before altering the review account.
7. Open Settings, show Apple Health and notification controls and one permission prompt.
8. Open Delete My Account, show the irreversible warning and typed DELETE requirement, then cancel.
9. End on Profile showing the in-app Privacy, Terms and Disclaimer links.

Before attaching, play the entire recording with sound off and confirm the device model/status bar,
all taps, text, prices and permission prompts are visible and no private credentials appear.
