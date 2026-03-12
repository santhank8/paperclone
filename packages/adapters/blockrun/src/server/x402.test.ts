import { describe, it, expect } from "vitest";
import { getWalletAddress } from "./x402.js";

describe("x402 utilities", () => {
  // Well-known test private key (Hardhat/Anvil account #0)
  const TEST_PRIVATE_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const EXPECTED_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  it("derives correct wallet address from private key", () => {
    const address = getWalletAddress(TEST_PRIVATE_KEY);
    expect(address.toLowerCase()).toBe(EXPECTED_ADDRESS.toLowerCase());
  });

  it("throws for invalid private key", () => {
    expect(() => getWalletAddress("not-a-key")).toThrow();
  });

  it("handles 0x-prefixed 64-char hex", () => {
    const address = getWalletAddress(TEST_PRIVATE_KEY);
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
