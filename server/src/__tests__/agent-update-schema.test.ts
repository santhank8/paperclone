import { describe, expect, it } from "vitest";
import { updateAgentSchema } from "@paperclipai/shared/validators/agent";

describe("updateAgentSchema", () => {
  it("does not inject create-time defaults into partial updates", () => {
    expect(updateAgentSchema.parse({ title: "Chief of Staff" })).toEqual({
      title: "Chief of Staff",
    });
  });

  it("preserves explicit runtimeConfig patches without adding unrelated defaults", () => {
    expect(updateAgentSchema.parse({
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 300,
        },
      },
    })).toEqual({
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 300,
        },
      },
    });
  });
});
