import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID, TOOL_NAMES, JOB_KEYS } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Deepwater Broker Execution",
  description: "Routes trade signals to broker APIs (Alpaca paper/live) with pre-trade risk enforcement, position tracking, and audit logging",
  author: "Deepwater Capital",
  categories: ["automation", "connector"],

  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "plugin.state.read",
    "plugin.state.write",
    "agent.tools.register",
    "events.subscribe",
    "issues.read",
    "activity.log.write",
  ],

  entrypoints: {
    worker: "./dist/worker.js",
  },

  instanceConfigSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        title: "Trading Mode",
        description: "Paper or live trading",
        enum: ["paper", "live"],
        default: "paper",
      },
      alpacaApiKeyRef: {
        type: "string",
        title: "Alpaca API Key (secret ref)",
        description: "Paperclip secret reference for Alpaca API key",
      },
      alpacaApiSecretRef: {
        type: "string",
        title: "Alpaca API Secret (secret ref)",
        description: "Paperclip secret reference for Alpaca API secret",
      },
    },
    required: ["mode", "alpacaApiKeyRef", "alpacaApiSecretRef"],
  },

  jobs: [
    {
      jobKey: JOB_KEYS.RECONCILE_POSITIONS,
      displayName: "Reconcile Positions",
      description: "Fetch live broker positions and reconcile with plugin state every 15 minutes",
      schedule: "*/15 * * * *",
    },
  ],

  tools: [
    {
      name: TOOL_NAMES.PLACE_ORDER,
      displayName: "Place Order",
      description: "Place a buy or sell order through the broker. Enforces risk limits before submission.",
      parametersSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Ticker symbol (e.g., SPY, AAPL, BTC/USD)" },
          side: { type: "string", enum: ["buy", "sell"], description: "Buy or sell" },
          qty: { type: "number", description: "Number of shares/units" },
          type: { type: "string", enum: ["market", "limit", "stop", "stop_limit"], description: "Order type" },
          limitPrice: { type: "number", description: "Limit price (for limit/stop_limit orders)" },
          stopPrice: { type: "number", description: "Stop price (for stop/stop_limit orders)" },
          signalStrength: { type: "string", enum: ["strong_buy", "buy", "lean_buy", "forced"], description: "MoE signal classification" },
          signalComposite: { type: "number", description: "MoE composite score" },
          thesis: { type: "string", description: "Trade thesis from the signal generator" },
        },
        required: ["symbol", "side", "qty", "type"],
      },
    },
    {
      name: TOOL_NAMES.CANCEL_ORDER,
      displayName: "Cancel Order",
      description: "Cancel a pending order by order ID",
      parametersSchema: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "Broker order ID to cancel" },
        },
        required: ["orderId"],
      },
    },
    {
      name: TOOL_NAMES.GET_POSITIONS,
      displayName: "Get Positions",
      description: "Get all open positions with current P&L",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: TOOL_NAMES.GET_PORTFOLIO,
      displayName: "Get Portfolio",
      description: "Get portfolio summary: equity, cash, buying power, total P&L",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: TOOL_NAMES.GET_QUOTE,
      displayName: "Get Quote",
      description: "Get the latest quote (bid/ask/last) for a symbol",
      parametersSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Ticker symbol" },
          assetClass: { type: "string", enum: ["stock", "crypto"], description: "Asset class for routing" },
        },
        required: ["symbol"],
      },
    },
    {
      name: TOOL_NAMES.CLOSE_POSITION,
      displayName: "Close Position",
      description: "Close an entire position in a symbol (market order)",
      parametersSchema: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Ticker symbol to close" },
          reason: { type: "string", description: "Reason for closing (stop_hit, target_hit, time_stop, manual)" },
        },
        required: ["symbol"],
      },
    },
    {
      name: TOOL_NAMES.CHECK_STOPS,
      displayName: "Check Stops & Targets",
      description: "Check all open positions against their stop-loss and take-profit levels. Returns any positions that need action.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
