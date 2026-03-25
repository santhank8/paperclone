import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { pwaConfig } from './vite-pwa.config';

export default defineConfig({
  plugins: [react(), tailwindcss(), pwaConfig],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["paperclip.test", "localhost"],
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
});
