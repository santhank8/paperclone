import { describe, expect, it } from "vitest";
import {
  parseAssignmentScope,
  evaluateAssignmentScope,
} from "../services/access.ts";

describe("parseAssignmentScope", () => {
  it("returns [] for null", () => {
    expect(parseAssignmentScope(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(parseAssignmentScope(undefined)).toEqual([]);
  });

  it("returns [] for unrecognised shape (no rules key)", () => {
    expect(parseAssignmentScope({ something: "else" })).toEqual([]);
  });

  it("returns [] when rules is not an array", () => {
    expect(parseAssignmentScope({ rules: "bad" })).toEqual([]);
  });

  it("parses a valid subtree rule", () => {
    expect(
      parseAssignmentScope({ rules: [{ type: "subtree", anchorId: "agent-1" }] }),
    ).toEqual([{ type: "subtree", anchorId: "agent-1" }]);
  });

  it("parses a valid exclude rule", () => {
    expect(
      parseAssignmentScope({ rules: [{ type: "exclude", targetId: "agent-ceo" }] }),
    ).toEqual([{ type: "exclude", targetId: "agent-ceo" }]);
  });

  it("parses multiple rules of mixed types", () => {
    expect(
      parseAssignmentScope({
        rules: [
          { type: "subtree", anchorId: "agent-1" },
          { type: "exclude", targetId: "agent-2" },
        ],
      }),
    ).toEqual([
      { type: "subtree", anchorId: "agent-1" },
      { type: "exclude", targetId: "agent-2" },
    ]);
  });

  it("skips items with unrecognised type without throwing", () => {
    expect(
      parseAssignmentScope({
        rules: [{ type: "unknown", anchorId: "agent-1" }],
      }),
    ).toEqual([]);
  });

  it("skips items missing required string fields without throwing", () => {
    expect(
      parseAssignmentScope({
        rules: [{ type: "subtree", anchorId: 42 }],
      }),
    ).toEqual([]);
  });

  it("does not throw on completely malformed input", () => {
    expect(parseAssignmentScope({ rules: [null, undefined, 42, "str"] })).toEqual([]);
  });
});

describe("evaluateAssignmentScope", () => {
  it("allows when rules is empty", () => {
    expect(evaluateAssignmentScope([], "agent-1", [])).toEqual({ allowed: true });
  });

  it("subtree rule: allowed when assignee is the anchor", () => {
    const rules = [{ type: "subtree" as const, anchorId: "agent-1" }];
    expect(evaluateAssignmentScope(rules, "agent-1", [])).toEqual({ allowed: true });
  });

  it("subtree rule: allowed when anchor is in ancestors", () => {
    const rules = [{ type: "subtree" as const, anchorId: "agent-root" }];
    expect(evaluateAssignmentScope(rules, "agent-leaf", ["agent-root", "agent-mid"])).toEqual({ allowed: true });
  });

  it("subtree rule: denied when anchor is not assignee and not in ancestors", () => {
    const rules = [{ type: "subtree" as const, anchorId: "agent-root" }];
    const result = evaluateAssignmentScope(rules, "agent-other", ["agent-x"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/outside permitted subtree/);
  });

  it("exclude rule: denied when targetId matches assignee", () => {
    const rules = [{ type: "exclude" as const, targetId: "agent-ceo" }];
    const result = evaluateAssignmentScope(rules, "agent-ceo", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/explicitly excluded/);
  });

  it("exclude rule: allowed when targetId does not match assignee", () => {
    const rules = [{ type: "exclude" as const, targetId: "agent-ceo" }];
    expect(evaluateAssignmentScope(rules, "agent-other", [])).toEqual({ allowed: true });
  });

  it("subtree rule: second subtree rule failing denies even when first passes", () => {
    const rules = [
      { type: "subtree" as const, anchorId: "agent-root" },
      { type: "subtree" as const, anchorId: "agent-mid" },
    ];
    // assignee is under agent-root but not under agent-mid
    const result = evaluateAssignmentScope(rules, "agent-leaf", ["agent-root"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/outside permitted subtree/);
  });

  it("combined: subtree passes but exclude fails → denied", () => {
    const rules = [
      { type: "subtree" as const, anchorId: "agent-root" },
      { type: "exclude" as const, targetId: "agent-leaf" },
    ];
    const result = evaluateAssignmentScope(rules, "agent-leaf", ["agent-root"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/explicitly excluded/);
  });

  it("combined: both subtree and exclude pass → allowed", () => {
    const rules = [
      { type: "subtree" as const, anchorId: "agent-root" },
      { type: "exclude" as const, targetId: "agent-ceo" },
    ];
    expect(evaluateAssignmentScope(rules, "agent-leaf", ["agent-root"])).toEqual({ allowed: true });
  });
});
