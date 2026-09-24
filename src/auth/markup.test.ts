import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const markup = readFileSync(new URL("../../auth/index.html", import.meta.url), "utf8");
const controller = readFileSync(new URL("./plain.ts", import.meta.url), "utf8");

describe("standalone authentication page contract", () => {
  it("provides every controller-bound element exactly once", () => {
    const boundIds = [...controller.matchAll(/document\.getElementById\("([^"]+)"\)/g)].map(
      (match) => match[1],
    );
    expect(boundIds.length).toBeGreaterThan(25);
    for (const id of boundIds) {
      expect(
        markup.match(new RegExp(`\\bid="${id}"`, "g")),
        `Missing or duplicate #${id}`,
      ).toHaveLength(1);
    }
  });

  it("supports one-time-code autofill without requiring a code before recovery", () => {
    const code = markup.match(/<input\s+id="recovery-code"[\s\S]*?\/>/)?.[0];
    expect(code).toContain('autocomplete="one-time-code"');
    expect(code).toContain('pattern="[0-9]{8}"');
    expect(code).not.toMatch(/\brequired\b/);
    expect(markup).toContain('id="recovery-code-field" hidden');
    expect(markup).toContain('id="recovery-resend" type="button"');
  });
});
