from enum import Enum


class ExecutionMode(str, Enum):
    """How the legacy execution engine may place orders."""

    disabled = "disabled"  # demo / analysis only; no live ccxt trading
    paper = "paper"  # dry_run execution path (testnet-style; no live_trading_mode)
    live = "live"  # real orders when keys present (high risk)
