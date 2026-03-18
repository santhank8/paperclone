/**
 * Test MEV regime module in isolation (no DB, no AI).
 * Run: npx tsx scripts/test-mev-regime.ts
 * Exits with code 1 if any assertion fails.
 */

import {
  realizedVolatility,
  volatilityRegime,
  volOfVol,
  spreadOrPriceInstability,
  detectRapidRegimeChange,
  computeRegimeContext,
} from '../lib/mev-regime';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error('Assertion failed:', message);
    process.exit(1);
  }
}

function main() {
  console.log('=== MEV Regime Module Tests ===\n');
  let passed = 0;

  // 1. Empty series -> safe defaults
  const empty = computeRegimeContext([]);
  assert(empty.regime === 'unknown', `empty.regime expected 'unknown', got ${empty.regime}`);
  assert(empty.instability === 0, `empty.instability expected 0, got ${empty.instability}`);
  assert(empty.rapidRegimeChange === false, `empty.rapidRegimeChange expected false`);
  console.log('1. Empty series: OK');
  passed++;

  // 2. Single price -> no returns, still safe
  const single = computeRegimeContext([100]);
  assert(single.regime === 'unknown', `single.regime expected 'unknown', got ${single.regime}`);
  assert(single.instability === 0, `single.instability expected 0, got ${single.instability}`);
  console.log('2. Single price [100]: OK');
  passed++;

  // 3. Calm: low vol series -> calm or normal (not volatile)
  const calmPrices = [100, 100.2, 99.9, 100.1, 100, 99.95, 100.05, 100, 100.1, 99.9];
  const calmCtx = computeRegimeContext(calmPrices);
  assert(
    calmCtx.regime === 'calm' || calmCtx.regime === 'normal',
    `calm prices: expected calm or normal, got ${calmCtx.regime} (realizedVol=${calmCtx.realizedVol})`
  );
  assert(calmCtx.realizedVol < 0.35, `calm: realizedVol should be < 0.35, got ${calmCtx.realizedVol}`);
  console.log('3. Calm prices: OK', `(regime=${calmCtx.regime}, realizedVol=${calmCtx.realizedVol.toFixed(4)})`);
  passed++;

  // 4. Volatile: big swings -> volatile or normal (not calm)
  const volatilePrices = [100, 108, 95, 102, 92, 98, 110, 97, 105, 90];
  const volCtx = computeRegimeContext(volatilePrices);
  assert(
    volCtx.regime === 'volatile' || volCtx.regime === 'normal',
    `volatile prices: expected volatile or normal, got ${volCtx.regime} (realizedVol=${volCtx.realizedVol})`
  );
  assert(volCtx.realizedVol > 0.15, `volatile: realizedVol should be > 0.15, got ${volCtx.realizedVol}`);
  console.log('4. Volatile prices: OK', `(regime=${volCtx.regime}, realizedVol=${volCtx.realizedVol.toFixed(4)})`);
  passed++;

  // 5. Rapid regime change
  const rapidChange = detectRapidRegimeChange([0, 0, 1, 1, 2]);
  assert(rapidChange === true, `rapidRegimeChange([0,0,1,1,2]) expected true, got ${rapidChange}`);
  assert(detectRapidRegimeChange([1, 1, 1]) === false, `[1,1,1] should have no rapid change`);
  console.log('5. Rapid regime change: OK');
  passed++;

  // 6. Standalone: volatilityRegime thresholds (CRCA-Q: low=0.15, high=0.35)
  assert(volatilityRegime(0.1) === 'calm', `volatilityRegime(0.1) expected calm`);
  assert(volatilityRegime(0.25) === 'normal', `volatilityRegime(0.25) expected normal`);
  assert(volatilityRegime(0.4) === 'volatile', `volatilityRegime(0.4) expected volatile`);
  assert(volatilityRegime(NaN) === 'unknown', `volatilityRegime(NaN) expected unknown`);
  console.log('6. volatilityRegime thresholds: OK');
  passed++;

  // 7. spreadOrPriceInstability: erratic series has high instability; insufficient data returns 0
  const unstable = spreadOrPriceInstability([1, 1.1, 0.9, 1.2, 0.85], 4);
  assert(unstable > 0.5, `instability for erratic series expected > 0.5, got ${unstable}`);
  assert(spreadOrPriceInstability([], 10) === 0, `empty series should yield instability 0`);
  assert(spreadOrPriceInstability([1, 2], 20) === 0, `short series should yield instability 0`);
  console.log('7. spreadOrPriceInstability: OK');
  passed++;

  console.log(`\n=== All ${passed} tests passed. ===`);
}

main();
