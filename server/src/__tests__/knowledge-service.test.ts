import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKnowledgeService } from "../services/knowledge.ts";

vi.mock("../services/live-events.js", () => ({
  publishLiveEvent: vi.fn(),
}));

function createMockDb() {
  const mockRows: any[] = [];
  const returning = vi.fn(async () => mockRows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where, returning }));
  const values = vi.fn(() => ({ returning }));
  const limit = vi.fn(() => ({ offset: vi.fn(async () => mockRows) }));
  const orderBy = vi.fn(() => ({ limit }));
  const selectFrom = vi.fn(() => ({
    where: vi.fn(async () => mockRows),
    orderBy,
  }));
  const selectDistinct = vi.fn(() => ({
    from: vi.fn(async () => mockRows),
  }));

  return {
    db: {
      select: vi.fn(() => ({ from: selectFrom })),
      selectDistinct,
      insert: vi.fn(() => ({ values })),
      update: vi.fn(() => ({ set })),
      execute: vi.fn(async () => []),
    },
    mockRows,
    returning,
    values,
    set,
    where,
    selectFrom,
  };
}

describe("createKnowledgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a service object with expected methods", () => {
    const { db } = createMockDb();
    const svc = createKnowledgeService(db as any);

    expect(svc).toHaveProperty("create");
    expect(svc).toHaveProperty("getById");
    expect(svc).toHaveProperty("search");
    expect(svc).toHaveProperty("searchSummary");
    expect(svc).toHaveProperty("bumpAccess");
    expect(svc).toHaveProperty("supersede");
    expect(svc).toHaveProperty("bulkImport");
    expect(svc).toHaveProperty("getStats");
  });

  describe("create", () => {
    it("calls db.insert with correct values and returns the entry", async () => {
      const { db, mockRows } = createMockDb();
      const entry = {
        id: "k-1",
        companyId: "comp-1",
        title: "Test Knowledge",
        body: "Some body text",
        category: "observation",
        tags: [],
      };
      mockRows.push(entry);

      const svc = createKnowledgeService(db as any);
      const result = await svc.create({
        title: "Test Knowledge",
        body: "Some body text",
        companyId: "comp-1",
      });

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(entry);
    });
  });

  describe("getById", () => {
    it("calls db.select and returns entry when found", async () => {
      const { db, mockRows } = createMockDb();
      const entry = { id: "k-1", title: "Found" };
      mockRows.push(entry);

      const svc = createKnowledgeService(db as any);
      const result = await svc.getById("k-1");

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(entry);
    });

    it("returns null when entry not found", async () => {
      const { db } = createMockDb();
      // mockRows is empty

      const svc = createKnowledgeService(db as any);
      const result = await svc.getById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("search", () => {
    it("builds query conditions from search input", async () => {
      const searchResults: any[] = [];
      const offset = vi.fn(async () => searchResults);
      const limit = vi.fn(() => ({ offset }));
      const orderBy = vi.fn(() => ({ limit }));
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      const select = vi.fn(() => ({ from }));

      const db = {
        select,
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      };

      const svc = createKnowledgeService(db as any);
      const results = await svc.search({
        query: "test query",
        companyId: "comp-1",
        category: "decision",
        minRelevance: 0.5,
        maxAgeDays: 7,
      });

      expect(select).toHaveBeenCalled();
      expect(from).toHaveBeenCalled();
      expect(where).toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });

  describe("searchSummary", () => {
    it("returns excerpts with body sliced to 200 chars", async () => {
      const longBody = "A".repeat(500);
      const searchResults = [
        {
          id: "k-1",
          title: "Long Entry",
          body: longBody,
          category: "observation",
          tags: ["test"],
          relevanceScore: 1.0,
          createdAt: new Date(),
          companyId: "comp-1",
          sourceAgentId: null,
          sourcePlatform: "claude_local",
          projectId: null,
          accessCount: 0,
        },
      ];

      const offset = vi.fn(async () => searchResults);
      const limit = vi.fn(() => ({ offset }));
      const orderBy = vi.fn(() => ({ limit }));
      const where = vi.fn(() => ({ orderBy }));
      const from = vi.fn(() => ({ where }));
      const select = vi.fn(() => ({ from }));

      const db = {
        select,
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      };

      const svc = createKnowledgeService(db as any);
      const results = await svc.searchSummary({ query: "test" });

      expect(results).toHaveLength(1);
      expect(results[0].excerpt).toHaveLength(200);
      expect(results[0]).toHaveProperty("title", "Long Entry");
      expect(results[0]).not.toHaveProperty("body");
    });
  });

  describe("bumpAccess", () => {
    it("updates accessCount and relevanceScore", async () => {
      const updatedEntry = { id: "k-1", accessCount: 5 };
      const fullEntry = { id: "k-1", companyId: "comp-1", accessCount: 5 };

      const returning = vi.fn(async () => [updatedEntry]);
      const where = vi.fn(() => ({ returning }));
      const set = vi.fn(() => ({ where }));
      const update = vi.fn(() => ({ set }));

      // For getById inside bumpAccess
      const selectWhere = vi.fn(async () => [fullEntry]);
      const selectFrom = vi.fn(() => ({ where: selectWhere }));
      const select = vi.fn(() => ({ from: selectFrom }));

      const db = { select, insert: vi.fn(), update, execute: vi.fn() };

      const svc = createKnowledgeService(db as any);
      const result = await svc.bumpAccess("k-1");

      expect(update).toHaveBeenCalled();
      expect(set).toHaveBeenCalled();
      expect(result).toEqual(updatedEntry);
    });
  });

  describe("supersede", () => {
    it("queries old entry for companyId, then sets supersededBy", async () => {
      const oldEntry = { companyId: "comp-1" };
      const selectWhere = vi.fn(async () => [oldEntry]);
      const selectFrom = vi.fn(() => ({ where: selectWhere }));
      const select = vi.fn(() => ({ from: selectFrom }));

      const updateWhere = vi.fn(async () => []);
      const updateSet = vi.fn(() => ({ where: updateWhere }));
      const update = vi.fn(() => ({ set: updateSet }));

      const db = { select, insert: vi.fn(), update, execute: vi.fn() };

      const svc = createKnowledgeService(db as any);
      await svc.supersede("old-id", "new-id");

      expect(select).toHaveBeenCalled();
      expect(update).toHaveBeenCalled();
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ supersededBy: "new-id" }),
      );
    });
  });

  describe("bulkImport", () => {
    it("returns { imported: 0 } for empty array", async () => {
      const { db } = createMockDb();
      const svc = createKnowledgeService(db as any);
      const result = await svc.bulkImport([]);

      expect(result).toEqual({ imported: 0 });
      expect(db.insert).not.toHaveBeenCalled();
    });

    it("inserts correct values for non-empty array", async () => {
      const { db, returning } = createMockDb();
      returning.mockResolvedValueOnce([{ id: "k-1" }, { id: "k-2" }]);

      const svc = createKnowledgeService(db as any);
      const result = await svc.bulkImport([
        { title: "Entry 1", body: "Body 1" },
        { title: "Entry 2", body: "Body 2", category: "decision" },
      ]);

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual({ imported: 2 });
    });
  });

  describe("getStats", () => {
    it("returns total, active, categories, and platforms", async () => {
      // getStats makes 4 calls:
      //   1. db.select().from()           -> awaited directly (total)
      //   2. db.select().from().where()   -> awaited (active)
      //   3. db.selectDistinct().from()   -> awaited (categories)
      //   4. db.selectDistinct().from()   -> awaited (platforms)
      let selectCall = 0;
      const selectResults = [
        [{ count: 42 }],  // total: select().from() — thenable
        [{ count: 35 }],  // active: select().from().where()
      ];

      const select = vi.fn(() => {
        const idx = selectCall++;
        const fromResult = selectResults[idx] ?? [];
        // The from() return must be thenable (for total) AND have .where() (for active)
        const whereResult = selectResults[idx] ?? [];
        const fromObj: any = {
          where: vi.fn(async () => whereResult),
          then: (resolve: any) => Promise.resolve(resolve(fromResult)),
        };
        return { from: vi.fn(() => fromObj) };
      });

      let distinctCall = 0;
      const distinctResults = [
        [{ category: "observation" }, { category: "decision" }],
        [{ platform: "claude_local" }, { platform: "vault" }],
      ];
      const selectDistinct = vi.fn(() => {
        const idx = distinctCall++;
        const result = distinctResults[idx] ?? [];
        const fromObj: any = {
          then: (resolve: any) => Promise.resolve(resolve(result)),
        };
        return { from: vi.fn(() => fromObj) };
      });

      const db = { select, selectDistinct, insert: vi.fn(), update: vi.fn(), execute: vi.fn() };

      const svc = createKnowledgeService(db as any);
      const stats = await svc.getStats();

      expect(stats.total).toBe(42);
      expect(stats.active).toBe(35);
      expect(stats.categories).toEqual(["observation", "decision"]);
      expect(stats.platforms).toEqual(["claude_local", "vault"]);
    });
  });
});
