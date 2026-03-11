import { describe, expect, it } from "vitest";
import { extractClaudeLoginUrl } from "../services/claude-instance-subscription.ts";

describe("extractClaudeLoginUrl", () => {
  it("preserves oauth query parameters in Claude authorize urls", () => {
    const url = extractClaudeLoginUrl(
      "Open this URL in your browser:\nhttps://claude.ai/oauth/authorize?client_id=test-client&response_type=code&scope=org:create_api_key%20user:profile&state=abc123",
    );

    expect(url).toBe(
      "https://claude.ai/oauth/authorize?client_id=test-client&response_type=code&scope=org:create_api_key%20user:profile&state=abc123",
    );
  });

  it("strips trailing punctuation without trimming the query string", () => {
    const url = extractClaudeLoginUrl(
      "Login URL: https://claude.ai/oauth/authorize?client_id=test-client&response_type=code.",
    );

    expect(url).toBe(
      "https://claude.ai/oauth/authorize?client_id=test-client&response_type=code",
    );
  });
});
