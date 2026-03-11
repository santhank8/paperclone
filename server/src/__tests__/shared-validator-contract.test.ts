/**
 * Contract test: Shared validator export stability.
 *
 * Verifies that key validator schemas are exported from @paperclipai/shared
 * and that routes reference shared validators for request body validation.
 * Detects drift where routes might use inline schemas instead of shared ones.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import * as shared from "@paperclipai/shared";

const ROUTES_DIR = resolve(import.meta.dirname, "..", "routes");

/** Key schemas that must be exported from shared validators. */
const REQUIRED_SCHEMAS = [
  "createCompanySchema",
  "updateCompanySchema",
  "createAgentSchema",
  "updateAgentSchema",
  "createAgentHireSchema",
  "createProjectSchema",
  "updateProjectSchema",
  "createIssueSchema",
  "updateIssueSchema",
  "checkoutIssueSchema",
  "createApprovalSchema",
  "resolveApprovalSchema",
  "createGoalSchema",
  "updateGoalSchema",
  "createCostEventSchema",
  "updateBudgetSchema",
];

describe("shared validator export stability", () => {
  for (const schemaName of REQUIRED_SCHEMAS) {
    it(`exports ${schemaName}`, () => {
      expect(shared).toHaveProperty(schemaName);
      expect((shared as any)[schemaName]).toBeDefined();
    });
  }
});

describe("routes use shared validators", () => {
  /** Routes that use validate() middleware should import schemas from @paperclipai/shared */
  const ROUTES_WITH_VALIDATION = [
    "issues.ts",
    "agents.ts",
    "approvals.ts",
    "companies.ts",
    "goals.ts",
    "projects.ts",
    "costs.ts",
    "secrets.ts",
  ];

  for (const file of ROUTES_WITH_VALIDATION) {
    it(`${file} imports from @paperclipai/shared`, () => {
      const content = readFileSync(join(ROUTES_DIR, file), "utf-8");
      expect(content).toContain("@paperclipai/shared");
    });
  }
});
