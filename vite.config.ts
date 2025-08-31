// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: Number(process.env.PORT) || 5174,
    strictPort: false,
    hmr: { clientPort: 443 },
  },
});
