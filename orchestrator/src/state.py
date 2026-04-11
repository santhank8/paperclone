"""SDLCState — shared memory for the LangGraph workflow.

Spec ref: AgenticSquad_Functional_Spec v2.8 RC §10
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SDLCState:
    """Shared state passed between all LangGraph nodes."""

    # Story context
    current_issue_number: Optional[int] = None
    current_issue_body: str = ""
    current_issue_labels: list[str] = field(default_factory=list)

    # Code Operator state
    job_execution_id: Optional[str] = None
    pr_number: Optional[int] = None
    pr_url: str = ""
    pr_diff: str = ""
    pr_changed_files: list[str] = field(default_factory=list)
    pr_risk_tier: str = "normal"
    retry_count: int = 0
    max_retries: int = 3

    # Architect state (WF1)
    architect_review_passed: Optional[bool] = None
    architect_review_report: str = ""

    # Test Lead state (Phase 2)
    test_workflow_run_id: Optional[int] = None
    test_workflow_run_ids: list[int] = field(default_factory=list)
    test_passed: bool = False
    ac_compliance: dict = field(default_factory=dict)
    test_failure_report: str = ""

    # Infra Lead / deployment state (WF2)
    deploy_environment: str = "dev"
    deploy_workflow_run_id: Optional[int] = None
    deploy_status: str = "pending"
    health_verified: bool = False
    deploy_evidence: dict = field(default_factory=dict)

    # Orchestration
    workflow_stage: str = "idle"
    human_decision: str = ""
    messages: list = field(default_factory=list)

    # Cost tracking (§13.4)
    cost_tracker: dict = field(default_factory=dict)

    # Budget enforcement (TRA-28)
    budget_alerts_sent: list[float] = field(default_factory=list)

    # Error tracking (§14.3)
    error_context: dict = field(default_factory=dict)

    # Project config
    project_config: dict = field(default_factory=dict)

    # Document registry (TRA-27) — loaded at startup, persona-filtered per node
    document_registry: dict = field(default_factory=dict)
    allowed_documents: list[str] = field(default_factory=list)

    # PO state (TRA-25)
    planning_direction: str = ""

    # Linear sync (TRA-26)
    linear_issue_id: str = ""

    # Intervention (WF4 — TRA-56/57/58)
    paused: bool = False
    active_job_run_id: Optional[str] = None

    # KPI tracking (WF4 — TRA-63)
    story_started_at: Optional[str] = None

    # Ad-hoc query routing (TRA-91)
    infra_query: str = ""

    # Active story thread tracking (persisted in lobby thread checkpoint)
    active_story_thread_id: Optional[str] = None
