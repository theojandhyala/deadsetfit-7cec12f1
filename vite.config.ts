import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { fileURLToPath, URL } from "node:url";

const stub = (name: string) => fileURLToPath(new URL(`src/stubs/${name}`, import.meta.url));

export default defineConfig({
  plugins: [
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
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        authRoot: fileURLToPath(new URL("auth.html", import.meta.url)),
        auth: fileURLToPath(new URL("auth/index.html", import.meta.url)),
      },
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;
          if (id.includes("/@tanstack/")) return "vendor-tanstack";
          if (id.includes("/@supabase/")) return "vendor-supabase";
          if (id.includes("/lucide-react/")) return "vendor-icons";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          return "vendor";
        },
      },
    },
  },
});
