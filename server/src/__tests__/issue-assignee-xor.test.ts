import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createIssueSchema, updateIssueSchema } from "@paperclipai/shared/validators/issue";

const AGENT_ID = "00000000-0000-0000-0000-000000000001";

describe("issue assignee XOR validator", () => {
  describe("createIssueSchema", () => {
    it("errors when both assigneeAgentId and assigneeUserId are set", () => {
      const result = createIssueSchema.safeParse({
        title: "test issue",
        assigneeAgentId: AGENT_ID,
        assigneeUserId: "user-1",
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      const issue = result.error.issues.find((i) => i.path[0] === "assigneeUserId");
      expect(issue).toBeDefined();
      expect(issue!.code).toBe(z.ZodIssueCode.custom);
      expect(issue!.message).toBe("assigneeAgentId and assigneeUserId are mutually exclusive");
    });

    it("succeeds with only assigneeAgentId", () => {
      const result = createIssueSchema.safeParse({
        title: "test issue",
        assigneeAgentId: AGENT_ID,
      });
      expect(result.success).toBe(true);
    });

    it("succeeds with only assigneeUserId", () => {
      const result = createIssueSchema.safeParse({
        title: "test issue",
        assigneeUserId: "user-1",
      });
      expect(result.success).toBe(true);
    });

    it("succeeds with neither assignee field", () => {
      const result = createIssueSchema.safeParse({ title: "test issue" });
      expect(result.success).toBe(true);
    });

    it("succeeds when assigneeAgentId is null and assigneeUserId is set", () => {
      const result = createIssueSchema.safeParse({
        title: "test issue",
        assigneeAgentId: null,
        assigneeUserId: "user-1",
      });
      expect(result.success).toBe(true);
    });

    it("succeeds when assigneeUserId is null and assigneeAgentId is set", () => {
      const result = createIssueSchema.safeParse({
        title: "test issue",
        assigneeAgentId: AGENT_ID,
        assigneeUserId: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateIssueSchema", () => {
    it("errors when both assigneeAgentId and assigneeUserId are set", () => {
      const result = updateIssueSchema.safeParse({
        assigneeAgentId: AGENT_ID,
        assigneeUserId: "user-1",
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      const issue = result.error.issues.find((i) => i.path[0] === "assigneeUserId");
      expect(issue).toBeDefined();
      expect(issue!.code).toBe(z.ZodIssueCode.custom);
      expect(issue!.message).toBe("assigneeAgentId and assigneeUserId are mutually exclusive");
    });

    it("succeeds with only assigneeAgentId", () => {
      const result = updateIssueSchema.safeParse({ assigneeAgentId: AGENT_ID });
      expect(result.success).toBe(true);
    });

    it("succeeds with only assigneeUserId", () => {
      const result = updateIssueSchema.safeParse({ assigneeUserId: "user-1" });
      expect(result.success).toBe(true);
    });

    it("succeeds with no fields at all (empty partial update)", () => {
      const result = updateIssueSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
