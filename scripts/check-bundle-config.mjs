/**
 * Fails the build when the compiled front-end points at the wrong backend.
 *
 * The Supabase URL is baked into the bundle at build time from VITE_SUPABASE_URL.
 * When the app moved Supabase projects, CI's copy of that secret kept the old
 * project ref — a build that compiles, passes tests, and deploys a front-end
 * talking to a backend the worker no longer uses. Nothing downstream catches
 * that, so it is checked here against deploy.config.json.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ASSETS_DIR = "dist/client/assets";
const expected = JSON.parse(readFileSync("deploy.config.json", "utf8"));
const ref = expected.supabaseProjectRef;

if (!existsSync(ASSETS_DIR)) {
  console.error(`FAIL ${ASSETS_DIR} is missing — run the build first.`);
  process.exit(1);
}

const bundles = readdirSync(ASSETS_DIR).filter((name) => name.endsWith(".js"));
const sources = bundles.map((name) => readFileSync(join(ASSETS_DIR, name), "utf8"));
const found = new Set();
for (const source of sources) {
  for (const match of source.matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/g)) {
    found.add(match[1]);
  }
}

if (found.size === 0) {
  console.error(
    "FAIL the bundle contains no Supabase URL at all — VITE_SUPABASE_URL was empty at build time,\n" +
      "     which ships an app that cannot sign anyone in.",
  );
  process.exit(1);
}

const unexpected = [...found].filter((candidate) => candidate !== ref);
if (unexpected.length > 0) {
  console.error(
    `FAIL bundle targets Supabase project(s) ${unexpected.join(", ")} but deploy.config.json expects ${ref}.\n` +
      "     The build environment's VITE_SUPABASE_URL is stale. Update it (GitHub repo secrets for CI,\n" +
      "     .env locally) or update deploy.config.json if the project genuinely changed.",
  );
  process.exit(1);
}

console.log(
  `Bundle config check passed: front-end targets ${ref} (${bundles.length} bundles scanned).`,
);
