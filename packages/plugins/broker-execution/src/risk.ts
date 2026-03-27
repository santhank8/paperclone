import type { BrokerOrder, BrokerPosition, RiskCheck } from "./brokers/types.js";

export interface PortfolioState {
  startingCapital: number;
  positions: BrokerPosition[];
  equity: number;
  cash: number;
  highWaterMark: number;
  dailyOrders: number;
}

const MAX_POSITION_PCT = 0.05; // 5% max per position
const MAX_ASSET_CLASS_PCT = 0.25; // 25% max per asset class
const MAX_RISK_PER_TRADE_PCT = 0.02; // 2% max drawdown per position
const DRAWDOWN_REDUCE_THRESHOLD = 0.05; // -5% = reduce sizing 50%
const DRAWDOWN_HALT_THRESHOLD = 0.10; // -10% = halt new entries
const DRAWDOWN_DERISK_THRESHOLD = 0.15; // -15% = de-risk
const DRAWDOWN_RISKOFF_THRESHOLD = 0.20; // -20% = full risk-off

export function checkPreTradeRisk(
  order: BrokerOrder,
  portfolio: PortfolioState,
  estimatedPrice: number,
): RiskCheck {
  const notional = order.qty * estimatedPrice;
  const portfolioValue = portfolio.equity;

  // Check drawdown controls
  const drawdown = (portfolio.highWaterMark - portfolioValue) / portfolio.highWaterMark;

  if (drawdown >= DRAWDOWN_RISKOFF_THRESHOLD) {
    return { passed: false, reason: `Portfolio drawdown ${(drawdown * 100).toFixed(1)}% exceeds -20% threshold. FULL RISK-OFF — no new entries.` };
  }

  if (drawdown >= DRAWDOWN_HALT_THRESHOLD) {
    return { passed: false, reason: `Portfolio drawdown ${(drawdown * 100).toFixed(1)}% exceeds -10% threshold. HALT — manage existing positions only.` };
  }

  // Check position size limit (5% max)
  const positionPct = notional / portfolioValue;
  if (positionPct > MAX_POSITION_PCT) {
    const maxQty = Math.floor((portfolioValue * MAX_POSITION_PCT) / estimatedPrice);
    return {
      passed: false,
      reason: `Position ${(positionPct * 100).toFixed(1)}% exceeds 5% max. Reduce to ${maxQty} units.`,
      maxAllowedQty: maxQty,
    };
  }

  // Check risk per trade (2% max portfolio risk)
  if (order.stopPrice) {
    const riskPerUnit = Math.abs(estimatedPrice - order.stopPrice);
    const totalRisk = riskPerUnit * order.qty;
    const riskPct = totalRisk / portfolioValue;
    if (riskPct > MAX_RISK_PER_TRADE_PCT) {
      const maxQty = Math.floor((portfolioValue * MAX_RISK_PER_TRADE_PCT) / riskPerUnit);
      return {
        passed: false,
        reason: `Trade risk ${(riskPct * 100).toFixed(1)}% exceeds 2% max. Reduce to ${maxQty} units.`,
        maxAllowedQty: maxQty,
      };
    }
  }

  // Check cash available
  if (notional > portfolio.cash) {
    return { passed: false, reason: `Insufficient cash. Need $${notional.toFixed(2)}, have $${portfolio.cash.toFixed(2)}.` };
  }

  // Apply drawdown sizing reduction
  let sizingNote = "";
  if (drawdown >= DRAWDOWN_REDUCE_THRESHOLD) {
    sizingNote = ` WARNING: Drawdown at ${(drawdown * 100).toFixed(1)}% — position sizes should be reduced by 50%.`;
  }

  return { passed: true, reason: `Risk check passed.${sizingNote}` };
}

export function calculatePositionSize(
  portfolioValue: number,
  entryPrice: number,
  stopPrice: number,
  signalStrength: "strong_buy" | "buy" | "lean_buy" | "forced",
): { qty: number; notional: number; riskAmount: number } {
  const riskBudget = portfolioValue * MAX_RISK_PER_TRADE_PCT;
  const riskPerUnit = Math.abs(entryPrice - stopPrice);

  if (riskPerUnit <= 0) {
    return { qty: 0, notional: 0, riskAmount: 0 };
  }

  let qty = Math.floor(riskBudget / riskPerUnit);

  // Cap at 5% of portfolio
  const maxNotional = portfolioValue * MAX_POSITION_PCT;
  const maxQty = Math.floor(maxNotional / entryPrice);
  qty = Math.min(qty, maxQty);

  // Reduce for lower conviction
  if (signalStrength === "lean_buy") qty = Math.ceil(qty * 0.5);
  if (signalStrength === "forced") qty = Math.ceil(qty * 0.25);

  const notional = qty * entryPrice;
  const riskAmount = qty * riskPerUnit;

  return { qty, notional, riskAmount };
}
