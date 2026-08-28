import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const tempConfig = join(root, ".wrangler.worker.tmp.jsonc");
const workerOnly = process.argv.includes("--worker-only");
const dryRun = process.argv.includes("--dry-run");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function verifyCustomDomain() {
  const expectedHtml = readFileSync(join(root, "dist/client/index.html"), "utf8");
  // Asset paths alone are not enough: a change confined to index.html (the boot
  // screen, meta tags, the watchdog) leaves every hashed asset name identical, so
  // the old check passed while the custom domain still served the previous HTML.
  // Comparing the document itself catches that.
  const expectedFingerprint = createHash("sha256").update(expectedHtml).digest("hex");
  const assetPaths = [...expectedHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
    (match) => match[1],
  );
  const entryPath = assetPaths.find((path) => /\/main-[^/]+\.js$/.test(path));
  if (!entryPath) throw new Error("Could not find the production entry asset");

  let lastIssue = "custom domain has not propagated";
  for (let attempt = 0; attempt < 18; attempt += 1) {
    try {
      const htmlResponse = await fetch(`https://deadsetfit.org/?deploy-check=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const liveHtml = await htmlResponse.text();
      const liveFingerprint = createHash("sha256").update(liveHtml).digest("hex");
      if (!htmlResponse.ok || !liveHtml.includes(entryPath)) {
        lastIssue = "custom-domain HTML is still on the previous release";
      } else if (liveFingerprint !== expectedFingerprint) {
        // Same assets, different document: an index.html-only change that has
        // not reached the custom domain yet.
        lastIssue = "custom-domain index.html does not match the build yet";
      } else {
        const checks = await Promise.all(
          assetPaths.map(async (path) => {
            const response = await fetch(`https://deadsetfit.org${path}`, {
              method: "HEAD",
              headers: { "Cache-Control": "no-cache" },
            });
            const type = response.headers.get("content-type") ?? "";
            const validType = path.endsWith(".js")
              ? type.includes("javascript")
              : path.endsWith(".css")
                ? type.includes("text/css")
                : true;
            return { path, ok: response.ok && validType, type };
          }),
        );
        const failed = checks.find((check) => !check.ok);
        if (!failed) {
          console.log(`Live asset verification passed: ${assetPaths.length} files`);
          return;
        }
        lastIssue = `${failed.path} returned ${failed.type || "no content type"}`;
      }
    } catch (error) {
      lastIssue = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Deployment did not become healthy: ${lastIssue}`);
}

try {
  run("npm", ["run", "build"]);

  const config = readFileSync(join(root, "wrangler.jsonc"), "utf8").replace(
    /\n\s*"pages_build_output_dir"\s*:\s*"[^"]+",?/,
    "",
  );
  writeFileSync(tempConfig, config);

  run("npx", [
    "wrangler",
    "deploy",
    "--config",
    tempConfig,
    ...(dryRun ? ["--dry-run"] : []),
  ]);
  if (!dryRun && !workerOnly) {
    run(
      "npx",
      [
        "wrangler",
        "pages",
        "deploy",
        join(root, "dist/client"),
        "--project-name",
        "deadsetfit",
        "--branch",
        "main",
        "--commit-dirty=true",
      ],
      { cwd: "/tmp" },
    );
    await verifyCustomDomain();
  }
} finally {
  rmSync(tempConfig, { force: true });
}
