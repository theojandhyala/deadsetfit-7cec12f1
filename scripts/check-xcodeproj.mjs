#!/usr/bin/env node
/**
 * Structural check for the Xcode project file.
 *
 * `project.pbxproj` is edited by hand here — Xcode is not available in CI or in
 * the environments this repo is often worked on — and a malformed one fails
 * late, loudly and confusingly (Xcode says only "cannot be opened because the
 * project file cannot be parsed"). These checks catch the mistakes hand-editing
 * actually makes: an unbalanced brace, an id referenced but never defined, an
 * object never reached from any target, and a file reference pointing at
 * something that is not on disk.
 *
 * It is not a substitute for opening the project — it is the thing that makes
 * opening it the second failure, not the first.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectPath = join(root, "ios/App/DeadSet.xcodeproj/project.pbxproj");
const projectDir = join(root, "ios/App");

const src = readFileSync(projectPath, "utf8");
const failures = [];
const fail = (message) => failures.push(message);

// --- balance ---------------------------------------------------------------
// Count only outside comments and quoted strings, or every "/* ... }" comment
// throws the tally off.
function balance(text) {
  let braces = 0;
  let parens = 0;
  let inComment = false;
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (inComment) {
      if (c === "*" && next === "/") {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      if (c === "\\") i += 1;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === "/" && next === "*") {
      inComment = true;
      i += 1;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") braces += 1;
    if (c === "}") braces -= 1;
    if (c === "(") parens += 1;
    if (c === ")") parens -= 1;
    if (braces < 0) return { braces, parens, error: `unbalanced '}' at offset ${i}` };
    if (parens < 0) return { braces, parens, error: `unbalanced ')' at offset ${i}` };
  }
  return { braces, parens };
}

const balanced = balance(src);
if (balanced.error) fail(balanced.error);
if (balanced.braces !== 0) fail(`brace mismatch: ${balanced.braces} unclosed`);
if (balanced.parens !== 0) fail(`paren mismatch: ${balanced.parens} unclosed`);

// --- ids -------------------------------------------------------------------
const ID = "[A-F0-9]{24}";
const defined = new Map();
for (const match of src.matchAll(
  new RegExp(`^\\t\\t(${ID}) (?:\\/\\* (.*?) \\*\\/ )?= \\{`, "gm"),
)) {
  if (defined.has(match[1])) fail(`duplicate object id ${match[1]}`);
  defined.set(match[1], match[2] ?? "");
}
if (defined.size === 0) fail("no objects parsed — the format is not what this check expects");

const referenced = new Set();
for (const match of src.matchAll(new RegExp(ID, "g"))) referenced.add(match[0]);
for (const id of referenced) {
  if (!defined.has(id)) fail(`id ${id} is referenced but never defined`);
}

// Every object should be reachable from something other than its own definition.
for (const [id, name] of defined) {
  const uses = [...src.matchAll(new RegExp(id, "g"))].length;
  if (uses < 2) fail(`object ${id} (${name || "unnamed"}) is defined but never referenced`);
}

// --- targets ---------------------------------------------------------------
const targets = [
  ...src.matchAll(
    new RegExp(`^\\t\\t(${ID}) \\/\\* (.+?) \\*\\/ = \\{\\n\\t\\t\\tisa = PBXNativeTarget;`, "gm"),
  ),
];
const targetNames = targets.map((m) => m[2]);
for (const expected of ["DeadSet", "DeadSetRestActivity", "DeadSetWatch"]) {
  if (!targetNames.includes(expected)) fail(`expected target "${expected}" is missing`);
}

const projectTargets = /targets = \(\n([\s\S]*?)\n\t\t\t\);/.exec(src);
if (!projectTargets) fail("PBXProject has no targets list");
else {
  for (const [id, name] of targets.map((m) => [m[1], m[2]])) {
    if (!projectTargets[1].includes(id)) fail(`target "${name}" is not registered on the project`);
  }
}

// Each native target needs a build configuration list that exists.
for (const [, id, name] of targets.map((m) => [m[0], m[1], m[2]])) {
  const block = new RegExp(`${id} \\/\\* ${name} \\*\\/ = \\{[\\s\\S]*?\\n\\t\\t\\};`).exec(src);
  if (!block) {
    fail(`could not read target block for "${name}"`);
    continue;
  }
  const list = new RegExp(`buildConfigurationList = (${ID})`).exec(block[0]);
  if (!list) fail(`target "${name}" has no buildConfigurationList`);
  else if (!defined.has(list[1])) fail(`target "${name}" points at a missing configuration list`);
  for (const phase of block[0].matchAll(new RegExp(`\\t\\t\\t\\t(${ID}) \\/\\*`, "g"))) {
    if (!defined.has(phase[1])) fail(`target "${name}" references missing object ${phase[1]}`);
  }
}

// --- file references exist on disk ----------------------------------------
// Group paths compose, so resolve each reference through its parent groups.
const groups = new Map();
for (const match of src.matchAll(
  new RegExp(
    `^\\t\\t(${ID}) (?:\\/\\* .*? \\*\\/ )?= \\{\\n\\t\\t\\tisa = PBXGroup;\\n([\\s\\S]*?)\\n\\t\\t\\};`,
    "gm",
  ),
)) {
  const body = match[2];
  const path = /\n\t\t\tpath = "?([^";\n]+)"?;/.exec(body);
  const children = [...body.matchAll(new RegExp(`\\t\\t\\t\\t(${ID})`, "g"))].map((c) => c[1]);
  groups.set(match[1], { path: path ? path[1] : null, children });
}

// Variant groups (localised storyboards) sit between a file and its real
// group, and carry no path of their own.
const variantGroups = new Map();
for (const match of src.matchAll(
  new RegExp(
    `^\\t\\t(${ID}) (?:\\/\\* .*? \\*\\/ )?= \\{\\n\\t\\t\\tisa = PBXVariantGroup;\\n([\\s\\S]*?)\\n\\t\\t\\};`,
    "gm",
  ),
)) {
  variantGroups.set(match[1], {
    path: null,
    children: [...match[2].matchAll(new RegExp(`\\t\\t\\t\\t(${ID})`, "g"))].map((c) => c[1]),
  });
}

const parentOf = new Map();
for (const [id, group] of [...groups, ...variantGroups]) {
  for (const child of group.children) parentOf.set(child, id);
}

function groupPrefix(id) {
  const segments = [];
  let cursor = parentOf.get(id);
  while (cursor) {
    const group = groups.get(cursor) ?? variantGroups.get(cursor);
    if (group?.path) segments.unshift(group.path);
    cursor = parentOf.get(cursor);
  }
  return segments;
}

/**
 * Capacitor generates `public/`, `config.xml` and `capacitor.config.json` into
 * the iOS project on `cap sync`, and they are gitignored. They are legitimately
 * absent in a fresh checkout, so a missing path that git deliberately ignores
 * is not a broken reference.
 */
function isGenerated(relativePath) {
  try {
    execFileSync("git", ["check-ignore", "-q", relativePath], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

for (const match of src.matchAll(
  new RegExp(`^\\t\\t(${ID}) \\/\\* .*? \\*\\/ = \\{isa = PBXFileReference;(.*)\\};$`, "gm"),
)) {
  const [, id, body] = match;
  // Build products do not exist until a build runs.
  if (body.includes("sourceTree = BUILT_PRODUCTS_DIR")) continue;
  if (body.includes("sourceTree = DEVELOPER_DIR")) continue;
  if (body.includes("sourceTree = SOURCE_ROOT")) continue;
  const path = /path = "?([^";]+)"?;/.exec(body);
  if (!path) continue;
  const full = join(projectDir, ...groupPrefix(id), path[1]);
  if (existsSync(full)) continue;
  if (isGenerated(full)) continue;
  fail(`file reference points at a missing path: ${path[1]} (looked in ${full})`);
}

// --- report ----------------------------------------------------------------
if (failures.length > 0) {
  console.error("Xcode project check FAILED:\n");
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(
  `Xcode project check passed: ${defined.size} objects, targets: ${targetNames.join(", ")}.`,
);
