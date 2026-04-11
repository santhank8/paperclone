"""Unit tests for WF1 risk and workflow-scope classification."""

from src.risk import classify_pr_risk, select_test_workflows


class TestClassifyPrRisk:
    def test_returns_protected_for_protected_paths(self) -> None:
        changed = ["docs/specs/ARCHITECTURE.md", "services/pnl-service/main.py"]
        assert classify_pr_risk(changed) == "protected"

    def test_returns_high_risk_for_auth_paths(self) -> None:
        changed = ["services/agent-runner/auth_service.py"]
        assert classify_pr_risk(changed) == "high_risk"

    def test_returns_high_risk_for_tenant_paths(self) -> None:
        changed = ["services/market-data-api/tenant_config.py"]
        assert classify_pr_risk(changed) == "high_risk"

    def test_returns_high_risk_for_migration_paths(self) -> None:
        changed = ["services/pnl-service/migrations/20260316_add_index.sql"]
        assert classify_pr_risk(changed) == "high_risk"

    def test_returns_normal_for_unmatched_paths(self) -> None:
        changed = ["agent-workforce/src/graph.py", "README.md"]
        assert classify_pr_risk(changed) == "normal"


class TestSelectTestWorkflows:
    def test_workforce_only_runs_workforce_workflow(self) -> None:
        changed = ["agent-workforce/src/graph.py", "agent-workforce/tests/unit/test_graph_routing.py"]
        assert select_test_workflows(changed) == ["test-workforce.yml"]

    def test_platform_only_runs_platform_workflow(self) -> None:
        changed = ["services/pnl-service/main.py", "frontend/src/App.tsx"]
        assert select_test_workflows(changed) == ["run-tests.yml"]

    def test_mixed_runs_both_workflows(self) -> None:
        changed = ["agent-workforce/src/graph.py", "services/pnl-service/main.py"]
        assert select_test_workflows(changed) == [
            "run-tests.yml",
            "test-workforce.yml",
        ]
