import { describe, expect, it } from "vitest";
import { appendWithCap } from "./server-utils.js";

describe("appendWithCap", () => {
  it("returns combined string when under cap", () => {
    expect(appendWithCap("hello", " world", 100)).toBe("hello world");
  });

  it("returns combined string when exactly at cap (ASCII)", () => {
    // "ab" is 2 bytes
    expect(appendWithCap("a", "b", 2)).toBe("ab");
  });

  it("truncates from the front to stay within byte cap (ASCII)", () => {
    // "abcde" is 5 bytes, cap is 3 → keep last 3 bytes → "cde"
    expect(appendWithCap("ab", "cde", 3)).toBe("cde");
  });

  it("handles emoji without producing invalid UTF-8", () => {
    // '😀' is 4 bytes in UTF-8. With a cap of 4, we should get just the emoji.
    const emoji = "😀";
    expect(Buffer.byteLength(emoji, "utf8")).toBe(4);
    const result = appendWithCap("x", emoji, 4);
    expect(result).toBe(emoji);
  });

  it("drops partial multi-byte character at truncation boundary", () => {
    // 'a😀' is 1 + 4 = 5 bytes. Cap of 3 would try to start mid-emoji.
    // Should skip the partial emoji bytes and return empty or partial.
    const result = appendWithCap("a", "😀", 3);
    // 5 bytes total, keep last 3 = bytes [2..4] of the emoji = continuation bytes.
    // The fix should skip those continuation bytes, producing an empty string.
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(3);
    // Must be valid UTF-8 (no replacement chars from broken encoding)
    expect(result).toBe(Buffer.from(result, "utf8").toString("utf8"));
  });

  it("handles CJK characters correctly", () => {
    // '中' is 3 bytes in UTF-8
    const cjk = "中文";
    expect(Buffer.byteLength(cjk, "utf8")).toBe(6);
    // Cap of 6 should keep both characters
    expect(appendWithCap("", cjk, 6)).toBe(cjk);
    // Cap of 3 should keep only the last character
    expect(appendWithCap("", cjk, 3)).toBe("文");
  });

  it("drops partial CJK character at truncation boundary", () => {
    // 'A中文' = 1 + 3 + 3 = 7 bytes. Cap of 5 means start at byte 2,
    // which is the 2nd byte of '中' (continuation byte). Should skip it.
    const result = appendWithCap("A", "中文", 5);
    // Should skip the partial '中' and return '文' (3 bytes)
    expect(result).toBe("文");
  });

  it("handles mixed ASCII and multi-byte at boundary", () => {
    // "abc😀" = 3 + 4 = 7 bytes. Cap of 5 means start at byte 2.
    // Bytes 2..6: 'c' + full emoji = 5 bytes
    const result = appendWithCap("abc", "😀", 5);
    expect(result).toBe("c😀");
  });

  it("handles surrogate pairs in truncation", () => {
    // '𝄞' (musical symbol) is a surrogate pair in JS, 4 bytes in UTF-8
    const musical = "𝄞";
    expect(Buffer.byteLength(musical, "utf8")).toBe(4);
    expect(musical.length).toBe(2); // 2 UTF-16 code units

    const result = appendWithCap("ab", musical, 4);
    // "ab𝄞" = 6 bytes, cap 4, start at byte 2 = full '𝄞' = 4 bytes
    expect(result).toBe(musical);
  });

  it("never produces invalid UTF-8 with random truncation points", () => {
    const input = "Hello 🌍 世界 𝄞 test";
    for (let cap = 1; cap <= Buffer.byteLength(input, "utf8"); cap++) {
      const result = appendWithCap("", input, cap);
      // Re-encoding should round-trip cleanly (no U+FFFD replacement)
      const reencoded = Buffer.from(result, "utf8").toString("utf8");
      expect(result).toBe(reencoded);
      expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(cap);
    }
  });

  it("uses default cap of MAX_CAPTURE_BYTES", () => {
    // Just verify it doesn't throw with default cap
    const result = appendWithCap("hello", " world");
    expect(result).toBe("hello world");
  });

  it("handles empty strings", () => {
    expect(appendWithCap("", "", 10)).toBe("");
    expect(appendWithCap("", "hello", 10)).toBe("hello");
    expect(appendWithCap("hello", "", 10)).toBe("hello");
  });
});
