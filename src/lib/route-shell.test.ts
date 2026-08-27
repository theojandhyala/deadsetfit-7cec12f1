import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Screen-level consistency, enforced rather than remembered.
 *
 * `.deadset-page` is not decoration: it carries the entry animation, the
 * 780px max width that keeps a screen from sprawling on a large device, the
 * shared corner radius, and — the one that matters most — a 44px minimum on
 * buttons, which is Apple's minimum tap target.
 *
 * Eight of fourteen screens had drifted off it, which is exactly why this is a
 * test and not a convention. A screen missing it looks like a different app
 * and is harder to tap.
 */
// Deliberately lives outside src/routes: a .test.ts file in there is picked
// up by the TanStack router plugin as a route and pollutes the route tree.
const routesDir = join(process.cwd(), "src/routes");
const tabScreens = readdirSync(routesDir).filter(
  (name) => name.startsWith("_tabs.") && name.endsWith(".tsx") && name !== "_tabs.tsx",
);

describe("tab screens", () => {
  it("finds the screens to check", () => {
    expect(tabScreens.length).toBeGreaterThan(5);
  });

  it.each(tabScreens)("%s uses the shared page shell", (name) => {
    const source = readFileSync(join(routesDir, name), "utf8");
    expect(source).toContain("deadset-page");
  });
});
