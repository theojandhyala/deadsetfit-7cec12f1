# DEADSET 1.3 — panoramic App Store screenshots

Prepared 10 September 2026 for version 1.3, build 163.

## Deliverables

Output folder: `artifacts/app-store/panorama-1.3/`.

Six screenshots form three continuous two-page compositions. Each page has its own complete
headline and real app screen; red light trails, orbital rings and a central diamond continue
across each pair. Existing DEADSET artwork, black/red palette and condensed italic typography
are preserved. No AI-generated interface, customer data, fabricated testimonials or user-count
claims are included.

| Order | File | Headline | Pair |
| --- | --- | --- | --- |
| 1 | `01-strength.png` | Every muscle. Made visible. | Strength Map + roadmap |
| 2 | `02-roadmap.png` | Your next rank. Within sight. | Strength Map + roadmap |
| 3 | `03-plan.png` | Build your week. Own your plan. | Plan + workout logger |
| 4 | `04-logger.png` | Every set. Nothing lost. | Plan + workout logger |
| 5 | `05-compare.png` | Then vs now. See the change. | Comparison + records |
| 6 | `06-records.png` | Your records. The whole story. | Comparison + records |

- `ios-6.9/`: 1320 × 2868, RGB PNG, no alpha.
- `ios-6.5/`: 1242 × 2688, RGB PNG, no alpha.
- `pair-1.png` through `pair-3.png`: complete 2640 × 2868 spreads.
- `contact-sheet.png`: all three spreads together.
- `manifest.json`: exact display order, raw-screen provenance and dimensions.
- `raw/`: captures of actual app components using fictional local demonstration state.

## Provenance and regeneration

The raw screens came from the actual Strength, Plan, Live Workout and Performance Lab components.
The isolated browser fixture used a fictional athlete, local sessions and a locally mocked paid
membership hook; nothing was written to customer accounts. The date was held at 10 September 2026.
Device framing, promotional text and the continuous background are rendered separately in HTML/CSS;
the screenshots themselves are not generatively edited.

Run `node scripts/generate-app-store-panorama.mjs` with Playwright and Sharp available. If
Playwright is outside the project, set `DEADSET_PLAYWRIGHT_MODULE` to its absolute module path.
The renderer loads Oswald/Inter from Google Fonts, waits for fonts and rejects headline overflow.
Keep the raw captures and `public/brand/deadset-lockup.png` available when regenerating.

All three spreads were visually reviewed. New app comparison interactions were checked at
320/375/393/430px with no document or sheet horizontal overflow and no captured runtime errors.
The full release check passed 778 tests; the signed native Debug build succeeded.

## App Store Connect status — not uploaded yet

App: DEADSET: Gym Workout Tracker, Apple ID 6783511541, English (U.K.).

- Live version 1.2 remains Ready for Distribution and unchanged.
- Version 1.3 was created and remains Prepare for Submission.
- Its inherited six 6.5-inch images are still the old set. Its 6.9-inch set remains empty.
- New PNG uploads failed before transfer because Chrome's extension lacked file-URL access.
- A native macOS file-picker fallback also did not complete. No images were deleted.
- No new App Store build was selected or submitted in this work.

To unblock browser uploads, the user must enable **Allow access to file URLs** under the ChatGPT
browser extension's Details at `chrome://extensions`. Do not change that permission on the user's
behalf. See [official upload help](https://developers.openai.com/codex/app/chrome-extension#upload-files).

After access is enabled, upload the six ordered 6.9-inch files, replace the draft's inherited
6.5-inch set with confirmation, and verify each image, ordering and saved state in Media Manager.
Before review, select the matching 1.3 build and complete the release metadata/readiness checks.
This document does not claim App Store publication, review acceptance or physical-device installation.

## Follow-up — 12 September 2026

The App Store Connect session has expired. Reloading recovered the Apple Account sign-in form;
the user was asked to sign in and confirm extension file-URL access. Upload has not resumed,
and the current remote draft contents have not been reverified behind the signed-out session.

Build 1.3 (163) was installed successfully on Theo's connected iPhone 16 Pro using `devicectl`.
The subsequent launch request was denied because the phone was locked. This confirms installation,
not successful on-device runtime verification or an App Store/TestFlight release.
