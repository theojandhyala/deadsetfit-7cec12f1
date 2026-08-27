# What to hand to a scheduled assistant, and what not to

## The honest split

A coding agent in this repo and a scheduled ChatGPT task are not competing at
the same job, and pretending otherwise wastes both.

**A coding agent here** has the repo, can run `npm run check`, can see that
`fifa-stats.ts` already had a comment about mis-logged holds, and can push a
branch. It runs when you ask.

**A scheduled assistant** has none of that context, but it runs _without being
asked_, every day, against the live web. That is the only real advantage, and
it is a big one for exactly one category of work: **things that change while
you are not looking.**

So the split is not "which is smarter". It is: does the task need the codebase,
or does it need to happen on a schedule against the outside world?

## Worth automating

Each of these is recurring, outward-facing, and needs no repo access.

**1. App Store review watch — daily.**
New DEADSET reviews, grouped by theme, with a flag on any 1–2 star cluster or
any review mentioning crashes, sync, or lost data. Reviews are where data-loss
bugs surface first, and they surface days before you would notice otherwise.

**2. Competitor release tracking — weekly.**
Strong, Hevy, Boostcamp, Fitbod release notes. Fitness loggers ship visible
feature changes; knowing Strong shipped something the week it happens is worth
more than finding out in a review that says "Strong has this".

**3. ASO keyword refresh — monthly.**
Title, subtitle and keyword field against what is actually ranking. This is
iterative, data-driven, and genuinely better with live search data than with
a model's memory.

**4. Review-reply drafts — daily, alongside (1).**
Draft replies for the reviews that deserve one. You approve and post; nothing
is published automatically.

**5. Short-form content from real data — weekly.**
The repo already has share cards (`PRShareCard`, `WeeklyRecapCard`,
`StoryShareCard`) and a `tiktok_swipe/` directory. A weekly task turning the
week's actual PR and streak moments into hooks is real leverage — the content
is generated from things that really happened, not invented.

## Not worth automating

**Anything touching App Store compliance.** `ROADMAP.md` and `BACKLOG.md`
document a deliberate, high-stakes position on Guideline 3.1.1 — free app, Pro
on the web only, no in-app purchase UI or prices on iOS. A scheduled assistant
without that context will confidently suggest adding a purchase button. That
suggestion, acted on, costs a rejection.

**Code changes.** No repo, no `npm run check`, no `check-xcodeproj`. A patch
that cannot be validated is a liability, not a contribution.

**Anything about the data model.** The reason a plank stopped poisoning rep
history is that timed sets store `reps: 0`, so thirteen existing volume
calculations contribute nothing for them without knowing they exist. That is
not reconstructable from a description of the feature.

---

# The brief

The full, self-contained briefing document lives in **`docs/AGENT-BRIEF.md`**.
Paste that whole file — it carries the constraints, the non-obvious
architecture facts, what already exists, the verification bar, and the
prioritised work list including a complete design for real-time rival push.

The constraints section is the part that matters. Every rule in it exists
because breaking it costs a rejection or an unbounded bill, and none of them
are reconstructable from a feature request.
