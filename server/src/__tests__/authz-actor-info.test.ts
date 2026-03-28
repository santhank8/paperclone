import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getActorInfo } from "../routes/authz.js";

describe("getActorInfo runId normalization", () => {
  it("drops malformed non-uuid runId values for board actors", () => {
    const req = {
      actor: {
        type: "board",
        userId: "board-user",
        source: "local_implicit",
        isInstanceAdmin: false,
        runId: { bad: true },
      },
    } as any;

    expect(getActorInfo(req)).toMatchObject({
      actorType: "user",
      actorId: "board-user",
      runId: null,
    });
  });

  it("preserves valid uuid runId values for agent actors", () => {
    const runId = randomUUID();
    const req = {
      actor: {
        type: "agent",
        agentId: randomUUID(),
        companyId: randomUUID(),
        runId,
      },
    } as any;

    expect(getActorInfo(req)).toMatchObject({
      actorType: "agent",
      runId,
    });
  });
});

