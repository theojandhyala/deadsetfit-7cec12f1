# GRIT — Full Roadmap Build Plan

You picked **everything**, AI-generated 500+ library, and full social + payments. That cannot land in one pass — it's roughly 8 focused passes. Here's the order I'll ship them in. Each pass leaves the app fully working; nothing half-built.

## Pass 1 (this turn) — Foundation
- Enable Lovable Cloud + auth (email + Google) — required for social, leagues, payments, photos, AI history.
- Migrate existing local-storage profile to a `profiles` row (keep local cache as fallback).
- Generate the **500+ exercise library** via AI on first run, cache to Cloud + local.
  - Per exercise: name, primary/secondary muscles, equipment, difficulty 1-5, pro tip, YouTube search query (used to embed form video), warm-up + stretch notes.
- Build the **muscle-diagram SVG** component (front/back body, highlights primary/secondary muscles per exercise).
- New `/library` browser screen with filters (muscle, equipment, difficulty).

## Pass 2 — Schedule Builder v2
- Split presets: PPL, Upper/Lower, Bro Split, Full Body, Custom.
- Drag-and-drop exercise picker per day (dnd-kit).
- Save multiple **named programs** (Bulk / Cut / Holiday) and switch active program.
- **Smart Suggest** server fn: scans the active week, flags missing muscle groups, proposes additions.

## Pass 3 — Live Workout Mode
- Full-screen session UI, swipeable exercise cards.
- Per-set log (weight + reps, 1-tap), rest timer with haptic vibration.
- Mid-workout **PR detection** → gold flash + confetti.
- Volume tracker (this session vs last for same exercise).
- End screen: **Pump Score** (AI 0-100), shareable summary card (html-to-image → download/share-sheet).

## Pass 4 — Gamification
- GRIT Points engine + level ladder (Rookie → GRIT Legend).
- Streaks: workout, diet, check-in (independent counters).
- Badge wall (First PR, 100 Sets, 30-Day Streak, 1000kg Week, …).
- Weekly community challenges (server-defined, progress per user).
- Theme unlocks per level (extra accent palettes).

## Pass 5 — Progress / Physique Tracker v2
- Photo check-in with **pose-guide overlay** (front/side/back silhouettes on camera view).
- **Physique Timeline** scroller, side-by-side W1 vs Now.
- Body measurements (chest/arms/waist/legs/weight) with trend graphs.
- **AI Physique Analysis** (Pro): sends latest photos to a vision model, returns coaching notes.
- Storage bucket `physique-photos`, private RLS.

## Pass 6 — AI Coach Chat + Warm-up/Recovery
- Persistent chat thread per user, AI Elements UI.
- Context fed in: last sessions, PRs, today's plan, mood, sleep.
- Modes: Pre-workout, Post-workout, Injury, Nutrition, Mood.
- Dynamic warm-up generator per muscle group; static stretch routine with hold timers.
- **Recovery Score** from sleep + rest days + consecutive training days.
- Interactive foam-rolling body map.
- Auto-deload week every 4-6 weeks (flagged in schedule).

## Pass 7 — Social + Viral
- Follow graph, community feed (PRs, transformations).
- Reactions + comments (RLS-scoped, light moderation flags).
- Branded share cards (workout summary + transformation before/after, GRIT watermark).
- Weekly **leagues** leaderboard (global + friends), reset Sunday via cron.
- Referral codes (both sides get 1 month Pro).
- Athlete-profile flag (manual for now).

## Pass 8 — Monetisation (Stripe)
- Plans: Free / Pro £7.99 / Elite £14.99 via Lovable's built-in Stripe.
- Gate: AI coach, full library videos, physique AI, leagues, custom themes, advanced analytics → Pro. Human form review queue → Elite.
- Billing portal, plan switch, cancel.

---

## Trade-offs you should know now

- **Form videos**: I can't host 500+ original videos. I'll embed YouTube searches per exercise (tap exercise → opens an in-app YouTube player with the best result). True hosted clips would require you to source them.
- **Pose-guide camera overlay**: works on mobile browsers via `getUserMedia`. iOS Safari requires HTTPS (the published Lovable URL is fine).
- **Human form review (Elite tier)**: I'll build the submission + queue + admin view, but actual review needs a human — you, or coaches you hire.
- **Community moderation**: I'll add report/hide tools, but you'll need to action reports yourself (no auto-moderation AI in scope).
- **AI cost**: 500+ library generation, per-session Pump Score, daily coach chat, physique analysis, smart-suggest — this burns Lovable AI credits. Keep an eye on Settings → Workspace → Usage.
- **TikTok/Instagram virality**: I can generate the shareable PNG card and trigger the OS share sheet. Actual posting to TikTok/IG from the app requires their APIs and review — out of scope.

---

## What ships in Pass 1 (this turn)

1. Lovable Cloud + auth (email + Google).
2. `profiles` table; existing onboarding writes to it.
3. `exercises` table + first-run AI generation of 500+ entries, cached.
4. Muscle-diagram SVG component.
5. `/library` browse screen with filters.
6. Train tab reads from Cloud library instead of the 30-exercise hardcoded list.

Approve and I'll start Pass 1.