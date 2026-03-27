import { describe, expect, it } from "vitest";
import { instanceSettingsService } from "../services/instance-settings.ts";

function createInstanceSettingsDb(initialGeneral?: Record<string, unknown>) {
  let row:
    | {
      id: string;
      singletonKey: string;
      general: Record<string, unknown>;
      experimental: Record<string, unknown>;
      createdAt: Date;
      updatedAt: Date;
    }
    | null = initialGeneral
      ? {
        id: "instance-settings-1",
        singletonKey: "default",
        general: { ...initialGeneral },
        experimental: {},
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }
      : null;

  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(row ? [row] : []),
        }),
      }),
      insert: () => ({
        values: (value: Record<string, unknown>) => ({
          onConflictDoUpdate: () => ({
            returning: async () => {
              if (!row) {
                row = {
                  id: "instance-settings-1",
                  singletonKey: "default",
                  general: (value.general as Record<string, unknown> | undefined) ?? {},
                  experimental: (value.experimental as Record<string, unknown> | undefined) ?? {},
                  createdAt: (value.createdAt as Date | undefined) ?? new Date(),
                  updatedAt: (value.updatedAt as Date | undefined) ?? new Date(),
                };
              }
              return [row];
            },
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              if (!row) {
                throw new Error("row missing");
              }
              row = {
                ...row,
                general: (patch.general as Record<string, unknown> | undefined) ?? row.general,
                experimental: (patch.experimental as Record<string, unknown> | undefined) ?? row.experimental,
                updatedAt: (patch.updatedAt as Date | undefined) ?? row.updatedAt,
              };
              return [row];
            },
          }),
        }),
      }),
    },
    getRow: () => row,
  };
}

describe("instance settings service", () => {
  it("seeds the default adapter when none has been explicitly chosen", async () => {
    const dbStub = createInstanceSettingsDb();
    const svc = instanceSettingsService(dbStub.db as any);

    const result = await svc.seedDefaultAdapterType("codex_local");

    expect(result.general.defaultAdapterType).toBe("codex_local");
    expect(dbStub.getRow()?.general.defaultAdapterType).toBe("codex_local");
  });

  it("does not overwrite an explicitly chosen default adapter", async () => {
    const dbStub = createInstanceSettingsDb({ defaultAdapterType: "claude_local" });
    const svc = instanceSettingsService(dbStub.db as any);

    const result = await svc.seedDefaultAdapterType("codex_local");

    expect(result.general.defaultAdapterType).toBe("claude_local");
    expect(dbStub.getRow()?.general.defaultAdapterType).toBe("claude_local");
  });
});
