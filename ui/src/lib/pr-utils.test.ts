import { describe, expect, it } from "vitest";
import { extractPrNumber } from "./pr-utils";

describe("extractPrNumber", () => {
  it("returns externalId when it looks numeric", () => {
    expect(extractPrNumber({ externalId: "123", url: null, title: "Some PR" })).toBe("123");
  });

  it("extracts number from GitHub PR URL", () => {
    expect(
      extractPrNumber({
        externalId: null,
        url: "https://github.com/org/repo/pull/456",
        title: "Some PR",
      }),
    ).toBe("456");
  });

  it("extracts number from GitLab MR URL", () => {
    expect(
      extractPrNumber({
        externalId: null,
        url: "https://gitlab.com/org/repo/-/merge_requests/789",
        title: "Some MR",
      }),
    ).toBe("789");
  });

  it("extracts #N from title as fallback", () => {
    expect(
      extractPrNumber({ externalId: null, url: null, title: "Fix bug #42" }),
    ).toBe("42");
  });

  it("returns null when no number found", () => {
    expect(
      extractPrNumber({ externalId: null, url: null, title: "Fix bug" }),
    ).toBeNull();
  });

  it("handles non-numeric externalId by trying URL", () => {
    expect(
      extractPrNumber({
        externalId: "abc-node-id",
        url: "https://github.com/org/repo/pull/99",
        title: "PR title",
      }),
    ).toBe("99");
  });
});
