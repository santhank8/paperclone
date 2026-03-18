/**
 * Real data for MEV regime: CoinGecko price history + in-memory spread cache.
 * No dependency on prisma, AI, or trading execution — safe to use from scripts.
 */

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'ethereum',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
};

const SPREAD_CACHE_MAX_LENGTH = 60;
const spreadCache = new Map<string, number[]>();

/**
 * Fetch price history from CoinGecko market_chart (last 1 day).
 * Returns array of prices oldest-to-newest, or [] on error/unsupported token.
 */
export async function getPriceHistoryForMev(token: string): Promise<number[]> {
  const coinId = COINGECKO_IDS[token?.toUpperCase()];
  if (!coinId) return [];
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { prices?: [number, number][] };
    if (!data.prices?.length) return [];
    return data.prices.map((p) => p[1]);
  } catch (e) {
    console.warn(`[MEV] Price history fetch failed for ${token}:`, (e as Error).message);
    return [];
  }
}

/** Append spread to per-token cache. */
export function pushSpreadToCache(token: string, spread: number): void {
  const key = token.toUpperCase();
  let arr = spreadCache.get(key) ?? [];
  arr.push(spread);
  if (arr.length > SPREAD_CACHE_MAX_LENGTH) {
    arr = arr.slice(-SPREAD_CACHE_MAX_LENGTH);
  }
  spreadCache.set(key, arr);
}

export interface GetSeriesForRegimeOptions {
  useRealPriceHistory: boolean;
}

/**
 * Get price or spread series for regime: prefer API price history when enabled, else spread cache.
 */
export async function getSeriesForRegime(
  token: string,
  spread: number,
  options: GetSeriesForRegimeOptions
): Promise<number[]> {
  pushSpreadToCache(token, spread);
  if (options.useRealPriceHistory) {
    const priceHistory = await getPriceHistoryForMev(token);
    if (priceHistory.length >= 5) return priceHistory;
  }
  const spreads = spreadCache.get(token.toUpperCase()) ?? [];
  if (spreads.length >= 5) return spreads;
  return [];
}
