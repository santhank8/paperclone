import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The integration suites boot a real embedded Postgres cluster. Running
    // server test files one-at-a-time avoids port races and makes the
    // temporary-database lifecycle deterministic in CI.
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
  },
});
