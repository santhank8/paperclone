import type { ProviderQuotaResult } from "@paperclipai/shared";
import { listServerAdapters } from "../adapters/registry.js";

const QUOTA_PROVIDER_TIMEOUT_MS = 20_000;

/** Cache of last successful quota results per provider, used as fallback when live fetch fails */
const quotaCache = new Map<string, { result: ProviderQuotaResult; fetchedAt: number }>();
const QUOTA_CACHE_MAX_AGE_MS = 30 * 60_000; // 30 minutes

function providerSlugForAdapterType(type: string): string {
  switch (type) {
    case "claude_local":
      return "anthropic";
    case "codex_local":
      return "openai";
    default:
      return type;
  }
}

/**
 * Asks each registered adapter for its provider quota windows and aggregates the results.
 * Adapters that don't implement getQuotaWindows() are silently skipped.
 * Individual adapter failures are caught and returned as error results rather than
 * letting one provider's outage block the entire response.
 *
 * When a provider fails (e.g. rate limited), the last successful result is returned
 * from cache (up to 30 minutes old) so dashboards always have something to show.
 */
export async function fetchAllQuotaWindows(): Promise<ProviderQuotaResult[]> {
  const adapters = listServerAdapters().filter((a) => a.getQuotaWindows != null);

  const settled = await Promise.allSettled(
    adapters.map((adapter) => withQuotaTimeout(adapter.type, adapter.getQuotaWindows!())),
  );

  return settled.map((result, i) => {
    const adapterType = adapters[i]!.type;
    const provider = providerSlugForAdapterType(adapterType);

    let live: ProviderQuotaResult;
    if (result.status === "fulfilled") {
      live = result.value;
    } else {
      live = { provider, ok: false, error: String(result.reason), windows: [] };
    }

    // If live result is successful, cache it
    if (live.ok && live.windows.length > 0) {
      quotaCache.set(provider, { result: live, fetchedAt: Date.now() });
      return live;
    }

    // Live fetch failed — try returning cached data
    const cached = quotaCache.get(provider);
    if (cached && Date.now() - cached.fetchedAt < QUOTA_CACHE_MAX_AGE_MS) {
      return {
        ...cached.result,
        source: cached.result.source ? `${cached.result.source} (cached)` : "cached",
      };
    }

    return live;
  });
}

async function withQuotaTimeout(
  adapterType: string,
  task: Promise<ProviderQuotaResult>,
): Promise<ProviderQuotaResult> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<ProviderQuotaResult>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({
            provider: providerSlugForAdapterType(adapterType),
            ok: false,
            error: `quota polling timed out after ${Math.round(QUOTA_PROVIDER_TIMEOUT_MS / 1000)}s`,
            windows: [],
          });
        }, QUOTA_PROVIDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
