import { describe, it, expect } from "vitest";
import {
  resolveSkillAllowlist,
  filterSkills,
  computeSkillSetHash,
  DEFAULT_SKILL_ALLOWLIST,
} from "./skill-allowlist.js";

describe("skill-allowlist", () => {
  describe("resolveSkillAllowlist", () => {
    it("returns default for null/undefined config", () => {
      expect(resolveSkillAllowlist(null)).toEqual(DEFAULT_SKILL_ALLOWLIST);
      expect(resolveSkillAllowlist(undefined)).toEqual(DEFAULT_SKILL_ALLOWLIST);
    });

    it("returns default when no skillAllowlist key", () => {
      expect(resolveSkillAllowlist({ heartbeat: {} })).toEqual(DEFAULT_SKILL_ALLOWLIST);
    });

    it("parses enabled allowlist", () => {
      const config = {
        skillAllowlist: {
          enabled: true,
          allowed: ["deploy", "code-review"],
          blocked: ["admin"],
        },
      };
      const result = resolveSkillAllowlist(config);
      expect(result.enabled).toBe(true);
      expect(result.allowed).toEqual(["deploy", "code-review"]);
      expect(result.blocked).toEqual(["admin"]);
    });

    it("filters non-string entries from arrays", () => {
      const config = {
        skillAllowlist: {
          enabled: true,
          allowed: ["deploy", 42, null, "review"],
          blocked: [true, "admin"],
        },
      };
      const result = resolveSkillAllowlist(config);
      expect(result.allowed).toEqual(["deploy", "review"]);
      expect(result.blocked).toEqual(["admin"]);
    });
  });

  describe("filterSkills", () => {
    it("returns all skills when policy is disabled and no blocked", () => {
      const skills = ["deploy", "review", "admin"];
      const result = filterSkills(skills, DEFAULT_SKILL_ALLOWLIST);
      expect(result).toEqual(skills);
    });

    it("removes blocked skills even when policy is disabled", () => {
      const skills = ["deploy", "review", "admin"];
      const policy = { ...DEFAULT_SKILL_ALLOWLIST, blocked: ["admin"] };
      expect(filterSkills(skills, policy)).toEqual(["deploy", "review"]);
    });

    it("filters to only allowed skills when enabled", () => {
      const skills = ["deploy", "review", "admin", "test"];
      const policy = {
        enabled: true,
        allowed: ["deploy", "test"],
        blocked: [],
      };
      expect(filterSkills(skills, policy)).toEqual(["deploy", "test"]);
    });

    it("blocked takes precedence over allowed", () => {
      const skills = ["deploy", "review", "admin"];
      const policy = {
        enabled: true,
        allowed: ["deploy", "admin"],
        blocked: ["admin"],
      };
      expect(filterSkills(skills, policy)).toEqual(["deploy"]);
    });
  });

  describe("computeSkillSetHash", () => {
    it("returns deterministic hash", () => {
      const hash1 = computeSkillSetHash(["a", "b", "c"]);
      const hash2 = computeSkillSetHash(["a", "b", "c"]);
      expect(hash1).toBe(hash2);
    });

    it("returns same hash regardless of order", () => {
      const hash1 = computeSkillSetHash(["c", "a", "b"]);
      const hash2 = computeSkillSetHash(["a", "b", "c"]);
      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different skill sets", () => {
      const hash1 = computeSkillSetHash(["a", "b"]);
      const hash2 = computeSkillSetHash(["a", "c"]);
      expect(hash1).not.toBe(hash2);
    });

    it("returns 16-char hex string", () => {
      const hash = computeSkillSetHash(["test"]);
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
