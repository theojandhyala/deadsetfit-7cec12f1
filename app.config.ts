import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    preset: "cloudflare-pages",
  },
  client: {
    entry: "./src/client.tsx",
  },
  vite: {
    plugins: () => [tsConfigPaths()],
  },
});
