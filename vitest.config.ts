import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/db",
      "packages/adapters/opencode-local",
      "packages/plugins/slack-sync",
      "server",
      "ui",
      "cli",
    ],
  },
});
