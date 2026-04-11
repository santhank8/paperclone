"""Regression tests for protected-path governance alignment."""

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
CODEOWNERS = REPO_ROOT / ".github" / "CODEOWNERS"
PROTECTED_PATHS_WORKFLOW = (
    REPO_ROOT / ".github" / "workflows" / "protected-paths-check.yml"
)


class TestCodeownersGovernance:
    def test_codeowners_protects_specs(self) -> None:
        content = CODEOWNERS.read_text(encoding="utf-8")

        assert "docs/specs/*" in content

    def test_codeowners_does_not_protect_agent_workforce(self) -> None:
        content = CODEOWNERS.read_text(encoding="utf-8")

        assert "agent-workforce/**" not in content


class TestProtectedPathsWorkflow:
    def test_workflow_protects_specs(self) -> None:
        content = PROTECTED_PATHS_WORKFLOW.read_text(encoding="utf-8")

        assert 'docs/specs' in content

    def test_workflow_does_not_protect_agent_workforce(self) -> None:
        content = PROTECTED_PATHS_WORKFLOW.read_text(encoding="utf-8")

        assert "agent-workforce" not in content
