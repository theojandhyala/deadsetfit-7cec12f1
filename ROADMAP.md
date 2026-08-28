# DEADSET Roadmap

## v1.1 — Paid membership conversion (current build)

The full post-onboarding app requires an active membership. New eligible
subscribers receive seven days free, then one monthly membership at £5.99 in
the UK (or Apple's localized price). Native iOS checkout is StoreKit-only and
reads the real introductory offer and eligibility before advertising a trial.
Restore, manage subscription, logout and permanent account deletion remain
reachable without an entitlement. No external purchase link is shown on iOS.

## Future / parked (see project memory)

- Server-authoritative leaderboard stats (grit_points/public_stats currently
  client-writable).
- Two-device sync conflict handling (updated_at guard).
- Split progress photos out of the 2 MB sync blob.
