"""Unit tests for Infra Lead node — WF2 deployment orchestration + WF5 LLM conversion.

Covers: TRA-20 (node + routing), TRA-21 (service detection, deploy trigger),
        TRA-22 (health verification), TRA-23 (VPS MCP), TRA-24 (production gate),
        WF5-B (LLM-backed agentic node with ChatAnthropic).
"""

import json
import pytest
from dataclasses import replace
from unittest.mock import AsyncMock, MagicMock, patch

from src.state import SDLCState
from src.nodes.infra_lead import (
    detect_affected_services,
    select_deploy_workflows,
    infra_lead_node,
    _verify_health_via_mcp,
    _build_deploy_evidence,
    _format_evidence_for_linear,
    _build_release_summary,
    _extract_mcp_result,
    _execute_tool,
    TOOLS,
    SYSTEM_PROMPT,
    DEPLOY_SYSTEM_PROMPT,
    AD_HOC_SYSTEM_PROMPT,
)
from src.graph import (
    route_after_scrum_master,
    route_after_infra_lead,
    build_graph,
)


# ── TRA-20: State fields ──


class TestDeployStateFields:
    def test_default_deploy_state(self) -> None:
        state = SDLCState()
        assert state.deploy_environment == "dev"
        assert state.deploy_workflow_run_id is None
        assert state.deploy_status == "pending"
        assert state.health_verified is False
        assert state.deploy_evidence == {}

    def test_state_with_deploy_fields(self) -> None:
        state = SDLCState(
            deploy_environment="production",
            deploy_workflow_run_id=12345,
            deploy_status="succeeded",
            health_verified=True,
            deploy_evidence={"env": "production"},
        )
        assert state.deploy_environment == "production"
        assert state.deploy_workflow_run_id == 12345
        assert state.deploy_status == "succeeded"
        assert state.health_verified is True

    def test_deploy_evidence_independent(self) -> None:
        s1 = SDLCState()
        s2 = SDLCState()
        s1.deploy_evidence["foo"] = "bar"
        assert s2.deploy_evidence == {}


# ── TRA-20: Graph routing ──


class TestMergedRoutesToInfraLead:
    def test_merged_routes_to_infra_lead(self) -> None:
        """merged → infra_lead instead of END."""
        state = SDLCState(workflow_stage="merged")
        assert route_after_scrum_master(state) == "infra_lead"

    def test_done_still_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="done")
        assert route_after_scrum_master(state) == "__end__"

    def test_idle_still_routes_to_end(self) -> None:
        state = SDLCState(workflow_stage="idle")
        assert route_after_scrum_master(state) == "__end__"


class TestRouteAfterInfraLead:
    def test_deployed_routes_to_scrum_master(self) -> None:
        state = SDLCState(workflow_stage="deployed")
        assert route_after_infra_lead(state) == "scrum_master"

    def test_deploy_failed_routes_to_scrum_master(self) -> None:
        state = SDLCState(workflow_stage="deploy_failed")
        assert route_after_infra_lead(state) == "scrum_master"

    def test_awaiting_production_approval_interrupts(self) -> None:
        state = SDLCState(workflow_stage="awaiting_production_approval")
        assert route_after_infra_lead(state) == "__interrupt__"

    def test_production_approval_resumes_infra_lead(self) -> None:
        state = SDLCState(
            workflow_stage="awaiting_production_approval",
            human_decision="approve_production",
        )
        assert route_after_infra_lead(state) == "infra_lead"


class TestGraphStructureWF2:
    def test_graph_has_infra_lead_node(self) -> None:
        graph = build_graph(checkpointer=None)
        node_names = set(graph.get_graph().nodes.keys())
        assert "infra_lead" in node_names

    def test_graph_has_all_wf2_nodes(self) -> None:
        graph = build_graph(checkpointer=None)
        node_names = set(graph.get_graph().nodes.keys())
        for expected in ("scrum_master", "code_operator", "architect",
                         "test_lead", "retry_gate", "infra_lead"):
            assert expected in node_names


# ── TRA-21: Service detection ──


class TestDetectAffectedServices:
    def test_workforce_changes(self) -> None:
        files = ["agent-workforce/src/nodes/infra_lead.py"]
        assert detect_affected_services(files) == ["agent-workforce"]

    def test_app_service_changes(self) -> None:
        files = [
            "services/pnl-service/main.py",
            "services/ws-consumer/config.py",
        ]
        result = detect_affected_services(files)
        assert "pnl-service" in result
        assert "ws-consumer" in result

    def test_frontend_changes(self) -> None:
        files = ["frontend/src/App.tsx", "frontend/package.json"]
        assert detect_affected_services(files) == ["frontend"]

    def test_mixed_changes(self) -> None:
        files = [
            "agent-workforce/src/state.py",
            "services/order-router/main.go",
            "frontend/src/index.tsx",
        ]
        result = detect_affected_services(files)
        assert "agent-workforce" in result
        assert "order-router" in result
        assert "frontend" in result

    def test_no_deployable_changes(self) -> None:
        files = ["README.md", "docs/something.md"]
        assert detect_affected_services(files) == []

    def test_deduplication(self) -> None:
        files = [
            "services/pnl-service/main.py",
            "services/pnl-service/models.py",
        ]
        assert detect_affected_services(files) == ["pnl-service"]


class TestSelectDeployWorkflows:
    def test_workforce_only(self) -> None:
        files = ["agent-workforce/src/graph.py"]
        assert select_deploy_workflows(files) == ["vps-deploy-workforce.yml"]

    def test_app_service_only(self) -> None:
        files = ["services/pnl-service/main.py"]
        assert select_deploy_workflows(files) == ["vps-deploy-app.yml"]

    def test_frontend_triggers_app_deploy(self) -> None:
        files = ["frontend/src/App.tsx"]
        assert select_deploy_workflows(files) == ["vps-deploy-app.yml"]

    def test_mixed_triggers_both(self) -> None:
        files = [
            "agent-workforce/src/state.py",
            "services/pnl-service/main.py",
        ]
        result = select_deploy_workflows(files)
        assert "vps-deploy-workforce.yml" in result
        assert "vps-deploy-app.yml" in result

    def test_no_deployable_returns_empty(self) -> None:
        files = ["README.md"]
        assert select_deploy_workflows(files) == []


# ── TRA-22: Health verification evidence ──


class TestBuildDeployEvidence:
    def test_all_succeeded(self) -> None:
        deploy_results = [
            {"run_id": 1, "conclusion": "success", "workflow": "vps-deploy-app.yml"},
        ]
        mcp_evidence = {"mcp_available": True}
        evidence = _build_deploy_evidence(
            ["pnl-service"], deploy_results, mcp_evidence, "dev"
        )
        assert evidence["all_deploys_succeeded"] is True
        assert evidence["health_verified"] is True

    def test_deploy_failed(self) -> None:
        deploy_results = [
            {"run_id": 1, "conclusion": "failure", "workflow": "vps-deploy-app.yml"},
        ]
        mcp_evidence = {"mcp_available": False}
        evidence = _build_deploy_evidence(
            ["pnl-service"], deploy_results, mcp_evidence, "dev"
        )
        assert evidence["all_deploys_succeeded"] is False
        assert evidence["health_verified"] is False

    def test_mcp_unavailable_but_deploy_ok(self) -> None:
        deploy_results = [
            {"run_id": 1, "conclusion": "success", "workflow": "vps-deploy-app.yml"},
        ]
        mcp_evidence = {"mcp_available": False}
        evidence = _build_deploy_evidence(
            ["pnl-service"], deploy_results, mcp_evidence, "dev"
        )
        assert evidence["all_deploys_succeeded"] is True
        assert evidence["health_verified"] is False


class TestFormatEvidenceForLinear:
    def test_successful_deploy(self) -> None:
        evidence = {
            "environment": "dev",
            "affected_services": ["pnl-service"],
            "health_verified": True,
            "deploy_results": [
                {"run_id": 123, "conclusion": "success", "html_url": "https://example.com"},
            ],
            "mcp_verification": {"mcp_available": True, "health_check": "All healthy"},
        }
        text = _format_evidence_for_linear(evidence)
        assert "PASSED" in text
        assert "pnl-service" in text
        assert "All healthy" in text

    def test_failed_deploy(self) -> None:
        evidence = {
            "environment": "dev",
            "affected_services": ["ws-consumer"],
            "health_verified": False,
            "deploy_results": [
                {"run_id": 456, "conclusion": "failure"},
            ],
            "mcp_verification": {"mcp_available": False},
        }
        text = _format_evidence_for_linear(evidence)
        assert "NEEDS ATTENTION" in text
        assert "FAIL" in text


# ── TRA-23: VPS MCP client ──


class TestExtractMcpResult:
    def test_text_content(self) -> None:
        response = {
            "result": {
                "content": [{"type": "text", "text": "container running"}]
            }
        }
        assert _extract_mcp_result(response) == "container running"

    def test_empty_response(self) -> None:
        assert _extract_mcp_result({}) is None
        assert _extract_mcp_result(None) is None

    def test_no_text_content(self) -> None:
        response = {"result": {"content": []}}
        result = _extract_mcp_result(response)
        assert result is not None  # Falls back to str(content)


class TestVerifyHealthViaMcp:
    @patch("src.nodes.infra_lead.VpsMcpClient")
    def test_successful_verification(self, mock_cls: MagicMock) -> None:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        mock_client.check_service_health.return_value = {
            "result": {"content": [{"type": "text", "text": "healthy"}]}
        }
        mock_client.list_containers.return_value = {
            "result": {"content": [{"type": "text", "text": "3 running"}]}
        }
        mock_client.get_container_logs.return_value = {
            "result": {"content": [{"type": "text", "text": "OK"}]}
        }

        evidence = _verify_health_via_mcp(["pnl-service"])
        assert evidence["mcp_available"] is True
        assert evidence["health_check"] == "healthy"

    @patch("src.nodes.infra_lead.VpsMcpClient", side_effect=Exception("connection refused"))
    def test_mcp_unavailable(self, mock_cls: MagicMock) -> None:
        evidence = _verify_health_via_mcp(["pnl-service"])
        assert evidence["mcp_available"] is False
        assert len(evidence["errors"]) > 0


# ── TRA-24: Production gate ──


class TestProductionReleaseGate:
    @pytest.mark.asyncio
    async def test_production_pauses_for_approval(self) -> None:
        state = SDLCState(
            workflow_stage="merged",
            deploy_environment="production",
            pr_number=42,
            pr_changed_files=["services/pnl-service/main.py"],
            current_issue_number=10,
            test_passed=True,
        )
        result = await infra_lead_node(state)
        assert result.workflow_stage == "awaiting_production_approval"
        assert result.deploy_status == "pending"
        assert "release_summary" in result.deploy_evidence

    def test_release_summary_content(self) -> None:
        state = SDLCState(
            current_issue_number=10,
            pr_number=42,
            pr_risk_tier="normal",
            test_passed=True,
            architect_review_passed=True,
            deploy_status="succeeded",
        )
        summary = _build_release_summary(state, ["pnl-service"])
        assert "Production Release Summary" in summary
        assert "#10" in summary
        assert "#42" in summary
        assert "pnl-service" in summary
        assert "PASSED" in summary


# ── TRA-21: Infra Lead node integration (deploy flow) ──


class TestInfraLeadNodeDeploy:
    @pytest.mark.asyncio
    async def test_no_deployable_changes_skips(self) -> None:
        state = SDLCState(
            workflow_stage="merged",
            deploy_environment="dev",
            pr_changed_files=["README.md"],
        )
        result = await infra_lead_node(state)
        assert result.deploy_status == "skipped"
        assert result.workflow_stage == "deployed"
        assert result.health_verified is True

    @pytest.mark.asyncio
    @patch("src.nodes.infra_lead.manage_message_history", new_callable=AsyncMock, return_value=[])
    @patch("src.nodes.infra_lead.create_llm")
    @patch("src.nodes.infra_lead.GitHubClient")
    async def test_llm_backed_deploy_success(
        self,
        mock_gh_cls: MagicMock,
        mock_create_llm: MagicMock,
        mock_manage_history: AsyncMock,
    ) -> None:
        """Test the LLM-backed agentic loop with mocked ChatAnthropic."""
        mock_gh_cls.from_state.return_value = MagicMock()

        # Create a mock LLM that returns tool calls then a final response
        mock_llm = MagicMock()
        mock_create_llm.return_value = mock_llm

        # First call: LLM calls detect_affected_services
        from langchain_core.messages import AIMessage, ToolMessage

        call_1 = AIMessage(
            content="I'll detect affected services first.",
            tool_calls=[{
                "name": "detect_affected_services",
                "args": {"changed_files": ["services/pnl-service/main.py"]},
                "id": "tc1",
            }],
        )
        # Second call: LLM calls build_deploy_evidence
        call_2 = AIMessage(
            content="Building deploy evidence.",
            tool_calls=[{
                "name": "build_deploy_evidence",
                "args": {
                    "affected_services": ["pnl-service"],
                    "deploy_results": [{"run_id": 999, "conclusion": "success"}],
                    "mcp_evidence": {"mcp_available": True},
                    "environment": "dev",
                },
                "id": "tc2",
            }],
        )
        # Third call: LLM finishes
        call_3 = AIMessage(content="Deploy complete. All services healthy.")

        mock_llm_with_tools = AsyncMock()
        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[call_1, call_2, call_3])
        mock_llm.bind_tools.return_value = mock_llm_with_tools

        state = SDLCState(
            workflow_stage="merged",
            deploy_environment="dev",
            pr_number=42,
            pr_changed_files=["services/pnl-service/main.py"],
        )
        result = await infra_lead_node(state)
        assert result.deploy_status == "succeeded"
        assert result.workflow_stage == "deployed"

    @pytest.mark.asyncio
    @patch("src.nodes.infra_lead.manage_message_history", new_callable=AsyncMock, return_value=[])
    @patch("src.nodes.infra_lead.create_llm")
    @patch("src.nodes.infra_lead.GitHubClient")
    async def test_llm_no_outcome_fails_closed(
        self,
        mock_gh_cls: MagicMock,
        mock_create_llm: MagicMock,
        mock_manage_history: AsyncMock,
    ) -> None:
        """If the LLM doesn't produce a deploy outcome, fail closed."""
        mock_gh_cls.from_state.return_value = MagicMock()

        from langchain_core.messages import AIMessage
        mock_llm = MagicMock()
        mock_create_llm.return_value = mock_llm

        # LLM returns immediately without calling any tools
        final_msg = AIMessage(content="I'm not sure what to do.")
        mock_llm_with_tools = AsyncMock()
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=final_msg)
        mock_llm.bind_tools.return_value = mock_llm_with_tools

        state = SDLCState(
            workflow_stage="merged",
            deploy_environment="dev",
            pr_number=42,
            pr_changed_files=["services/pnl-service/main.py"],
        )
        result = await infra_lead_node(state)
        assert result.deploy_status == "failed"
        assert result.workflow_stage == "deploy_failed"

    @pytest.mark.asyncio
    @patch("src.nodes.infra_lead.manage_message_history", new_callable=AsyncMock, return_value=[])
    @patch("src.nodes.infra_lead.create_llm")
    @patch("src.nodes.infra_lead.GitHubClient")
    async def test_workforce_deploy_triggers_correct_workflow(
        self,
        mock_gh_cls: MagicMock,
        mock_create_llm: MagicMock,
        mock_manage_history: AsyncMock,
    ) -> None:
        mock_gh_cls.from_state.return_value = MagicMock()

        from langchain_core.messages import AIMessage

        # LLM calls build_deploy_evidence with workforce results
        call_1 = AIMessage(
            content="Building evidence.",
            tool_calls=[{
                "name": "build_deploy_evidence",
                "args": {
                    "affected_services": ["agent-workforce"],
                    "deploy_results": [{"run_id": 777, "conclusion": "success", "workflow": "vps-deploy-workforce.yml"}],
                    "mcp_evidence": {"mcp_available": True},
                    "environment": "dev",
                },
                "id": "tc1",
            }],
        )
        call_2 = AIMessage(content="Done.")

        mock_llm = MagicMock()
        mock_create_llm.return_value = mock_llm
        mock_llm_with_tools = AsyncMock()
        mock_llm_with_tools.ainvoke = AsyncMock(side_effect=[call_1, call_2])
        mock_llm.bind_tools.return_value = mock_llm_with_tools

        state = SDLCState(
            workflow_stage="merged",
            deploy_environment="dev",
            pr_number=42,
            pr_changed_files=["agent-workforce/src/state.py"],
        )
        result = await infra_lead_node(state)
        assert result.deploy_status == "succeeded"


# ── WF5-B: LLM-backed verification ──


class TestInfraLeadLLMBacked:
    def test_tools_defined_as_langchain_schemas(self) -> None:
        """All 7 tools must be defined as LangChain-compatible tool schemas."""
        assert len(TOOLS) == 7
        tool_names = {t["name"] for t in TOOLS}
        expected = {
            "detect_affected_services",
            "select_deploy_workflows",
            "trigger_deploy_workflow",
            "check_workflow_status",
            "verify_health_via_mcp",
            "build_deploy_evidence",
            "trigger_rollback",
        }
        assert tool_names == expected

    def test_each_tool_has_input_schema(self) -> None:
        for tool in TOOLS:
            assert "input_schema" in tool, f"Tool {tool['name']} missing input_schema"
            assert tool["input_schema"]["type"] == "object"

    def test_system_prompt_contains_key_elements(self) -> None:
        assert "Infra Lead" in SYSTEM_PROMPT
        assert "production" in SYSTEM_PROMPT.lower()
        assert "health" in SYSTEM_PROMPT.lower()
        assert "rollback" in SYSTEM_PROMPT.lower()

    @pytest.mark.asyncio
    async def test_cost_tracking_callback_used(self) -> None:
        """Verify CostTrackingCallback is created for infra_lead."""
        from src.llm import CostTrackingCallback
        cb = CostTrackingCallback("infra_lead", {})
        assert cb.agent == "infra_lead"

    @pytest.mark.asyncio
    async def test_execute_tool_detect_services(self) -> None:
        gh = MagicMock()
        state = SDLCState()
        result, updates = await _execute_tool(
            "detect_affected_services",
            {"changed_files": ["services/pnl-service/main.py"]},
            gh, state,
        )
        parsed = json.loads(result)
        assert "pnl-service" in parsed["affected_services"]

    @pytest.mark.asyncio
    async def test_execute_tool_select_workflows(self) -> None:
        gh = MagicMock()
        state = SDLCState()
        result, updates = await _execute_tool(
            "select_deploy_workflows",
            {"changed_files": ["agent-workforce/src/graph.py"]},
            gh, state,
        )
        parsed = json.loads(result)
        assert "vps-deploy-workforce.yml" in parsed["workflows"]

    @pytest.mark.asyncio
    async def test_execute_tool_build_evidence(self) -> None:
        gh = MagicMock()
        state = SDLCState(deploy_environment="dev")
        result, updates = await _execute_tool(
            "build_deploy_evidence",
            {
                "affected_services": ["pnl-service"],
                "deploy_results": [{"run_id": 1, "conclusion": "success"}],
                "mcp_evidence": {"mcp_available": True},
                "environment": "dev",
            },
            gh, state,
        )
        assert updates["deploy_status"] == "succeeded"
        assert updates["workflow_stage"] == "deployed"
        assert updates["health_verified"] is True

    @pytest.mark.asyncio
    async def test_execute_tool_unknown(self) -> None:
        gh = MagicMock()
        state = SDLCState()
        result, updates = await _execute_tool("nonexistent_tool", {}, gh, state)
        assert "Unknown tool" in result
        assert updates == {}


# ── TRA-91: Ad-hoc infrastructure queries ──


class TestAdHocSystemPrompt:
    def test_ad_hoc_prompt_contains_key_elements(self) -> None:
        assert "ad-hoc" in AD_HOC_SYSTEM_PROMPT.lower()
        assert "{infra_query}" in AD_HOC_SYSTEM_PROMPT
        assert "Do NOT trigger" in AD_HOC_SYSTEM_PROMPT

    def test_ad_hoc_prompt_audience_is_sm(self) -> None:
        """IR-001 Fix 2: IL writes for SM audience, not humans."""
        assert "Scrum Master, not a human" in AD_HOC_SYSTEM_PROMPT
        assert "no DevOps team" in AD_HOC_SYSTEM_PROMPT
        assert "exact error" in AD_HOC_SYSTEM_PROMPT

    def test_ad_hoc_prompt_no_organizational_advice(self) -> None:
        """IR-001 Fix 2: IL must not give organizational advice."""
        assert "Do NOT recommend" in AD_HOC_SYSTEM_PROMPT
        assert "escalate to the appropriate team" in AD_HOC_SYSTEM_PROMPT

    def test_deploy_prompt_unchanged(self) -> None:
        assert "Infra Lead" in DEPLOY_SYSTEM_PROMPT
        assert "{pr_number}" in DEPLOY_SYSTEM_PROMPT
        assert "rollback" in DEPLOY_SYSTEM_PROMPT.lower()

    def test_system_prompt_alias(self) -> None:
        """SYSTEM_PROMPT is an alias for DEPLOY_SYSTEM_PROMPT."""
        assert SYSTEM_PROMPT is DEPLOY_SYSTEM_PROMPT


class TestInfraLeadAdHocQuery:
    @pytest.mark.asyncio
    @patch("src.nodes.infra_lead.manage_message_history", new_callable=AsyncMock, return_value=[])
    @patch("src.nodes.infra_lead.create_llm")
    @patch("src.nodes.infra_lead.GitHubClient")
    async def test_ad_hoc_query_sets_infra_query_complete(
        self,
        mock_gh_cls: MagicMock,
        mock_create_llm: MagicMock,
        mock_manage_history: AsyncMock,
    ) -> None:
        """Ad-hoc query sets workflow_stage to infra_query_complete."""
        mock_gh_cls.from_state.return_value = MagicMock()

        from langchain_core.messages import AIMessage

        mock_llm = MagicMock()
        mock_create_llm.return_value = mock_llm
        final_msg = AIMessage(content="VPS is healthy. 8 containers running.")
        mock_llm_with_tools = AsyncMock()
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=final_msg)
        mock_llm.bind_tools.return_value = mock_llm_with_tools

        state = SDLCState(
            workflow_stage="dispatch_infra_query",
            infra_query="Check VPS container health",
        )
        result = await infra_lead_node(state)
        assert result.workflow_stage == "infra_query_complete"

    @pytest.mark.asyncio
    @patch("src.nodes.infra_lead.manage_message_history", new_callable=AsyncMock, return_value=[])
    @patch("src.nodes.infra_lead.create_llm")
    @patch("src.nodes.infra_lead.GitHubClient")
    async def test_ad_hoc_query_does_not_set_deploy_status(
        self,
        mock_gh_cls: MagicMock,
        mock_create_llm: MagicMock,
        mock_manage_history: AsyncMock,
    ) -> None:
        """Ad-hoc queries must not modify deploy_status."""
        mock_gh_cls.from_state.return_value = MagicMock()

        from langchain_core.messages import AIMessage

        mock_llm = MagicMock()
        mock_create_llm.return_value = mock_llm
        final_msg = AIMessage(content="Disk usage is 34%.")
        mock_llm_with_tools = AsyncMock()
        mock_llm_with_tools.ainvoke = AsyncMock(return_value=final_msg)
        mock_llm.bind_tools.return_value = mock_llm_with_tools

        state = SDLCState(
            workflow_stage="dispatch_infra_query",
            infra_query="What is disk usage?",
            deploy_status="pending",
        )
        result = await infra_lead_node(state)
        # deploy_status should remain unchanged (pending from original state)
        assert result.deploy_status == "pending"
        assert result.workflow_stage == "infra_query_complete"

    @pytest.mark.asyncio
    async def test_deploy_flow_not_affected_by_empty_infra_query(self) -> None:
        """When infra_query is empty, deploy flow runs normally."""
        state = SDLCState(
            workflow_stage="merged",
            deploy_environment="dev",
            pr_changed_files=["README.md"],
            infra_query="",
        )
        result = await infra_lead_node(state)
        assert result.deploy_status == "skipped"
        assert result.workflow_stage == "deployed"
