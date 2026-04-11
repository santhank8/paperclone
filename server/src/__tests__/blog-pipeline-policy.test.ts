import { describe, expect, it } from "vitest";
import {
  assertWordPressWriteAllowedForLane,
  buildPublishIdempotencyKey,
  createPublishApproval,
  executePublishGateway,
  executeWritingBoardPublishGateway,
  isWordPressWriteAllowedForLane,
  runVerifyContract,
  verifyPublishedPostContract,
} from "@paperclipai/blog-pipeline-policy";

describe("blog pipeline policy contract", () => {
  it("blocks report lane from WordPress writes", () => {
    expect(isWordPressWriteAllowedForLane("report")).toBe(false);
    expect(() => assertWordPressWriteAllowedForLane("report")).toThrow("wordpress_write_forbidden:report_lane");
    expect(isWordPressWriteAllowedForLane("publish")).toBe(true);
    expect(isWordPressWriteAllowedForLane("draft_only")).toBe(true);
  });

  it("exports publish approval helpers and verify contracts", () => {
    expect(typeof createPublishApproval).toBe("function");
    expect(typeof buildPublishIdempotencyKey).toBe("function");
    expect(typeof executePublishGateway).toBe("function");
    expect(typeof executeWritingBoardPublishGateway).toBe("function");
    expect(typeof runVerifyContract).toBe("function");
    expect(typeof verifyPublishedPostContract).toBe("function");
  });
});
