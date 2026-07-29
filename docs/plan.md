# DEADSET — the plan

Written 2026-07-29. Supersedes nothing: [`BACKLOG.md`](../BACKLOG.md) keeps the
detailed tier list, [`ROADMAP.md`](../ROADMAP.md) keeps the release gates. This
file is the ordering and the reasoning — what to do first and why.

## Thesis

DEADSET wins on **trust on the gym floor, status off it**.

Two failure modes kill apps in this category: losing someone's sets mid-workout,
and a leaderboard everyone knows is fake. Pro sells competition, so integrity is
not polish — it is the product. Everything below is ordered by that, and by the
$0-per-user rule (no AI, no per-user vendor costs).

---

## Phase 0 — Stop the ground moving

Nothing else is safe until this is true. Discovered while shipping first-party
sign-in on 2026-07-29.

1. **Reconcile git with production.** `main` sat ~140 files behind the live app
   because production was deployed from a dirty working tree
   (`npm run deploy:cloudflare`). Any push to `main` would have regressed
   production, and there was no commit that matched what users were running.
   - _Done:_ the live tree is committed on `first-party-oauth`; CI now runs
     `bun run check` (types, lint, 71 tests) before deploying, and
     `scripts/check-bundle-config.mjs` refuses to ship a front-end built against
     the wrong Supabase project.
   - _Remaining:_ merge to `main`, update the stale CI build secrets, and make CI
     the only path to production.
2. **Audit paid entitlements.** The worker's `SUPABASE_SERVICE_ROLE_KEY` was
   invalid until 2026-07-29, and that key is the only thing behind the Stripe
   webhook's writes to `subscriptions` and `profiles.pro_until`
   (`src/cloudflare-worker.ts` → `getSupabaseAdmin`). Anyone who paid in that
   window may have no Pro access. Needs a one-off reconciliation: list Stripe
   subscriptions, upsert into Supabase, then keep
   `/api/health/supabase` green so it cannot recur silently.
3. **The Supabase migration.** The app was repointed from the Lovable-managed
   project (`upofuwryfvvtkhphtcop`) to one we own (`fqfdygbveeztgxwkbmfi`) with
   the schema but **no data**, so all 18 accounts were locked out and re-signups
   were creating empty duplicates.
   - _Done 2026-07-29:_ `scripts/migrate-old-project.ts` moved 18 accounts
     (passwords intact, ids preserved), 18 profiles, 14 `user_state` rows, 3
     subscriptions, 1 post, 1 follow, and seeded the 203-row exercise library
     the new project was missing. Referential integrity verified: no orphaned
     rows in any table.
   - _Remaining:_ turn on backups/PITR — a training log is a personal archive,
     and losing it is unforgivable in a way losing a to-do list is not. Then
     retire the old project once a few real logins are confirmed.
4. **In-app account deletion leaves data behind.** Surfaced during the
   migration: a deleted account's `user_state` row survives the auth user, and
   the old project still held 10 such orphans from accounts deleted long ago.
   `deleteMyAccount` needs to remove (or cascade to) `user_state`, `profiles`,
   and anything else keyed by `user_id`. This is an App Store 5.1.1(v)
   commitment, not just hygiene — the app promises deletion in its privacy
   disclosures.
5. **Serve the real Apple domain-association file.** `/.well-known/apple-developer-domain-association.txt`
   currently returns the SPA's HTML with a 200. Apple already accepted the
   Services ID, so this is not blocking today — it will fail a re-verification.

## Phase 1 — The two trust bets

**Never lose a set.** Offline-first logging with an outbox queue, plus the
`updated_at` conflict guard from BACKLOG Tier 0. Gyms are basements; sync dies
mid-set, and today two devices are last-write-wins. Ship the
photos-out-of-the-sync-blob fix alongside it — crossing the 2 MB blob cap
silently stops backing up _all_ training data for the most engaged users.

**Never trust a client-reported PR.** `grit_points` and `public_stats` are
client-writable through `saveProfile`, so the leaderboard is spoofable from
devtools. Move rank and PR computation server-side, add plausibility rules
(per-lift ceilings, rate-of-change limits), and split **verified vs unverified**
standing. A competitive app without anti-cheat becomes a joke leaderboard the
moment it gets popular — and the moat is the competition.

## Phase 2 — Best-in-class on the gym floor

Where "best app on the market" is actually won, and it is cheap:

- Wire up `RestTimer` — built, never mounted. Auto-start, haptics, sound.
- Logger depth: supersets, drop sets, warm-up ramps, per-set RPE/RIR, plate math,
  last-time values inline, one-tap "repeat last workout".
- Per-exercise history and PR timeline graphs.
- Deterministic progression and deload: stalled-lift detection, rule-based, no
  AI, stays $0/user.
- Fix the FifaCard 1RM vs PR-list mismatch. Two numbers for one lift reads as a
  bug and erodes trust in every other stat on the card.

## Phase 3 — Retention loop

Push notifications (streak at risk, rival just logged, weekly recap), an iOS
home-screen widget (streak + today + rank), and a shareable weekly review.
Notifications are the largest retention lever available and cost nothing per user.

## Phase 4 — The iOS moat: Apple Watch

See [`WATCH.md`](../WATCH.md) phase 2. A wrist logger with heart rate and
HealthKit write-back is the strongest "this is for serious lifters" signal on
iOS, and almost nothing in the competitive-social niche has one. Do it once the
fundamentals hold, not before.

## Phase 5 — Flywheel

Server-rendered share cards for PRs and rank (image generation at the edge, $0),
invites and referrals, duels. Pro sells **status**: exclusive leagues, badges,
deeper history. Never paywall logging, and never paywall a user's own data.

---

## Not doing

- **AI features.** Removed July 2026 and staying removed; they break the
  $0-per-user rule and were not what people paid for.
- **Android**, until iOS retention proves out.
- **A social feed.** Moderation cost a solo team cannot absorb.
- **Paywalling core logging.** Pro is status, not utility.

## The gap nobody notices

**Instrumentation.** There is no way to tell whether any of the above worked.
Minimum viable funnel: signup → first set logged → third workout → week-2 return.
Cloudflare Analytics plus a handful of Supabase queries — no paid vendor, no
per-user cost.

## Sequencing rule

Phase 0 before features, Phase 1 before growth. Trust compounds; features
bolted onto a leaky foundation do not.
