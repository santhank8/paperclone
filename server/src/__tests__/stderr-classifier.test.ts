import { describe, expect, it } from "vitest";
import { classifyStderrLine } from "@paperclipai/shared";

describe("stderr classifier", () => {
  it("treats MCP OAuth auth noise as benign", () => {
    expect(
      classifyStderrLine(
        '2026-03-10T18:29:05.099010Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { error_description="Missing or invalid access token" })',
      ),
    ).toBe("benign");
  });

  it("treats codex shell snapshot cleanup warnings as benign", () => {
    expect(
      classifyStderrLine(
        '2026-03-10T18:29:05.209809Z  WARN codex_core::shell_snapshot: Failed to delete shell snapshot at "/tmp/file": Os { code: 2, kind: NotFound, message: "No such file or directory" }',
      ),
    ).toBe("benign");
  });
});
