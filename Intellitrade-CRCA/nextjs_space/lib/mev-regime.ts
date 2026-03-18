/**
 * MEV Regime and Instability Module
 *
 * Minimal port of CRCA-Q regime/volatility concepts for MEV bot:
 * - Realized volatility, volatility regime (calm/normal/volatile)
 * - Vol-of-vol, spread/price instability, rapid regime change
 *
 * Volatility regime thresholds from CRCA-Q RegimeDetector (detect_volatility_regime).
 * All functions tolerate empty/short arrays and return safe defaults.
 */

export type VolatilityRegime = 'calm' | 'normal' | 'volatile' | 'unknown';

const DEFAULT_REGIME_THRESHOLDS = { low: 0.15, high: 0.35 };
const ANNUALIZATION_FACTOR = Math.sqrt(365); // daily data -> annualized vol

/**
 * Compute simple returns from price series (p[t]/p[t-1] - 1).
 * If array length < 2, returns [].
 */
function priceSeriesToReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev === 0) returns.push(0);
    else returns.push((prices[i] - prev) / prev);
  }
  return returns;
}

/**
 * Realized volatility (annualized): std of returns * sqrt(365).
 * Input: array of prices (then we compute returns) or returns if isReturns=true.
 * Returns 0 for insufficient data.
 */
export function realizedVolatility(
  pricesOrReturns: number[],
  window?: number,
  isReturns?: boolean
): number {
  if (pricesOrReturns.length < 2) return 0;
  const returns = isReturns ? pricesOrReturns : priceSeriesToReturns(pricesOrReturns);
  if (returns.length < 2) return 0;

  const useWindow = window ?? returns.length;
  const start = Math.max(0, returns.length - useWindow);
  const slice = returns.slice(start);
  const n = slice.length;
  if (n < 2) return 0;

  const mean = slice.reduce((a, b) => a + b, 0) / n;
  const variance =
    slice.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (n - 1) || 0;
  const vol = Math.sqrt(variance) * ANNUALIZATION_FACTOR;
  return Number.isFinite(vol) ? vol : 0;
}

/**
 * Volatility regime from realized vol. Thresholds from CRCA-Q RegimeDetector.
 * calm: vol < low, normal: low <= vol < high, volatile: vol >= high.
 */
export function volatilityRegime(
  realizedVol: number,
  thresholds?: { low: number; high: number }
): VolatilityRegime {
  const { low, high } = thresholds ?? DEFAULT_REGIME_THRESHOLDS;
  if (!Number.isFinite(realizedVol) || realizedVol < 0) return 'unknown';
  if (realizedVol < low) return 'calm';
  if (realizedVol >= high) return 'volatile';
  return 'normal';
}

/**
 * Vol-of-vol: rolling std of realized volatility. Returns last value or 0 if not enough data.
 * Uses window-sized rolling realized vol, then std of that series.
 */
export function volOfVol(returns: number[], window: number = 20): number {
  if (returns.length < window + 1) return 0;
  const rvSeries: number[] = [];
  for (let i = window; i <= returns.length; i++) {
    const slice = returns.slice(i - window, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (slice.length - 1) ||
      0;
    rvSeries.push(Math.sqrt(variance));
  }
  if (rvSeries.length < 2) return 0;
  const meanRv = rvSeries.reduce((a, b) => a + b, 0) / rvSeries.length;
  const varRv =
    rvSeries.reduce((sum, r) => sum + (r - meanRv) ** 2, 0) /
    (rvSeries.length - 1);
  const vov = Math.sqrt(varRv);
  return Number.isFinite(vov) ? vov : 0;
}

/**
 * Spread/price instability: normalized measure of recent variability.
 * High value = unstable. Uses a level-based floor so calm (tiny meanAbs) series don't saturate at 1.
 */
export function spreadOrPriceInstability(
  series: number[],
  window: number = 20
): number {
  if (series.length < window + 1) return 0;
  const recent = series.slice(-window);
  const changes: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    changes.push(prev === 0 ? 0 : (recent[i] - prev) / prev);
  }
  if (changes.length < 2) return 0;
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance =
    changes.reduce((sum, c) => sum + (c - mean) ** 2, 0) / (changes.length - 1) ||
    0;
  const std = Math.sqrt(variance);
  const meanAbs = changes.reduce((a, b) => a + Math.abs(b), 0) / changes.length;
  const level = recent.reduce((a, b) => a + b, 0) / recent.length;
  const floor = level > 0 ? level * 1e-3 : 1e-6;
  const scale = meanAbs + floor;
  if (scale < 1e-12) return 0;
  return Number.isFinite(std / scale) ? Math.min(1, std / scale) : 0;
}

/**
 * Detect rapid regime change: true if last regime value differs from previous.
 * regimeSeries is 0/1/2 (e.g. from volatility_regime quantile series). Need at least 2 points.
 */
export function detectRapidRegimeChange(
  regimeSeries: (0 | 1 | 2)[]
): boolean {
  if (regimeSeries.length < 2) return false;
  const last = regimeSeries[regimeSeries.length - 1];
  const prev = regimeSeries[regimeSeries.length - 2];
  return last !== prev;
}

/**
 * Build regime context from a price or spread series (optional).
 * When series is empty/short, returns safe defaults: regime 'unknown', instability 0, no hard-skip.
 */
export interface RegimeContext {
  regime: VolatilityRegime;
  realizedVol: number;
  volOfVol: number;
  instability: number;
  rapidRegimeChange: boolean;
}

export function computeRegimeContext(
  priceOrSpreadSeries: number[],
  options?: { window?: number; volWindow?: number }
): RegimeContext {
  const window = options?.window ?? 20;
  const volWindow = options?.volWindow ?? 20;

  if (priceOrSpreadSeries.length < 2) {
    return {
      regime: 'unknown',
      realizedVol: 0,
      volOfVol: 0,
      instability: 0,
      rapidRegimeChange: false,
    };
  }

  const returns = priceSeriesToReturns(priceOrSpreadSeries);
  const rv = realizedVolatility(priceOrSpreadSeries, volWindow);
  const regime = volatilityRegime(rv);
  const vov = volOfVol(returns, window);
  const instability = spreadOrPriceInstability(priceOrSpreadSeries, window);

  const rvRolling: number[] = [];
  for (let i = window; i <= returns.length; i++) {
    const slice = returns.slice(i - window, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (slice.length - 1) ||
      0;
    rvRolling.push(Math.sqrt(variance));
  }
  const regimeSeries: (0 | 1 | 2)[] = rvRolling.map((vol) => {
    const r = volatilityRegime(vol * ANNUALIZATION_FACTOR);
    if (r === 'calm') return 0;
    if (r === 'volatile') return 2;
    return 1;
  });
  const rapidRegimeChange = detectRapidRegimeChange(regimeSeries);

  return {
    regime,
    realizedVol: Number.isFinite(rv) ? rv : 0,
    volOfVol: vov,
    instability,
    rapidRegimeChange,
  };
}
