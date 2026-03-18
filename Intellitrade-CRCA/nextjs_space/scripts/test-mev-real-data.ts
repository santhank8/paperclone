/**
 * Test MEV real data: fetch price history from CoinGecko and compute regime.
 * Run: npx tsx scripts/test-mev-real-data.ts
 * No DB or AI required. Requires network (CoinGecko API).
 */

import { getPriceHistoryForMev } from '../lib/mev-regime-data';
import { computeRegimeContext } from '../lib/mev-regime';

async function main() {
  console.log('=== MEV real data test (CoinGecko price history + regime) ===\n');

  const tokens = ['ETH', 'BTC', 'USDC'];
  for (const token of tokens) {
    console.log(`Token: ${token}`);
    const prices = await getPriceHistoryForMev(token);
    console.log(`  Fetched ${prices.length} price points`);
    if (prices.length >= 5) {
      const ctx = computeRegimeContext(prices);
      console.log(`  Regime: ${ctx.regime}`);
      console.log(`  Realized vol: ${ctx.realizedVol.toFixed(4)}`);
      console.log(`  Instability: ${ctx.instability.toFixed(4)}`);
      console.log(`  Rapid regime change: ${ctx.rapidRegimeChange}`);
    } else {
      console.log('  (not enough data for regime)');
    }
    console.log('');
  }

  console.log('Done. In a real MEV cycle, spread cache also fills over time for each token.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
