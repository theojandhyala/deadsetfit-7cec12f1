
# App Store Readiness Pass

This is a large scope. To ship this well without burning tokens on churn, I'll work in focused batches and report back after each. Here's what I plan to do vs. what needs your input.

## Already in place (verified)
- **Account deletion** — exists in Profile → "Delete Account" (line 726 of `_tabs.profile.tsx`), calls `deleteAccount` server fn. ✅ Apple requirement met.
- **Capacitor config** — `capacitor.config.ts` is set up. Splash + StatusBar plugins configured.
- **Session persistence** — `persistSession: true` + `autoRefreshToken: true` on Supabase client; `StateSync` handles focus/visibility refresh; auth listener filters transient events.

## Batch 1 — Session/auth robustness (highest priority given history)
- Add explicit token refresh retry with backoff in `StateSync`
- Ensure `getMyProfile` failure → single retry before falling back
- Confirm `_tabs.tsx` bootstrap never leaves user on infinite spinner (2s cap already exists; verify)
- Add global 401 handler that clears session + routes to `/auth` cleanly

## Batch 2 — Loading & error states for AI features
- Add unified `<AsyncBoundary>` with spinner + error+retry for: meal scan, physique scan, AI coach, run coach, program generator
- Replace any silent `.catch(() => {})` with visible toast

## Batch 3 — Empty states
- Friends feed: designed empty state with "Find friends" CTA (currently a single line)
- PR list: designed empty state ("Log your first PR")
- Workout history / progress: empty state
- Leaderboard: empty state when no data

## Batch 4 — Native permission strings (Capacitor / iOS)
Add `ios.infoPlist` entries to `capacitor.config.ts` (or document for Xcode) with clear usage descriptions:
- `NSCameraUsageDescription`: "DEADSET uses the camera to scan meals and analyze your physique for personalized coaching."
- `NSPhotoLibraryUsageDescription`: "DEADSET accesses your photos to import progress pictures and meal photos."
- `NSPhotoLibraryAddUsageDescription`: "DEADSET saves progress pictures and share cards to your photos."

## Batch 5 — Polish
- Consistent card spacing on mobile (audit `_tabs.*` routes at iPhone widths)
- Ensure BottomNav doesn't overlap content (safe-area padding)
- Remove any dead-end buttons found in the sweep

## What I need from you
1. **Scope confirmation**: OK to do all 5 batches in one go, or do you want to review after Batch 1 (auth) since that's been the recurring pain point?
2. **Physique scanner exercise recs**: already implemented last turn — want me to expand to the meal scan (suggest recipes) and run coach (suggest workouts) too?
3. **Any specific broken flow you've hit recently** that I should prioritize? "Broken interactions" is broad — a screenshot or "when I tap X on Y screen, Z happens" would let me fix the exact thing instead of guessing.

Reply with "go" to run all 5 batches, or pick which batches to run first.
