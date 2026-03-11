import { describe, expect, it } from "vitest";
import { findMentionedAgentIdsInBody } from "../services/issues.ts";

describe("findMentionedAgentIdsInBody", () => {
  const agents = [
    { id: "a1", name: "QA Architect" },
    { id: "a2", name: "Principal Developer" },
    { id: "a3", name: "CEO" },
  ];

  it("matches raw @mentions with spaces in agent names", () => {
    const result = findMentionedAgentIdsInBody(
      agents,
      "Please review this, @QA Architect, before we close the blocker.",
    );

    expect(result).toEqual(["a1"]);
  });

  it("matches slug-style @mentions for spaced names", () => {
    const result = findMentionedAgentIdsInBody(
      agents,
      "Escalating to @principal-developer for execution follow-up.",
    );

    expect(result).toEqual(["a2"]);
  });

  it("matches simple names and de-duplicates repeated mentions", () => {
    const result = findMentionedAgentIdsInBody(
      agents,
      "@CEO please check this. Looping @ceo again for visibility.",
    );

    expect(result).toEqual(["a3"]);
  });
});
