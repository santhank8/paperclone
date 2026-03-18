from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RunInput(BaseModel):
    """Built from PAPERCLIP_CONTEXT_JSON."""

    company_id: str | None = None
    agent_id: str | None = None
    heartbeat_run_id: str | None = None
    issue_id: str | None = None
    wake_reason: str | None = None
    invocation_source: str | None = None
    task_id: str | None = None
    days_back: int = 30
    symbols: list[str] | None = None
    raw_context: dict[str, Any] = Field(default_factory=dict)

    @staticmethod
    def from_context_dict(ctx: dict[str, Any]) -> RunInput:
        return RunInput(
            company_id=ctx.get("companyId") or ctx.get("company_id"),
            agent_id=ctx.get("agentId") or ctx.get("agent_id"),
            heartbeat_run_id=ctx.get("heartbeatRunId") or ctx.get("heartbeat_run_id"),
            issue_id=ctx.get("issueId") or ctx.get("issue_id"),
            wake_reason=ctx.get("wakeReason") or ctx.get("wake_reason"),
            invocation_source=ctx.get("invocationSource") or ctx.get("invocation_source"),
            task_id=ctx.get("taskId") or ctx.get("task_id"),
            days_back=int(ctx.get("days_back") or 30),
            symbols=ctx.get("symbols") if isinstance(ctx.get("symbols"), list) else None,
            raw_context=ctx,
        )


class AssetDecisionOut(BaseModel):
    symbol: str
    signal: str = "HOLD"
    confidence: float = 0.0
    causal_score: float | None = None
    causal_block: bool = False


class RunOutput(BaseModel):
    ok: bool
    execution_mode: str
    heartbeat_run_id: str | None = None
    issue_id: str | None = None
    error: str | None = None
    summary: dict[str, Any] = Field(default_factory=dict)
    decisions: list[AssetDecisionOut] = Field(default_factory=list)
    comment_posted: bool = False
