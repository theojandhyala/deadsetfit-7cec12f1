import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    tsconfigPaths(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Stable entry filename so public/app-shell.html can hardcode the path.
        // Code-split chunks and CSS assets keep content hashes for cache-busting.
        entryFileNames: (chunk) =>
          chunk.isEntry && chunk.name === "index" ? "assets/index.js" : "assets/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.name === "styles.css" ? "assets/styles.css" : "assets/[name]-[hash].[ext]",
      },
    },
  },
});
