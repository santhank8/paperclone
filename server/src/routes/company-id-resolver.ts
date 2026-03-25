import type { Db } from "@paperclipai/db";
import { and, eq, or } from "drizzle-orm";
import { companies } from "@paperclipai/db";

/**
 * Resolves a company identifier (UUID or issuePrefix) to a UUID.
 * This allows API routes to accept both formats seamlessly.
 */
export async function resolveCompanyId(db: Db, idOrPrefix: string): Promise<string | null> {
  // If it looks like a UUID, try that first
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrPrefix)) {
    const result = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, idOrPrefix))
      .then((rows) => rows[0] ?? null);
    if (result) return result.id;
  }

  // Try as issue prefix (case-insensitive)
  const result = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.issuePrefix, idOrPrefix.toUpperCase()))
    .then((rows) => rows[0] ?? null);

  return result?.id ?? null;
}

/**
 * Express middleware that converts companyId param from prefix to UUID.
 * Place this before routes that use req.params.companyId
 */
export function createCompanyIdResolverMiddleware(db: Db) {
  return async (req: any, _res: any, next: any) => {
    const companyIdParam = req.params.companyId;
    if (!companyIdParam) {
      return next();
    }

    const resolvedId = await resolveCompanyId(db, companyIdParam);
    if (resolvedId) {
      // Replace the param with the resolved UUID
      req.params.companyId = resolvedId;
    }
    // Note: if resolvedId is null, routes will handle the 404 when looking up the company
    next();
  };
}
