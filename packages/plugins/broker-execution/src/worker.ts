import {
  definePlugin,
  runWorker,
  type PluginContext,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import { AlpacaClient } from "./brokers/alpaca.js";
import { PLUGIN_ID, TOOL_NAMES, JOB_KEYS } from "./constants.js";
import { checkPreTradeRisk, calculatePositionSize, type PortfolioState } from "./risk.js";
import type { BrokerOrder } from "./brokers/types.js";

type PluginConfig = {
  mode: "paper" | "live";
  alpacaApiKeyRef: string;
  alpacaApiSecretRef: string;
};

type StopTarget = {
  symbol: string;
  stopPrice: number;
  target1Price: number;
  target2Price: number;
  entryPrice: number;
  qty: number;
  target1Pct: number; // % to exit at target 1 (default 50%)
  signalStrength: string;
  composite: number;
  thesis: string;
  enteredAt: string;
};

async function getAlpacaClient(ctx: PluginContext): Promise<AlpacaClient> {
  const config = (await ctx.config.get()) as PluginConfig;
  const apiKey = await ctx.secrets.resolve(config.alpacaApiKeyRef);
  const apiSecret = await ctx.secrets.resolve(config.alpacaApiSecretRef);
  return new AlpacaClient(apiKey, apiSecret, config.mode === "paper");
}

async function getPortfolioState(ctx: PluginContext, client: AlpacaClient): Promise<PortfolioState> {
  const account = await client.getAccount();
  const positions = await client.getPositions();
  const hwm = await ctx.state.get({ scopeKind: "instance", stateKey: "high-water-mark" });
  const equity = Number(account.equity);
  const highWaterMark = Math.max(equity, Number(hwm) || 100000);

  // Update high water mark if new high
  if (equity > (Number(hwm) || 0)) {
    await ctx.state.set({ scopeKind: "instance", stateKey: "high-water-mark" }, equity);
  }

  return {
    startingCapital: 100000,
    positions,
    equity,
    cash: Number(account.cash),
    highWaterMark,
    dailyOrders: 0,
  };
}

async function getStopTargets(ctx: PluginContext): Promise<StopTarget[]> {
  const raw = await ctx.state.get({ scopeKind: "instance", stateKey: "stop-targets" });
  return (raw as StopTarget[]) || [];
}

async function saveStopTargets(ctx: PluginContext, targets: StopTarget[]): Promise<void> {
  await ctx.state.set({ scopeKind: "instance", stateKey: "stop-targets" }, targets);
}

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    ctx.logger.info("Deepwater Broker Execution plugin starting");

    // --- PLACE ORDER ---
    ctx.tools.register(
      TOOL_NAMES.PLACE_ORDER,
      {
        displayName: "Place Order",
        description: "Place a trade with pre-trade risk enforcement",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params: unknown, runCtx: ToolRunContext) => {
        const p = params as {
          symbol: string;
          side: "buy" | "sell";
          qty: number;
          type: "market" | "limit" | "stop" | "stop_limit";
          limitPrice?: number;
          stopPrice?: number;
          signalStrength?: string;
          signalComposite?: number;
          thesis?: string;
        };

        try {
          const client = await getAlpacaClient(ctx);
          const portfolio = await getPortfolioState(ctx, client);

          // Get current price for risk check
          let estimatedPrice = p.limitPrice || 0;
          if (!estimatedPrice) {
            try {
              const quote = await client.getQuote(p.symbol);
              estimatedPrice = quote.lastPrice;
            } catch {
              return { content: `Cannot get quote for ${p.symbol}. Provide a limitPrice.`, error: "no_quote" };
            }
          }

          // Pre-trade risk check
          const riskCheck = checkPreTradeRisk(
            { symbol: p.symbol, side: p.side, qty: p.qty, type: p.type, timeInForce: "gtc", stopPrice: p.stopPrice },
            portfolio,
            estimatedPrice,
          );

          if (!riskCheck.passed) {
            ctx.logger.warn("Risk check failed", { symbol: p.symbol, reason: riskCheck.reason });
            return {
              content: `RISK CHECK FAILED: ${riskCheck.reason}${riskCheck.maxAllowedQty ? ` Max allowed: ${riskCheck.maxAllowedQty} units.` : ""}`,
              data: { riskCheck },
            };
          }

          // Place the order
          const order: BrokerOrder = {
            symbol: p.symbol,
            side: p.side,
            qty: p.qty,
            type: p.type,
            timeInForce: "gtc",
            limitPrice: p.limitPrice,
            stopPrice: p.stopPrice,
          };

          const result = await client.placeOrder(order);

          // Save stop/target tracking if this is a buy entry
          if (p.side === "buy" && p.stopPrice) {
            const targets = await getStopTargets(ctx);
            targets.push({
              symbol: p.symbol,
              stopPrice: p.stopPrice,
              target1Price: p.limitPrice ? p.limitPrice * 1.05 : estimatedPrice * 1.05,
              target2Price: p.limitPrice ? p.limitPrice * 1.10 : estimatedPrice * 1.10,
              entryPrice: estimatedPrice,
              qty: p.qty,
              target1Pct: 50,
              signalStrength: p.signalStrength || "unknown",
              composite: p.signalComposite || 0,
              thesis: p.thesis || "",
              enteredAt: new Date().toISOString(),
            });
            await saveStopTargets(ctx, targets);
          }

          // Log the trade
          ctx.logger.info("Order placed", {
            orderId: result.id,
            symbol: p.symbol,
            side: p.side,
            qty: p.qty,
            status: result.status,
            signal: p.signalStrength,
            composite: p.signalComposite,
          });

          const notional = p.qty * estimatedPrice;
          return {
            content: `ORDER PLACED ✓\nOrder ID: ${result.id}\nSymbol: ${p.symbol}\nSide: ${p.side}\nQty: ${p.qty}\nType: ${p.type}\nEstimated notional: $${notional.toFixed(2)}\nStatus: ${result.status}\nRisk check: ${riskCheck.reason}`,
            data: { order: result, riskCheck },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.logger.error("Order placement failed", { error: msg, symbol: p.symbol });
          return { content: `ORDER FAILED: ${msg}`, error: msg };
        }
      },
    );

    // --- CANCEL ORDER ---
    ctx.tools.register(
      TOOL_NAMES.CANCEL_ORDER,
      {
        displayName: "Cancel Order",
        description: "Cancel a pending order",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params: unknown) => {
        const p = params as { orderId: string };
        try {
          const client = await getAlpacaClient(ctx);
          await client.cancelOrder(p.orderId);
          return { content: `Order ${p.orderId} cancelled.` };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: `Cancel failed: ${msg}`, error: msg };
        }
      },
    );

    // --- GET POSITIONS ---
    ctx.tools.register(
      TOOL_NAMES.GET_POSITIONS,
      {
        displayName: "Get Positions",
        description: "Get all open positions",
        parametersSchema: { type: "object", properties: {} },
      },
      async () => {
        try {
          const client = await getAlpacaClient(ctx);
          const positions = await client.getPositions();
          if (positions.length === 0) {
            return { content: "No open positions.", data: { positions: [] } };
          }
          const lines = positions.map((p) =>
            `${p.symbol}: ${p.qty} shares @ $${p.avgEntryPrice} | Current: $${p.currentPrice} | P&L: $${p.unrealizedPl} (${(Number(p.unrealizedPlpc) * 100).toFixed(2)}%)`
          );
          return {
            content: `OPEN POSITIONS (${positions.length}):\n${lines.join("\n")}`,
            data: { positions },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: `Failed to get positions: ${msg}`, error: msg };
        }
      },
    );

    // --- GET PORTFOLIO ---
    ctx.tools.register(
      TOOL_NAMES.GET_PORTFOLIO,
      {
        displayName: "Get Portfolio",
        description: "Get portfolio summary",
        parametersSchema: { type: "object", properties: {} },
      },
      async () => {
        try {
          const client = await getAlpacaClient(ctx);
          const account = await client.getAccount();
          const positions = await client.getPositions();
          const totalUnrealizedPl = positions.reduce(
            (sum, p) => sum + Number(p.unrealizedPl), 0
          );
          return {
            content: `PORTFOLIO SUMMARY:\nEquity: $${account.equity}\nCash: $${account.cash}\nBuying Power: $${account.buyingPower}\nPositions: ${positions.length}\nUnrealized P&L: $${totalUnrealizedPl.toFixed(2)}\nMode: ${((await ctx.config.get()) as PluginConfig).mode}`,
            data: { account, positionCount: positions.length, unrealizedPl: totalUnrealizedPl },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: `Failed to get portfolio: ${msg}`, error: msg };
        }
      },
    );

    // --- GET QUOTE ---
    ctx.tools.register(
      TOOL_NAMES.GET_QUOTE,
      {
        displayName: "Get Quote",
        description: "Get latest quote for a symbol",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params: unknown) => {
        const p = params as { symbol: string; assetClass?: string };
        try {
          const client = await getAlpacaClient(ctx);
          const quote = p.assetClass === "crypto"
            ? await client.getCryptoQuote(p.symbol)
            : await client.getQuote(p.symbol);
          return {
            content: `${p.symbol}: Bid $${quote.bidPrice} | Ask $${quote.askPrice} | Mid $${quote.lastPrice.toFixed(4)}`,
            data: { quote },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: `Quote failed: ${msg}`, error: msg };
        }
      },
    );

    // --- CLOSE POSITION ---
    ctx.tools.register(
      TOOL_NAMES.CLOSE_POSITION,
      {
        displayName: "Close Position",
        description: "Close an entire position",
        parametersSchema: { type: "object", properties: {} },
      },
      async (params: unknown) => {
        const p = params as { symbol: string; reason?: string };
        try {
          const client = await getAlpacaClient(ctx);
          const result = await client.closePosition(p.symbol);

          // Remove from stop/target tracking
          const targets = await getStopTargets(ctx);
          const updated = targets.filter((t) => t.symbol !== p.symbol);
          await saveStopTargets(ctx, updated);

          ctx.logger.info("Position closed", { symbol: p.symbol, reason: p.reason });
          return {
            content: `Position ${p.symbol} CLOSED. Reason: ${p.reason || "manual"}. Order status: ${result.status}`,
            data: { result },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: `Close failed: ${msg}`, error: msg };
        }
      },
    );

    // --- CHECK STOPS & TARGETS ---
    ctx.tools.register(
      TOOL_NAMES.CHECK_STOPS,
      {
        displayName: "Check Stops & Targets",
        description: "Check positions against stop-loss and take-profit levels",
        parametersSchema: { type: "object", properties: {} },
      },
      async () => {
        try {
          const client = await getAlpacaClient(ctx);
          const positions = await client.getPositions();
          const targets = await getStopTargets(ctx);
          const alerts: string[] = [];

          for (const target of targets) {
            const position = positions.find((p) => p.symbol === target.symbol);
            if (!position) continue;

            const currentPrice = Number(position.currentPrice);

            if (currentPrice <= target.stopPrice) {
              alerts.push(`STOP HIT: ${target.symbol} at $${currentPrice} (stop: $${target.stopPrice}) — CLOSE IMMEDIATELY`);
            } else if (currentPrice >= target.target1Price) {
              alerts.push(`TARGET 1 HIT: ${target.symbol} at $${currentPrice} (target: $${target.target1Price}) — Exit ${target.target1Pct}%, move stop to breakeven`);
            } else if (currentPrice >= target.target2Price) {
              alerts.push(`TARGET 2 HIT: ${target.symbol} at $${currentPrice} (target: $${target.target2Price}) — Exit remaining position`);
            }
          }

          if (alerts.length === 0) {
            return { content: `All ${targets.length} tracked positions within range. No stops or targets triggered.` };
          }

          return {
            content: `⚠️ ${alerts.length} ALERT(S):\n${alerts.join("\n")}`,
            data: { alerts, targets },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: `Stop check failed: ${msg}`, error: msg };
        }
      },
    );

    // --- RECONCILIATION JOB ---
    ctx.jobs.register(JOB_KEYS.RECONCILE_POSITIONS, async (job) => {
      ctx.logger.info("Running position reconciliation", { runId: job.runId });
      try {
        const client = await getAlpacaClient(ctx);
        const account = await client.getAccount();
        const positions = await client.getPositions();

        await ctx.state.set({ scopeKind: "instance", stateKey: "last-reconciliation" }, {
          timestamp: new Date().toISOString(),
          equity: account.equity,
          cash: account.cash,
          positionCount: positions.length,
          positions: positions.map((p) => ({
            symbol: p.symbol,
            qty: p.qty,
            unrealizedPl: p.unrealizedPl,
          })),
        });

        ctx.logger.info("Reconciliation complete", {
          equity: account.equity,
          positions: positions.length,
        });
      } catch (err) {
        ctx.logger.error("Reconciliation failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    ctx.logger.info("Deepwater Broker Execution plugin ready");
  },

  async onHealth() {
    return { status: "ok" as const, message: "Broker execution plugin operational" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
