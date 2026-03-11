/**
 * Contract test: Mutation endpoints must have activity logging.
 *
 * Statically verifies that mutation route files (POST/PUT/PATCH/DELETE handlers)
 * contain logActivity calls, ensuring the audit trail contract is maintained.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

const ROUTES_DIR = resolve(import.meta.dirname, "..", "routes");

/** Route files that contain mutation endpoints and must log activity. */
const MUTATION_ROUTE_FILES = [
  "issues.ts",
  "agents.ts",
  "approvals.ts",
  "companies.ts",
  "goals.ts",
  "projects.ts",
  "costs.ts",
  "secrets.ts",
];

/** Route files that are read-only or infrastructure (no mutation logging required). */
const EXEMPT_ROUTE_FILES = [
  "index.ts",
  "health.ts",
  "authz.ts",
  "access.ts",
  "activity.ts",
  "assets.ts",
  "dashboard.ts",
  "issues-checkout-wakeup.ts",
  "llms.ts",
  "sidebar-badges.ts",
];

describe("mutation activity log contract", () => {
  for (const file of MUTATION_ROUTE_FILES) {
    it(`${file} imports logActivity`, () => {
      const content = readFileSync(join(ROUTES_DIR, file), "utf-8");
      expect(content).toContain("logActivity");
    });

    it(`${file} calls logActivity for mutations`, () => {
      const content = readFileSync(join(ROUTES_DIR, file), "utf-8");
      // Must have at least one logActivity( call (not just the import)
      const callCount = (content.match(/logActivity\(db,/g) || []).length;
      expect(callCount).toBeGreaterThan(0);
    });
  }

  it("all route files are accounted for (no unclassified routes)", () => {
    const allFiles = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".ts"));
    const classified = new Set([
      ...MUTATION_ROUTE_FILES,
      ...EXEMPT_ROUTE_FILES,
    ]);
    const unclassified = allFiles.filter((f) => !classified.has(f));
    expect(unclassified).toEqual([]);
  });
});
