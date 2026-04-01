import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000, // 30s para testes com I/O (git operations, filesystem, worktree provisioning)
  },
});
