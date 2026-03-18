"""Single entry: run_cycle maps ExecutionMode to legacy QuantTradingAgent."""

from __future__ import annotations

import asyncio
import os
import traceback
from typing import Any

from crca_q.execution.mode import ExecutionMode
from crca_q.legacy_loader import load_crca_q_branch_module
from crca_q.schemas import AssetDecisionOut, RunInput, RunOutput


def _map_legacy_result_to_output(
    result: dict[str, Any],
    inp: RunInput,
    mode: ExecutionMode,
) -> RunOutput:
    decisions: list[AssetDecisionOut] = []
    if result.get("error"):
        return RunOutput(
            ok=False,
            execution_mode=mode.value,
            heartbeat_run_id=inp.heartbeat_run_id,
            issue_id=inp.issue_id,
            error=str(result["error"]),
            summary={"keys": list(result.keys())},
        )
    batched = result.get("batched_results") or []
    if batched:
        for batch in batched:
            decs = batch.get("decisions") or {}
            for sym, d in decs.items():
                if not isinstance(d, dict):
                    continue
                decisions.append(
                    AssetDecisionOut(
                        symbol=str(sym),
                        signal=str(d.get("signal", "HOLD")),
                        confidence=float(d.get("confidence") or 0),
                        causal_score=d.get("causal_score"),
                        causal_block=bool(d.get("causal_block")),
                    )
                )
    else:
        decisions.append(
            AssetDecisionOut(
                symbol=str(result.get("symbol") or "single"),
                signal=str(result.get("signal", "HOLD")),
                confidence=float(result.get("confidence") or 0),
                causal_score=result.get("causal_score"),
                causal_block=bool(result.get("causal_block")),
            )
        )
    return RunOutput(
        ok=True,
        execution_mode=mode.value,
        heartbeat_run_id=inp.heartbeat_run_id,
        issue_id=inp.issue_id,
        summary={
            "signal": result.get("signal"),
            "regime": result.get("regime"),
            "total_trades": result.get("total_trades"),
        },
        decisions=decisions,
    )


async def run_cycle(inp: RunInput, execution_mode: ExecutionMode | None = None) -> RunOutput:
    if execution_mode is None:
        raw = os.environ.get("CRCA_Q_EXECUTION_MODE", "disabled").strip().lower()
        try:
            execution_mode = ExecutionMode(raw)
        except ValueError:
            execution_mode = ExecutionMode.disabled
    mode_str = execution_mode.value

    live = execution_mode == ExecutionMode.live
    demo = execution_mode == ExecutionMode.disabled

    try:
        mod = load_crca_q_branch_module()
        Q = mod.QuantTradingAgent
    except Exception as e:
        return RunOutput(
            ok=False,
            execution_mode=mode_str,
            heartbeat_run_id=inp.heartbeat_run_id,
            issue_id=inp.issue_id,
            error=f"legacy_load_failed: {e}",
        )

    assets = None
    if inp.symbols:
        assets = [{"symbol": s, "type": "crypto"} for s in inp.symbols]

    try:
        agent = Q(
            days_back=inp.days_back,
            demo_mode=demo,
            live_trading_mode=live,
            longterm_mode=False,
            assets=assets,
        )
    except Exception as e:
        return RunOutput(
            ok=False,
            execution_mode=mode_str,
            heartbeat_run_id=inp.heartbeat_run_id,
            issue_id=inp.issue_id,
            error=f"agent_init: {e}\n{traceback.format_exc()[-4000:]}",
        )

    try:
        result = await agent.run(incremental=False)
    except Exception as e:
        return RunOutput(
            ok=False,
            execution_mode=mode_str,
            heartbeat_run_id=inp.heartbeat_run_id,
            issue_id=inp.issue_id,
            error=f"agent_run: {e}\n{traceback.format_exc()[-4000:]}",
        )

    if not isinstance(result, dict):
        return RunOutput(
            ok=False,
            execution_mode=mode_str,
            heartbeat_run_id=inp.heartbeat_run_id,
            issue_id=inp.issue_id,
            error="agent_run returned non-dict",
        )

    return _map_legacy_result_to_output(result, inp, execution_mode)


def run_cycle_sync(inp: RunInput, execution_mode: ExecutionMode | None = None) -> RunOutput:
    return asyncio.run(run_cycle(inp, execution_mode))
