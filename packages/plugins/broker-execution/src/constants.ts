export const PLUGIN_ID = "deepwater.broker-execution";

export const TOOL_NAMES = {
  PLACE_ORDER: "place-order",
  CANCEL_ORDER: "cancel-order",
  GET_POSITIONS: "get-positions",
  GET_PORTFOLIO: "get-portfolio",
  GET_QUOTE: "get-quote",
  CHECK_STOPS: "check-stops",
  CLOSE_POSITION: "close-position",
} as const;

export const JOB_KEYS = {
  RECONCILE_POSITIONS: "reconcile-positions",
} as const;

export const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets";
export const ALPACA_LIVE_BASE = "https://api.alpaca.markets";
export const ALPACA_DATA_BASE = "https://data.alpaca.markets";
