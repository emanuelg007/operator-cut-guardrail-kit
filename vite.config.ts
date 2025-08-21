// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    hmr: { clientPort: 443 },
  },
});
