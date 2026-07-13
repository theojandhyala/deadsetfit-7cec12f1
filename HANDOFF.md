# HANDOFF — AI feature removal

Branch: `remove-ai-features` (branched off `dd875cf`)
Status: **uncommitted working-tree changes only. Nothing committed.**

## Read this first

The working tree contains **two sets of changes mixed together**:

1. **Yours** — uncommitted auth work that was already in the tree before any of this started (auth, styles, challenges, friends, onboarding, etc).
2. **The AI removal** — everything described below.

**Do NOT run `git restore .`, `git checkout .`, or `git reset --hard`.** That wipes your auth work too.

Before doing anything else, checkpoint so nothing can be lost:

```bash
git add -A && git commit -m "checkpoint: auth WIP + AI feature removal"
```

Then review with `git diff dd875cf`.

## Why

Every AI feature called the Anthropic API with the owner's key, server-side. Free users generated cost on every call, with no revenue behind it — an unbounded bill. The AI was also broken in production (no `ANTHROPIC_API_KEY` set as a Worker secret, so every call threw). Decision: remove all AI, keep the app free to run.

## What was removed

**Server (`api/rpc.ts`, 1095 → 880 lines).** Ten handlers deleted:
`generateSchedule`, `generateMeals`, `swapMeal`, `scorePump`, `coachChat`, `analyzePhysique`, `generateExerciseBatch`, `smartSuggest`, `analyzeFoodPhoto`, `weeklyNutritionReport`.

`lookupBarcode` was **kept** — it uses OpenFoodFacts, not AI.

**Files deleted:**

```
src/routes/coach.tsx
src/components/AIToolbox.tsx
src/components/PaywallSheet.tsx        <-- CHECK THIS (see below)
src/hooks/useAiUsageGate.ts
src/lib/ai-gateway.server.ts
src/lib/ai.functions.ts
src/lib/coach.functions.ts
src/lib/physique.functions.ts
src/lib/programs.functions.ts
src/lib/session.functions.ts
```

**Per screen:**

- **Train** — AI split generation gone. Empty state is now "Build My Split", which seeds a rule-based starter week from the profile (`defaultSchedule`, already existed) and opens the manual builder.
- **Diet** — meal generation, meal swap, food-photo scan, weekly nutrition report all gone. Barcode lookup and manual logging kept.
- **Progress** — entire physique scanner gone (photo upload, body-fat estimate, muscle ranks, verdict, ~500 lines of rank helpers). Charts, PRs, weight, measurements, check-in photos untouched.
- **Programs builder** — `smartSuggest` gaps modal gone. Manual editing intact.
- **Library** — admin AI exercise generator gone.
- **Workout live** — `scorePump` gone. Finish flow is synchronous. Summary shows Exercises / Duration / Planned sets / PRs. **No fabricated score.**
- **Guide, Reminders, ShareCard, Privacy** — copy updated to drop AI references.

## Pro repositioning

Pro was sold on AI (3 of its 8 feature rows). It's now sold on features that cost nothing to serve:

**Streak Armor · Head-to-Head Challenges · Full Weekly Leagues · Advanced Analytics · Featured Programs · Custom Program Builder**

Rewritten: `upgrade.tsx`, `ProBanner.tsx`, `Landing.tsx`, `_tabs.profile.tsx`.

## Two things to verify yourself

1. **`src/components/PaywallSheet.tsx` + `src/hooks/useAiUsageGate.ts` were deleted.** The reasoning: the paywall sheet was only ever opened by the AI usage gate, so with AI gone it was unreachable. Probably correct — but a paywall component vanishing inside an "AI removal" deserves a human eye. If you still want a paywall on any *non-AI* Pro feature, restore `PaywallSheet.tsx` and wire it to a new gate.

2. **`src/routes/api/public/payments/webhook.ts` shows as deleted.** Believed to be pre-existing — part of your migration to handling the Stripe webhook in the Cloudflare worker (`handleStripeWebhook` is there). **Confirm this. If it wasn't you, that's your payments.**

## Still to do

- `src/cloudflare-worker.ts` still declares and forwards `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AI_PROVIDER`, and `/api/health` still reports `services.ai / anthropic / gemini`. Dead config — purge it.
- `.env.example` still documents the same three keys.
- Delete the `ANTHROPIC_API_KEY` secret from the Cloudflare Worker once confirmed unused.
- `src/routeTree.gen.ts` was hand-edited (the sandbox couldn't run the router plugin). Regenerate on the host with `npm run dev` or a build.
- Legacy user state may still carry `physiqueScans`, `mealPlan`, `pumpScore` keys. Ignored and harmless, but check nothing server-side validates the `user_state` blob strictly.

## Verification status

- `npx tsc --noEmit` — **clean**
- `npx eslint .` — **clean**
- `npm run build` — **NOT RUN.** Failed in the Linux sandbox because `node_modules` holds the macOS rollup binary. **Run `npm run check` on your machine.**
