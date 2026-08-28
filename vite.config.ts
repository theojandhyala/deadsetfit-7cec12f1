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
        nativeAuthCallback: fileURLToPath(
          new URL("auth/native-callback/index.html", import.meta.url),
        ),
      },
      output: {
        // Keep every JS file in a release-specific namespace. If a CDN race
        // ever serves fallback HTML under a hashed module URL, the next
        // release bypasses that immutable browser entry as one coherent graph.
        entryFileNames: "assets/[name]-r20260726-fitness2-[hash].js",
        chunkFileNames: "assets/[name]-r20260726-fitness2-[hash].js",
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;
          if (id.includes("/@tanstack/")) return "vendor-tanstack";
          if (id.includes("/@supabase/")) return "vendor-supabase";
          if (id.includes("/lucide-react/")) return "vendor-icons";
          if (
            id.includes("/recharts/") ||
            id.includes("/d3-") ||
            id.includes("/victory-vendor/")
          ) {
            return "vendor-charts";
          }
          if (id.includes("/@radix-ui/")) return "vendor-radix";
          if (id.includes("/leaflet/") || id.includes("/react-leaflet/")) return "vendor-maps";
          if (id.includes("/@stripe/") || id.includes("/stripe/")) return "vendor-stripe";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          return "vendor";
        },
      },
    },
  },
});
