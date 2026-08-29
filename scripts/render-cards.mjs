#!/usr/bin/env node
/**
 * Render the app's canvas and SVG output to PNG, headless.
 *
 * These are the one part of the app that cannot be checked by reading them. A
 * body diagram once shipped with muscles floating beside the figure, a
 * detached head and legs tapering to a point — none of which any amount of
 * re-reading the path data would have caught, and all of which were obvious in
 * one look at the rendered image.
 *
 *   node scripts/render-cards.mjs --diagram  # the <MuscleDiagram> that ships
 *   node scripts/render-cards.mjs --pr       # the PR card people post
 *   node scripts/render-cards.mjs --photo    # the before/after card
 *   node scripts/render-cards.mjs --banner   # the Pro upgrade banner
 *
 * Not part of `npm run check`, and playwright/esbuild are deliberately NOT
 * dependencies: Xcode Cloud runs `npm ci` before every iOS archive, and making
 * it download a browser to build an app would cost minutes on every build for
 * a tool only used when drawing code changes. Install them when you need to
 * look at something:
 *
 *   npm i --no-save playwright esbuild
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".render-out");
const diagramOnly = process.argv.includes("--diagram");
const prOnly = process.argv.includes("--pr");
const photoOnly = process.argv.includes("--photo");
const bannerOnly = process.argv.includes("--banner");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "playwright and esbuild are intentionally not dependencies — they would\n" +
      "add a browser download to every iOS build. Install them on demand:\n\n" +
      "  npm i --no-save playwright esbuild\n",
  );
  process.exit(1);
}

/** Chromium ships in this image at a fixed path; fall back to Playwright's own. */
const EXECUTABLE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

async function bundleModule(entry, globalName) {
  const result = await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    format: "iife",
    globalName,
    write: false,
    platform: "browser",
    alias: { "@": join(root, "src") },
  });
  return result.outputFiles[0].text;
}

mkdirSync(outDir, { recursive: true });

const launchOptions = {};
try {
  const { existsSync } = await import("node:fs");
  if (existsSync(EXECUTABLE)) launchOptions.executablePath = EXECUTABLE;
} catch {
  // Fall through to Playwright's bundled browser.
}

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();
await page.setContent("<canvas id=c></canvas>");

if (bannerOnly) {
  // Renders against the real built stylesheet, so what is screenshotted is
  // what ships rather than a hand-written approximation of it.
  const { readdirSync, readFileSync } = await import("node:fs");
  const assets = join(root, "dist/client/assets");
  const cssFile = readdirSync(assets).find((name) => name.endsWith(".css"));
  if (!cssFile) {
    console.error("Run `npm run build` first — this renders the built stylesheet.");
    process.exit(1);
  }
  const mod = await bundleModule("scripts/banner-entry.tsx", "Banner");
  await page.addStyleTag({ content: readFileSync(join(assets, cssFile), "utf8") });
  await page.addScriptTag({ content: mod });
  await page.setViewportSize({ width: 460, height: 700 });
  await page.evaluate(() => {
    document.body.style.cssText = "background:#0a0a0a;margin:0";
    document.getElementById("c")?.remove();
    Banner.mount(document.body);
  });
  await page.waitForTimeout(900);
  const out = join(outDir, "pro-banner.png");
  await page.screenshot({ path: out, fullPage: true });
  console.log("wrote", out);
} else if (photoOnly) {
  const card = await bundleModule("src/lib/photo-card-draw.ts", "PhotoCard");
  await page.addScriptTag({ content: card });
  const dataUrl = await page.evaluate(async () => {
    // Two stand-in bodies, so the crop and the frames can be judged without a
    // real check-in photo in the repo.
    const body = (hue, scale) =>
      "data:image/svg+xml;base64," +
      btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600">` +
          `<rect width="900" height="1600" fill="hsl(${hue} 18% 16%)"/>` +
          `<g transform="translate(450 820) scale(${scale}) translate(-450 -820)">` +
          `<ellipse cx="450" cy="330" rx="95" ry="115" fill="hsl(${hue} 22% 34%)"/>` +
          `<rect x="300" y="450" width="300" height="470" rx="90" fill="hsl(${hue} 22% 34%)"/>` +
          `<rect x="330" y="900" width="110" height="480" rx="55" fill="hsl(${hue} 22% 30%)"/>` +
          `<rect x="460" y="900" width="110" height="480" rx="55" fill="hsl(${hue} 22% 30%)"/>` +
          `</g></svg>`,
      );
    const load = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    const [before, now] = await Promise.all([load(body(220, 0.86)), load(body(8, 1))]);
    const c = document.getElementById("c");
    c.width = PhotoCard.PHOTO_CARD_W;
    c.height = PhotoCard.PHOTO_CARD_H;
    PhotoCard.drawPhotoCard(c.getContext("2d"), {
      before,
      now,
      beforeDate: "2026-01-04T00:00:00Z",
      nowDate: "2026-08-28T00:00:00Z",
      daysApart: 236,
      weightDeltaKg: 6.4,
      unit: "kg",
      displayName: "Theo",
    });
    return c.toDataURL("image/png");
  });
  const out = join(outDir, "photo-card.png");
  writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", out);
} else if (prOnly) {
  const card = await bundleModule("src/lib/pr-card-draw.ts", "PRCard");
  await page.addScriptTag({ content: card });
  const dataUrl = await page.evaluate(() => {
    const c = document.getElementById("c");
    c.width = PRCard.PR_CARD_W;
    c.height = PRCard.PR_CARD_H;
    PRCard.drawPRCard(c.getContext("2d"), {
      pr: { exercise: "Incline Dumbbell Press", weight: 18, reps: 8, previousBest: 16 },
      displayName: "Theo",
      username: "theo",
      unit: "kg",
      date: new Date("2026-08-27T00:00:00Z"),
    });
    return c.toDataURL("image/png");
  });
  const out = join(outDir, "pr-card.png");
  writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", out);
} else if (diagramOnly) {
  // The component the app actually renders, at the size the strength screen
  // asks for and at the size a phone shows it. If it looks cheap here, it
  // looks cheap on the phone.
  const mod = await bundleModule("scripts/diagram-entry.tsx", "Diagram");
  await page.addScriptTag({ content: mod });
  await page.setViewportSize({ width: 900, height: 1400 });
  await page.evaluate(() => {
    document.body.style.background = "#0a0a0a";
    document.body.style.margin = "0";
    document.getElementById("c")?.remove();
    Diagram.mount(document.body);
  });
  const out = join(outDir, "diagram.png");
  await page.screenshot({ path: out, fullPage: true });
  console.log("wrote", out);
} else if (prOnly) {
  const card = await bundleModule("src/lib/pr-card-draw.ts", "PRCard");
  await page.addScriptTag({ content: card });
  const dataUrl = await page.evaluate(() => {
    const c = document.getElementById("c");
    c.width = PRCard.PR_CARD_W;
    c.height = PRCard.PR_CARD_H;
    PRCard.drawPRCard(c.getContext("2d"), {
      pr: { exercise: "Incline Dumbbell Press", weight: 18, reps: 8, previousBest: 16 },
      displayName: "Theo",
      username: "theo",
      unit: "kg",
      date: new Date("2026-08-27T00:00:00Z"),
    });
    return c.toDataURL("image/png");
  });
  const out = join(outDir, "pr-card.png");
  writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", out);
}

await browser.close();
