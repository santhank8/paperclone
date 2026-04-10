import { describe, expect, it } from "vitest";
import { isEmailDomainAllowed } from "../auth/better-auth.js";
import { parseAllowedEmailDomains } from "../config.js";

describe("isEmailDomainAllowed", () => {
  it("allows any email when allowedDomains is empty", () => {
    expect(isEmailDomainAllowed("user@any.com", [])).toBe(true);
    expect(isEmailDomainAllowed("user@other.org", [])).toBe(true);
  });

  it("allows email whose domain is in the allowlist", () => {
    expect(isEmailDomainAllowed("user@acme.com", ["acme.com"])).toBe(true);
  });

  it("blocks email whose domain is not in the allowlist", () => {
    expect(isEmailDomainAllowed("user@other.com", ["acme.com"])).toBe(false);
  });

  it("is case-insensitive on the email domain", () => {
    expect(isEmailDomainAllowed("user@ACME.COM", ["acme.com"])).toBe(true);
  });

  it("is case-insensitive on the allowlist entries", () => {
    expect(isEmailDomainAllowed("user@acme.com", ["ACME.COM"])).toBe(true);
  });

  it("blocks email with no @ character", () => {
    expect(isEmailDomainAllowed("notanemail", ["acme.com"])).toBe(false);
  });

  it("blocks empty email", () => {
    expect(isEmailDomainAllowed("", ["acme.com"])).toBe(false);
  });

  it("blocks null email", () => {
    expect(isEmailDomainAllowed(null, ["acme.com"])).toBe(false);
  });

  it("blocks undefined email", () => {
    expect(isEmailDomainAllowed(undefined, ["acme.com"])).toBe(false);
  });

  it("allows email when its domain matches one of multiple allowlist entries", () => {
    expect(isEmailDomainAllowed("user@b.com", ["a.com", "b.com", "c.com"])).toBe(true);
  });

  it("blocks email that matches no entry in a multi-entry allowlist", () => {
    expect(isEmailDomainAllowed("user@z.com", ["a.com", "b.com", "c.com"])).toBe(false);
  });
});

describe("parseAllowedEmailDomains", () => {
  it("returns empty array for empty string", () => {
    expect(parseAllowedEmailDomains("")).toEqual([]);
  });

  it("parses a single domain", () => {
    expect(parseAllowedEmailDomains("acme.com")).toEqual(["acme.com"]);
  });

  it("parses comma-separated domains", () => {
    expect(parseAllowedEmailDomains("acme.com,other.org")).toEqual(["acme.com", "other.org"]);
  });

  it("trims whitespace around domain entries", () => {
    expect(parseAllowedEmailDomains(" acme.com , other.org ")).toEqual(["acme.com", "other.org"]);
  });

  it("lowercases all domain entries", () => {
    expect(parseAllowedEmailDomains("ACME.COM,Other.Org")).toEqual(["acme.com", "other.org"]);
  });

  it("filters out empty entries from consecutive commas", () => {
    expect(parseAllowedEmailDomains("acme.com,,other.org")).toEqual(["acme.com", "other.org"]);
  });

  it("filters out whitespace-only entries", () => {
    expect(parseAllowedEmailDomains("acme.com, ,other.org")).toEqual(["acme.com", "other.org"]);
  });
});
