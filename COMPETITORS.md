# Competitive teardown — Strong (a.k.a. "Stronger") vs DEADSET

## What this is, and what it isn't

This is a feature-level teardown of **Strong**, the incumbent iOS workout
logger, against DEADSET as it exists in this repo today.

**Source caveat, stated up front:** this was written from Strong's publicly
documented and widely known feature set, not from a live walkthrough of the
app on a phone. The session that produced it had no device access. Every
claim about **DEADSET** below was verified against this codebase; claims
about **Strong** should be spot-checked against the live app before anything
here is used for marketing copy or a competitive claim.

Where the two disagree, trust the code.

---

## 1. Where Strong actually wins

Strong has been shipping since 2015 and its moat is not features — it is that
the **logger never gets in your way**. The specific things it does better:

| Strong behaviour | Why it matters on the gym floor |
| --- | --- |
| Add / swap / remove / reorder exercises **mid-workout** | The rack is taken. The plan is now wrong. Strong lets you fix reality; a rigid logger makes you log the workout you planned instead of the one you did. |
| **Every** logged set stays editable | You mistype 100 for 10 on set 2 and notice on set 5. Undo-only means unwinding three good sets. |
| Set types beyond load × reps — duration, distance, bodyweight ± load | A plank, a farmer's carry and a row erg are all unloggable in a reps-only model. |
| Per-exercise rest timers, editable in the workout | Rest for a heavy triple is not rest for a lateral raise. |
| Per-exercise notes that persist across sessions | "Elbows tucked" is worth more next week than today. |
| Previous-session values pre-filled as ghost text | Removes nearly all typing. |
| Apple Watch app + Live Activity | Logging without taking your phone out. |
| Plate calculator, warm-up calculator, 1RM estimates | Small, constant, compounding conveniences. |

## 2. Where DEADSET already matched or beat it (verified in code)

These were already built before this session — worth knowing so they don't get
rebuilt:

- **Ghost sets** (`src/lib/progression.ts`) — last session's sets shown inline,
  struck through as you beat them. Strong shows previous values; DEADSET scores
  them.
- **Rule-based progression suggestions** (`suggestNextWeight`) with RPE
  feedback — Strong only added comparable coaching recently, behind Pro.
- **Warm-up ramp + plate breakdown + 1RM calculator** (`src/lib/calc.ts`).
- **Supersets** with correct round-robin rest (`src/lib/workout-flow.ts`).
- **Drop sets, warm-up sets, per-set RPE** — already excluded from volume/PRs
  correctly.
- **Everything competitive**: grit points, ranks, leagues, crews, duels,
  badges, seasons, share cards. Strong has no answer to any of this. This is
  the actual moat — the logger just has to stop being a reason to leave.

## 3. Gaps closed in this change

| Gap | What shipped |
| --- | --- |
| Locked exercise list mid-session | Add, swap, remove and reorder exercises during a live workout (`SessionExerciseSheet`). |
| Only the last set was correctable | Tap **any** logged set to edit its numbers or delete it (`SetEditorSheet`). |
| No time- or distance-based sets | New tracking model (`src/lib/set-tracking.ts`): holds get a stopwatch and a longest-hold record; conditioning logs distance and time. |
| Planks logged as "45 reps" | Time-based movements are detected from the prescription and the name, and no longer pollute rep history, tonnage, 1RM charts, heaviest-set achievements or the FIFA card's endurance stat. |
| Rest fixed by the plan | Per-exercise rest is now editable mid-workout and written back to the plan. |
| Cues were read-only | Notes can be written mid-session and persist to the plan for next time. |

**Beyond Strong:** the live session now carries a **"vs last <session>"** bar —
running tonnage against the same workout last time, with a live ahead/behind
delta. Strong shows you your last set; this tells you whether the session as a
whole is actually progressing. It costs nothing to run and fits the app's
competitive identity rather than fighting it.

## 4. Gaps still open, in priority order

1. **Apple Watch app.** The single biggest remaining reason a serious lifter
   picks Strong. `WATCH.md` scopes this. Large, native, and the highest-value
   item left.
2. **Live Activity / Dynamic Island** for the running session and rest timer.
   Medium effort, very visible, pairs with the watch work.
3. **Home-screen widget** — streak, today's workout, rank. Already in
   `BACKLOG.md` Tier 1.
4. **Push notifications** — streak-at-risk, rival activity. Listed as Tier 1
   and still the largest untapped retention lever.
5. **Routine folders.** Strong organises routines into folders; DEADSET has
   programmes but no grouping. Small.
6. **Per-exercise bar weight config.** The plate calculator assumes a standard
   bar; Strong lets you set it per exercise (safety squat bar, trap bar).
7. **CSV export surfacing.** `src/lib/export.ts` exists — Strong makes export a
   headline trust feature, and it should be visible in settings.

## 5. Strategic read

Do not try to beat Strong at being Strong. Its logger is ten years polished and
the remaining delta is mostly native-platform work (watch, widgets, Live
Activities), which is expensive.

The logger only needs to be good enough that it is never the reason someone
leaves — which, after this change, it broadly is. The competitive layer is
where DEADSET is not comparable but *categorically different*, and that is
where effort should go.

The one exception is the **Apple Watch app**. That is not polish; it is a hard
capability gap, and it is the one item on this list worth treating as a
roadmap-level commitment rather than a backlog item.
