#!/usr/bin/env node
/**
 * Render share cards and body diagrams to PNG, headless.
 *
 * Canvas and SVG output is the one part of this app that cannot be checked by
 * reading it. The strength card shipped with muscles floating beside the body,
 * a detached head and legs tapering to a point — none of which any amount of
 * re-reading the path data would have caught, and all of which were obvious in
 * one look at the rendered image.
 *
 *   node scripts/render-cards.mjs            # writes into .render-out/
 *   node scripts/render-cards.mjs --body     # just the body diagram, large
 *   node scripts/render-cards.mjs --diagram  # the <MuscleDiagram> that ships
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
const bodyOnly = process.argv.includes("--body");
const diagramOnly = process.argv.includes("--diagram");

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

const grade = (muscle, tier, score) => ({ muscle, tier, score, exercises: [], weakest: null });

const SAMPLE = {
  start: [
    grade("CHEST", "NOVICE", 25),
    grade("BACK", "BEGINNER", 10),
    grade("LEGS", "NOVICE", 22),
    grade("ARMS", "BEGINNER", 8),
  ],
  now: [
    grade("CHEST", "ADVANCED", 68),
    grade("BACK", "INTERMEDIATE", 52),
    grade("LEGS", "ELITE", 85),
    grade("SHOULDERS", "INTERMEDIATE", 48),
    grade("ARMS", "NOVICE", 30),
    grade("CORE", "WORLD CLASS", 96),
  ],
  tier: "ADVANCED",
  displayName: "Theo Jandhyala",
  sinceLabel: "Since Sep 2025",
};

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

if (diagramOnly) {
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
} else if (bodyOnly) {
  // Every muscle coloured differently, so a shape that is missing, misplaced
  // or overlapping another is impossible to miss.
  const shapes = await bundleModule("src/lib/body-shapes.ts", "Body");
  await page.addScriptTag({ content: shapes });
  const dataUrl = await page.evaluate(() => {
    const c = document.getElementById("c");
    const scale = 3;
    const { x, y, width, height } = Body.BODY_CONTENT;
    c.width = width * 2 * scale + 60;
    c.height = height * scale + 40;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, c.width, c.height);
    const palette = [
      "#e63222",
      "#5bd07a",
      "#fbbf24",
      "#7fb3d5",
      "#b06cf0",
      "#ff8a3d",
      "#4dd0e1",
      "#f06292",
      "#aed581",
      "#ffd54f",
    ];
    let index = 0;
    for (const side of ["f", "b"]) {
      ctx.save();
      ctx.translate(20 + (side === "b" ? width * scale + 20 : 0), 20);
      ctx.scale(scale, scale);
      ctx.translate(-x, -y);
      ctx.fillStyle = "#161616";
      ctx.strokeStyle = "#4a4a4a";
      ctx.lineWidth = 1.2;
      const outline = new Path2D(Body.bodySilhouette());
      ctx.fill(outline);
      ctx.stroke(outline);
      for (const [, shape] of Object.entries(Body.MUSCLE_SHAPES)) {
        const color = palette[index++ % palette.length];
        for (const d of shape[side] ?? []) {
          const path = new Path2D(d);
          ctx.fillStyle = color;
          ctx.fill(path);
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
          ctx.lineWidth = 0.5;
          ctx.stroke(path);
        }
      }
      ctx.restore();
    }
    return c.toDataURL("image/png");
  });
  const out = join(outDir, "body.png");
  writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", out);
} else {
  const card = await bundleModule("src/lib/strength-card-draw.ts", "Card");
  await page.addScriptTag({ content: card });
  const dataUrl = await page.evaluate((input) => {
    const c = document.getElementById("c");
    c.width = Card.STRENGTH_CARD_W;
    c.height = Card.STRENGTH_CARD_H;
    Card.drawStrengthCard(c.getContext("2d"), input);
    return c.toDataURL("image/png");
  }, SAMPLE);
  const out = join(outDir, "strength-card.png");
  writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("wrote", out);
}

await browser.close();
