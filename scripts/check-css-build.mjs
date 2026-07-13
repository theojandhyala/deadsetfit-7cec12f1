import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "dist", "client", "assets");
const minBytes = 75_000;
const minRuleBlocks = 1_000;

const cssFiles = readdirSync(assetsDir)
  .filter((file) => file.startsWith("styles-") && file.endsWith(".css"))
  .map((file) => join(assetsDir, file))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

if (cssFiles.length === 0) {
  console.error("CSS build check failed: no generated styles-*.css file found.");
  process.exit(1);
}

const cssFile = cssFiles[0];
const css = readFileSync(cssFile, "utf8");
const bytes = Buffer.byteLength(css, "utf8");
const ruleBlocks = (css.match(/{/g) || []).length;

if (bytes < minBytes || ruleBlocks < minRuleBlocks) {
  console.error(
    [
      "CSS build check failed: generated CSS is suspiciously small.",
      `File: ${cssFile}`,
      `Bytes: ${bytes} / minimum ${minBytes}`,
      `Rule blocks: ${ruleBlocks} / minimum ${minRuleBlocks}`,
      "This usually means Tailwind did not scan the app source and the UI would deploy unstyled.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`CSS build check passed: ${bytes} bytes, ${ruleBlocks} rule blocks.`);
