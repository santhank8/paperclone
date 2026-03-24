import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    allowedHosts: ['cascadia.tail7c7620.ts.net'],
  },
  test: {
    projects: ["packages/db", "packages/adapters/opencode-local", "server", "ui", "cli"],
  },
});
