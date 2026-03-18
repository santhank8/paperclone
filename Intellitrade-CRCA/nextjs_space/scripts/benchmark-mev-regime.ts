/**
 * MEV Regime Benchmark: Model 1 (with CRCA-Q regime) vs Model 2 (no regime), both on real data.
 * Uses the real LLM (scoreOpportunityWithAI). Iterations = trading rotations (full cycles).
 *
 * Each rotation: detect opportunities (real) → for each opportunity, call LLM twice:
 *   Model 1: real series → Gate 1 + regime in context → AI decision
 *   Model 2: no Gate 1, no regime in context → AI decision
 * No real execution. Outcome = future price after delay (would the trade have been profitable).
 *
 * Run: npx tsx scripts/benchmark-mev-regime.ts [rotations] [futureDelayMinutes]
 * Example: npx tsx scripts/benchmark-mev-regime.ts 5 2
 * Requires: DB with at least one MEV_BOT agent, and API keys for the agent's AI provider.
 */

import { prisma } from '../lib/db';
import {
  detectArbitrageOpportunities,
  scoreOpportunityWithAI,
  MEV_REGIME_CONFIG,
  MEV_CONFIG,
  type MEVMarketContext,
  type MEVOpportunity,
  type ArbitrageOpportunity,
} from '../lib/mev-bot-trading';
import { getSeriesForRegime } from '../lib/mev-regime-data';
import { computeRegimeContext } from '../lib/mev-regime';
import type { AIProvider } from '../lib/ai-providers';
import { getCurrentPrice } from '../lib/oneinch';

const GAS_COST_USD = 50;
const TOKENS = ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC'];
const OPPORTUNITIES_PER_ROTATION = 3;
const ROTATION_DELAY_MS = 15_000;

function buildContextWithRegime(
  opportunity: ArbitrageOpportunity,
  regimeContext: ReturnType<typeof computeRegimeContext>,
  baseGas: number,
  baseMempool: number
): MEVMarketContext {
  const volatility = regimeContext.realizedVol > 0 ? regimeContext.realizedVol : 0.05;
  return {
    volatility,
    gasPrice: baseGas,
    mempoolSize: baseMempool,
    regime: regimeContext.regime,
    instability: regimeContext.instability,
    volOfVol: regimeContext.volOfVol,
    rapidRegimeChange: regimeContext.rapidRegimeChange,
    realizedVol: regimeContext.realizedVol,
  };
}

function buildContextNoRegime(baseGas: number, baseMempool: number): MEVMarketContext {
  return {
    volatility: 0.05,
    gasPrice: baseGas,
    mempoolSize: baseMempool,
  };
}

function toMEVOpportunity(opp: ArbitrageOpportunity): MEVOpportunity {
  return {
    type: 'arbitrage',
    token: opp.token,
    estimatedProfit: opp.estimatedProfit,
    profitPercentage: opp.spread,
    gasEstimate: 50,
    confidence: 0.75,
    data: opp,
    timestamp: new Date(),
  };
}

async function runBenchmark(rotations: number, futureDelayMinutes: number) {
  console.log('\n=== MEV Regime Benchmark (with LLM) ===');
  console.log('Model 1: Real data + CRCA-Q regime (Gate 1 + regime in AI context)');
  console.log('Model 2: Real data only (no Gate 1, no regime in context)\n');
  console.log(`Rotations: ${rotations} | Future delay: ${futureDelayMinutes} min\n`);

  const agent = await prisma.aIAgent.findFirst({
    where: { strategyType: 'MEV_BOT', isActive: true },
  });
  if (!agent) {
    console.error('No MEV_BOT agent found. Run: npx tsx scripts/update-agents-to-mev.ts');
    process.exit(1);
  }
  const aiProvider = agent.aiProvider as AIProvider;
  console.log(`Using agent: ${agent.name} (${aiProvider})\n`);

  let m1Executed = 0,
    m1SkippedGate1 = 0,
    m1Wins = 0,
    m1Losses = 0,
    m1Pnl = 0;
  let m2Executed = 0,
    m2Wins = 0,
    m2Losses = 0,
    m2Pnl = 0;

  const baseGas = 30;
  const baseMempool = 500;
  const futureDelayMs = futureDelayMinutes * 60 * 1000;

  for (let r = 0; r < rotations; r++) {
    console.log(`--- Rotation ${r + 1}/${rotations} ---`);
    const opportunities = await detectArbitrageOpportunities(TOKENS);
    if (opportunities.length === 0) {
      console.log('  No opportunities this rotation.\n');
      if (r < rotations - 1) await new Promise((res) => setTimeout(res, ROTATION_DELAY_MS));
      continue;
    }
    console.log(`  Opportunities: ${opportunities.length}`);

    for (const opp of opportunities.slice(0, OPPORTUNITIES_PER_ROTATION)) {
      const mevOpp = toMEVOpportunity(opp);
      const priceOrSpreadSeries = await getSeriesForRegime(opp.token, opp.spread, {
        useRealPriceHistory: MEV_REGIME_CONFIG.USE_REAL_PRICE_HISTORY,
      });
      const regimeContext = computeRegimeContext(priceOrSpreadSeries);

      const gate1Skip =
        regimeContext.regime === 'volatile' &&
        (regimeContext.instability >= MEV_REGIME_CONFIG.VOLATILE_REGIME_SKIP_INSTABILITY_THRESHOLD ||
          regimeContext.volOfVol >= MEV_REGIME_CONFIG.VOLATILE_REGIME_SKIP_VOL_OF_VOL_THRESHOLD ||
          regimeContext.rapidRegimeChange);

      let decision1: 'EXECUTE' | 'SKIP' | 'MONITOR';
      if (gate1Skip) {
        decision1 = 'SKIP';
        m1SkippedGate1++;
      } else {
        const ctx1 = buildContextWithRegime(opp, regimeContext, baseGas, baseMempool);
        const res1 = await scoreOpportunityWithAI(mevOpp, aiProvider, ctx1);
        decision1 = res1.recommendation;
      }

      const ctx2 = buildContextNoRegime(baseGas, baseMempool);
      const res2 = await scoreOpportunityWithAI(mevOpp, aiProvider, ctx2);
      const decision2 = res2.recommendation;

      const m1WouldExecute = decision1 === 'EXECUTE';
      const m2WouldExecute = decision2 === 'EXECUTE';

      if (m1WouldExecute) m1Executed++;
      if (m2WouldExecute) m2Executed++;

      if (m1WouldExecute || m2WouldExecute) {
        console.log(`  Wait ${futureDelayMinutes} min for future price...`);
        await new Promise((res) => setTimeout(res, futureDelayMs));
        let futurePrice: number;
        try {
          futurePrice = await getCurrentPrice(opp.token);
        } catch {
          futurePrice = opp.buyPrice;
        }
        const sizeUsd = Math.min(500, MEV_CONFIG.MAX_POSITION_SIZE * 0.5);
        const size = sizeUsd / opp.buyPrice;
        const cost = opp.buyPrice * size + GAS_COST_USD;
        const proceeds = futurePrice * size;
        const pnl = proceeds - cost;
        const win = pnl > 0;

        if (m1WouldExecute) {
          if (win) m1Wins++;
          else m1Losses++;
          m1Pnl += pnl;
        }
        if (m2WouldExecute) {
          if (win) m2Wins++;
          else m2Losses++;
          m2Pnl += pnl;
        }
      }
    }

    if (r < rotations - 1) await new Promise((res) => setTimeout(res, ROTATION_DELAY_MS));
  }

  const m1Total = m1Wins + m1Losses;
  const m2Total = m2Wins + m2Losses;

  console.log('\n--- Model 1 (with CRCA-Q regime) ---');
  console.log(`  Executed (AI): ${m1Executed} | Skipped (Gate 1): ${m1SkippedGate1}`);
  if (m1Total > 0) {
    console.log(`  Wins: ${m1Wins} | Losses: ${m1Losses}`);
    console.log(`  Win rate: ${((m1Wins / m1Total) * 100).toFixed(1)}%`);
    console.log(`  Simulated PnL: $${m1Pnl.toFixed(2)}`);
  }
  console.log('\n--- Model 2 (no regime features) ---');
  console.log(`  Executed (AI): ${m2Executed}`);
  if (m2Total > 0) {
    console.log(`  Wins: ${m2Wins} | Losses: ${m2Losses}`);
    console.log(`  Win rate: ${((m2Wins / m2Total) * 100).toFixed(1)}%`);
    console.log(`  Simulated PnL: $${m2Pnl.toFixed(2)}`);
  }
  if (m1Total > 0 && m2Total > 0) {
    console.log('\n--- Comparison ---');
    const m1Wr = (m1Wins / m1Total) * 100;
    const m2Wr = (m2Wins / m2Total) * 100;
    console.log(`  Win rate diff (M1 - M2): ${(m1Wr - m2Wr).toFixed(1)} pp`);
    console.log(`  PnL diff (M1 - M2): $${(m1Pnl - m2Pnl).toFixed(2)}`);
  }
  console.log('\nDone. No real execution.\n');
}

const rotations = parseInt(process.argv[2] || '3', 10);
const futureDelayMinutes = parseFloat(process.argv[3] || '2');
runBenchmark(rotations, futureDelayMinutes)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
