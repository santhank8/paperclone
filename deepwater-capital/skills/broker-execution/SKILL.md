---
name: broker-execution
description: Execute trades through the Deepwater broker plugin. Provides tools for placing orders, managing positions, checking stops/targets, and getting quotes via Alpaca.
---

# Broker Execution

You have access to broker execution tools provided by the `deepwater.broker-execution` plugin. These tools connect to Alpaca's trading API (paper or live mode).

## Available Tools

### `deepwater.broker-execution.place-order`

Place a buy or sell order. The plugin enforces risk limits before submitting to the broker.

Parameters:
```json
{
  "symbol": "SPY",
  "side": "buy",
  "qty": 10,
  "type": "limit",
  "limitPrice": 645.00,
  "stopPrice": 634.00,
  "signalStrength": "buy",
  "signalComposite": 5.6,
  "thesis": "RSI oversold bounce at major support with macro tailwind"
}
```

The plugin will:
1. Check pre-trade risk (position size, drawdown, cash, correlation)
2. If risk check fails, return the reason and max allowed qty
3. If risk check passes, submit to broker and track stop/target levels
4. Return the order ID and fill status

### `deepwater.broker-execution.get-positions`

Get all open positions with current prices and P&L. No parameters needed.

### `deepwater.broker-execution.get-portfolio`

Get portfolio summary: equity, cash, buying power, position count, total unrealized P&L.

### `deepwater.broker-execution.get-quote`

Get the latest bid/ask/mid price for a symbol.

Parameters:
```json
{
  "symbol": "SPY",
  "assetClass": "stock"
}
```
Use `"assetClass": "crypto"` for crypto symbols like `BTC/USD`.

### `deepwater.broker-execution.close-position`

Close an entire position at market price.

Parameters:
```json
{
  "symbol": "SPY",
  "reason": "stop_hit"
}
```

Valid reasons: `stop_hit`, `target_hit`, `time_stop`, `manual`, `forced_derisk`

### `deepwater.broker-execution.cancel-order`

Cancel a pending order by ID.

Parameters:
```json
{
  "orderId": "order-uuid-here"
}
```

### `deepwater.broker-execution.check-stops`

Check all tracked positions against their stop-loss and take-profit levels. Returns alerts for any positions that need action. No parameters needed.

**Call this at the start of every scan cycle** before running the MoE analysis.

## Trade Execution Workflow

On each scan cycle:

1. **Check stops first** — call `check-stops` to see if any existing positions hit stop or target
2. **Close triggered positions** — call `close-position` for any stops/targets that fired
3. **Run the MoE scan** — get expert scores and apply gating function
4. **Get quotes** — call `get-quote` for any signal candidates
5. **Place orders** — call `place-order` for signals passing the gate
6. **Review portfolio** — call `get-portfolio` at end of cycle

## Risk Enforcement

The plugin enforces these rules automatically — you do NOT need to calculate them:

- Max 5% of portfolio per position
- Max 2% portfolio risk per trade
- Drawdown controls: -5% reduce, -10% halt, -15% de-risk, -20% full risk-off
- Cash availability check
- All trades are logged and audited
