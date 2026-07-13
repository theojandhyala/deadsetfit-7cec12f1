import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const tempConfig = join(root, ".wrangler.worker.tmp.jsonc");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

try {
  run("npm", ["run", "build"]);

  const config = readFileSync(join(root, "wrangler.jsonc"), "utf8").replace(
    /\n\s*"pages_build_output_dir"\s*:\s*"[^"]+",?/,
    "",
  );
  writeFileSync(tempConfig, config);

  run("npx", ["wrangler", "deploy", "--config", tempConfig]);
  run("npx", [
    "wrangler",
    "pages",
    "deploy",
    join(root, "dist/client"),
    "--project-name",
    "deadsetfit",
    "--branch",
    "main",
    "--commit-dirty=true",
  ], { cwd: "/tmp" });
} finally {
  rmSync(tempConfig, { force: true });
}
