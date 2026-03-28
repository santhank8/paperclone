import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Db } from "@paperclipai/db";
import { createPluginEventBus } from "../services/plugin-event-bus.js";
import { buildHostServices } from "../services/plugin-host-services.js";

describe("plugin host services companyId validation", () => {
  it("rejects malformed companyId for issues.list", async () => {
    const host = buildHostServices(
      {} as Db,
      randomUUID(),
      "test.plugin",
      createPluginEventBus(),
    );

    await expect(
      host.issues.list({ companyId: "not-a-uuid" } as any),
    ).rejects.toThrow("Invalid companyId");

    host.dispose();
  });

  it("rejects malformed companyId for issues.listComments", async () => {
    const host = buildHostServices(
      {} as Db,
      randomUUID(),
      "test.plugin",
      createPluginEventBus(),
    );

    await expect(
      host.issues.listComments({
        companyId: "not-a-uuid",
        issueId: randomUUID(),
      } as any),
    ).rejects.toThrow("Invalid companyId");

    host.dispose();
  });
});
