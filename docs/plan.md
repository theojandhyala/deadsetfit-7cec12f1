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
   - _Backups, done 2026-07-29:_ the Free plan takes no automated backups and
     PITR is a paid add-on, so `npm run backup` writes a gzipped snapshot of
     auth users and every table (discovered from PostgREST, not hardcoded, so a
     new table cannot be silently skipped). `.github/workflows/backup.yml` runs
     it nightly into a private 90-day artifact once the
     `SUPABASE_SERVICE_ROLE_KEY` repo secret exists. Password hashes are not in
     the snapshot — accounts and data restore, passwords would need resetting.
     A restore has not been rehearsed; do that before trusting it.
   - _Confirmed 2026-07-30:_ a real password login works and returns the user's
     training history — the migration is verified end to end, not just
     structurally. The old project can now be retired, though keeping it
     read-only for a couple of weeks costs nothing and buys a fallback.
4. **In-app account deletion left data behind.** Surfaced by the migration: the
   old project held 10 `user_state` rows belonging to accounts deleted long ago.
   `deleteMyAccount` did attempt to clear every table, but Supabase returns
   `{ error }` instead of throwing, so its `try/catch` caught nothing and every
   failure was ignored — then the auth user was deleted regardless, orphaning
   personal data that nobody can find, let alone erase on request. Deleting a
   user's own posts also failed whenever someone else had liked or commented on
   them, since those rows hold a foreign key to the post.
   - _Done 2026-07-29:_ errors are now read off each result, likes and comments
     on the user's posts are removed first, `duels` was added to the sweep, and
     if anything fails the login is left intact and the user is told to retry
     (deletion is idempotent) rather than being silently half-deleted.
     `subscriptions` is deliberately retained — it is a billing record, and
     erasing it would hide a Stripe subscription that may still be charging.
5. **Serve the real Apple domain-association file.** `/.well-known/apple-developer-domain-association.txt`
   currently returns the SPA's HTML with a 200. Apple already accepted the
   Services ID, so this is not blocking today — it will fail a re-verification.

## Phase 1 — The two trust bets

**Never lose a set.** Offline-first logging with an outbox queue, plus the
`updated_at` conflict guard from BACKLOG Tier 0. Gyms are basements; sync dies
mid-set, and today two devices are last-write-wins. Ship the
photos-out-of-the-sync-blob fix alongside it — crossing the 2 MB blob cap
silently stops backing up _all_ training data for the most engaged users.

**Never trust a client-reported PR.** _Done 2026-07-30._ Two separate holes:

- _Direct writes_ were already closed before this pass: `saveProfile` refuses
  ranking columns and `guard_profile_privileged_columns` reverts any authenticated
  write to them. Verified against the live project — a `PATCH /profiles` with a
  real user token returns 204 and changes nothing.
- _Indirect_ was wide open. `saveUserState` derives grit and `public_stats` from
  the blob the client uploads, and that blob holds manually entered PRs — so
  nobody could post a grit number, but anyone could type a 600 kg squat and the
  server would faithfully rank it. Confirmed by doing it through the live API.

`src/lib/leaderboard-integrity.ts` now judges derived stats before they rank:
per-lift ceilings (raw world records plus margin), bodyweight multiples, PR growth
per sync, grit growth for established accounts, grit against **account age** (a
day-old account cannot hold a year of training), and streak against days actually
logged. Failing entries are stored and shown to their owner but excluded from
ranked tables — never deleted, and nobody is accused of anything.

Two false positives were found only by testing against the live API, not by unit
tests: 30 honest sessions compute to ~450 grit and tripped the growth rule on a
first sync, and `public_stats` defaults to `{}` rather than null, so every new
account looked "established". Both fixed and pinned by tests.

_Remaining:_ a verified tier (gym-verified or video-verified lifts) if the
leaderboard ever carries prizes.

## Phase 2 — Best-in-class on the gym floor

Where "best app on the market" is actually won, and it is cheap:

- Wire up `RestTimer` — built, never mounted. Auto-start, haptics, sound.
- Logger depth: supersets, drop sets, warm-up ramps, per-set RPE/RIR, plate math,
  last-time values inline, one-tap "repeat last workout".
- Per-exercise history and PR timeline graphs.
- Deterministic progression and deload: stalled-lift detection, rule-based, no
  AI, stays $0/user.
- ~~Fix the FifaCard 1RM vs PR-list mismatch.~~ _Done 2026-07-30._ Not a maths
  bug: the card showed an Epley-estimated 1RM (100kg x 5 → 117) while the PR list
  showed the raw entry, so one lift read as two numbers with no explanation. The
  value stays a comparable 1RM — that is what the leaderboard ranks on — and
  headline PRs now carry an `estimated` flag so the tile prefixes "≈" when the
  number came from a formula rather than a measured single.

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
