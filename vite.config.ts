import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        // @ts-expect-error preset is valid at runtime but missing from current type defs
        preset: "cloudflare-pages",
      },
    }),
    tsConfigPaths(),
  ],
});
