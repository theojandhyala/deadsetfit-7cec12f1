import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { TanStackStartViteServerFn } from "@tanstack/start-vite-plugin";
import { fileURLToPath, URL } from "node:url";

const stub = (name: string) => fileURLToPath(new URL(`src/stubs/${name}`, import.meta.url));

// Wrap the plugin to skip node_modules (the plugin's own regex erroneously matches
// arrow-function definitions in library code, causing a transform error).
function TanStackStartSrcOnly(opts: Parameters<typeof TanStackStartViteServerFn>[0]) {
  const plugin = TanStackStartViteServerFn(opts) as any;
  const originalTransform = plugin.transform?.bind(plugin);
  if (originalTransform) {
    plugin.transform = function (code: string, id: string, ...rest: unknown[]) {
      if (id.includes("/node_modules/")) return null;
      return originalTransform(code, id, ...rest);
    };
  }
  return plugin;
}

export default defineConfig({
  plugins: [
    TanStackStartSrcOnly({ env: "client" }),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    tailwindcss(),
    react(),
    tsConfigPaths(),
  ],
  resolve: {
    alias: {
      "@tanstack/react-start/server": stub("start-server.ts"),
      "@tanstack/start-storage-context": stub("start-storage-context.ts"),
      "node:buffer": stub("node-buffer.ts"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
