import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/adapter-utils", "packages/db", "packages/adapters/opencode-local", "packages/adapters/gemini-local", "server", "ui", "cli"],
  },
});
