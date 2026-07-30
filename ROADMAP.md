# DEADSET Roadmap

## v1.0 — App Store submission (current build)

Clean, compliant build. Free app; DEADSET Pro sold on the web only
(deadsetfit.org), fully gated off native iOS per App Store Guideline 3.1.1.
No in-app purchase UI, no external purchase links, no prices shown on iPhone.
This is intentional — it's the lowest-risk path through App Store review.
**Do not add in-app checkout or external purchase links to this build.**

## v1.1 — External purchase link (first update, AFTER v1.0 is approved)

Add a Safari link-out to web checkout (the "Spotify" model), so iPhone users
can reach DEADSET Pro directly.

- Apply for Apple's **StoreKit External Purchase Link Entitlement**
  (`com.apple.developer.storekit.external-purchase-link`).
- Region reality (as of Jul 2026): US allows external purchase links
  commission-free post the Apr 2025 Epic v. Apple ruling; EU via DMA
  entitlement (with fee); UK/rest-of-world via Apple's global entitlement,
  granted case-by-case. Follow Apple's required link/notice presentation
  exactly — mis-presentation is the main rejection cause.
- Why after launch, not before: submitting the entitlement as an established,
  already-approved app is far lower risk than gambling the first submission on
  it. If v1.1 is bounced, the live v1.0 app is unaffected.
- Checkout backend is already 100% ready (embedded + hosted Stripe on the
  dedicated deadset account) — v1.1 is only the iOS link-out + entitlement.

## Future / parked (see project memory)

- Apple In-App Purchase (StoreKit) at 15% Small Business Program rate — the
  one-tap in-app buy path; bigger build, evaluate once web demand is proven.
- Server-authoritative leaderboard stats (grit_points/public_stats currently
  client-writable).
- Two-device sync conflict handling (updated_at guard).
- Split progress photos out of the 2 MB sync blob.
