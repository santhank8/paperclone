"""Entrypoint — starts LangGraph orchestrator + Slack listener.

Spec ref: AgenticSquad_Functional_Spec v3.1 §11.2
All inbound Slack messages route through the LLM-backed Scrum Master.
Only intervention commands (/pause, /resume, /cancel) and the pause gate
are handled outside the graph.

Startup sequence:
1. Load config/trading-agent.yaml -> project config
2. Initialize PostgreSQL checkpointer
3. Build the LangGraph graph
4. Start Slack Socket Mode listener
5. Route all messages into the graph
"""

import asyncio
import logging
import os
import subprocess
import sys
from aiohttp import web
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config_loader import load_project_config
from .graph import build_graph
from .state import SDLCState
from .tools.kpi_reporter import build_daily_digest
from .tools.slack_client import SlackClient, parse_intervention_command

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent.parent / "config" / "trading-agent.yaml"

LOBBY_THREAD = "lobby"

# Terminal workflow stages where a story is no longer active
_TERMINAL_STAGES = frozenset({"done", "deployed", "escalated", "budget_paused"})


# ── Lobby thread helpers ──


async def _get_lobby_state(graph: object) -> dict:
    """Read the lobby thread checkpoint. Returns values dict or {}."""
    try:
        config = {"configurable": {"thread_id": LOBBY_THREAD}}
        snapshot = await graph.aget_state(config)  # type: ignore[union-attr]
        if snapshot and snapshot.values:
            return dict(snapshot.values)
    except Exception:
        pass
    return {}


async def _get_active_thread(graph: object) -> Optional[str]:
    """Read active_story_thread_id from the lobby checkpoint."""
    lobby = await _get_lobby_state(graph)
    return lobby.get("active_story_thread_id")


async def _sync_lobby(
    graph: object,
    active_thread: Optional[str],
    cost_tracker: Optional[dict] = None,
) -> None:
    """Update the lobby thread with the active story thread and cost data."""
    config = {"configurable": {"thread_id": LOBBY_THREAD}}
    updates: dict = {"active_story_thread_id": active_thread}
    if cost_tracker is not None:
        updates["cost_tracker"] = cost_tracker
    try:
        await graph.aupdate_state(config, updates, as_node="scrum_master")  # type: ignore[union-attr]
    except Exception:
        # Lobby has no prior state — bootstrap with a fresh invocation
        try:
            state = SDLCState(
                workflow_stage="idle",
                active_story_thread_id=active_thread,
                cost_tracker=cost_tracker or {},
            )
            await graph.ainvoke(state, config)  # type: ignore[union-attr]
        except Exception:
            logger.warning("Failed to sync lobby thread state")


async def _get_thread_snapshot(graph: object, thread_id: str) -> tuple[dict, bool]:
    """Read a thread's checkpoint. Returns (values_dict, is_interrupted)."""
    try:
        config = {"configurable": {"thread_id": thread_id}}
        snapshot = await graph.aget_state(config)  # type: ignore[union-attr]
        if snapshot:
            values = dict(snapshot.values) if snapshot.values else {}
            interrupted = bool(snapshot.next)
            return values, interrupted
    except Exception:
        pass
    return {}, False


# ── Pause / job-run tracking ──


_workforce_paused = False
_active_job_run_id: str | None = None


def set_workforce_paused(paused: bool) -> None:
    """Set the global workforce pause state."""
    global _workforce_paused
    _workforce_paused = paused


def is_workforce_paused() -> bool:
    """Check if the workforce is paused."""
    return _workforce_paused


def set_active_job_run_id(run_id: str | None) -> None:
    """Track the active GitHub Actions job run ID."""
    global _active_job_run_id
    _active_job_run_id = run_id


def get_active_job_run_id() -> str | None:
    """Get the active GitHub Actions job run ID."""
    return _active_job_run_id


def _ensure_ssl_mode(connection_string: str) -> str:
    """Append sslmode=require to a PostgreSQL connection string if not present.

    Handles both DSN (key=value) and URI (postgresql://...) formats.
    TRA-52: Fixes pg_hba.conf rejection of langgraph_user without SSL.
    """
    if "sslmode" in connection_string:
        return connection_string
    if connection_string.startswith("postgresql://") or connection_string.startswith("postgres://"):
        separator = "&" if "?" in connection_string else "?"
        return f"{connection_string}{separator}sslmode=require"
    return f"{connection_string} sslmode=require"


# ── Main message handler ──


async def handle_slack_message(
    text: str,
    graph: object,
    project_config: dict,
) -> None:
    """Route ALL Slack messages to the LLM-backed Scrum Master.

    The Scrum Master handles intent classification — issue pickup, status
    queries, merge approvals, budget checks, general conversation, and
    anything else. Only intervention commands (/pause, /resume, /cancel)
    and the pause gate are handled here.

    Active story tracking is persisted in the lobby thread checkpoint
    (survives container restarts), not in a volatile in-memory dict.
    """
    text_stripped = text.strip()
    slack = SlackClient(webhook_url=os.environ.get("SLACK_WEBHOOK_URL", ""))

    # -- Intervention commands (harness-level, outside the graph) --
    intervention = parse_intervention_command(text)
    if intervention:
        cmd, _args = intervention
        await _handle_intervention(cmd, slack, graph, project_config)
        return

    # -- Pause gate --
    if is_workforce_paused():
        await slack.post(
            ":double_vertical_bar: Workforce is *paused*. "
            "Use `/resume` to resume."
        )
        return

    # -- Discover active story thread from lobby checkpoint --
    active_thread = await _get_active_thread(graph)
    thread_id = active_thread or LOBBY_THREAD
    config = {"configurable": {"thread_id": thread_id}}

    # -- Check thread state for interrupt handling --
    prev_values, at_interrupt = await _get_thread_snapshot(graph, thread_id)

    # If the active thread's story is terminal, fall back to lobby
    if active_thread and prev_values.get("workflow_stage") in _TERMINAL_STAGES:
        thread_id = LOBBY_THREAD
        config = {"configurable": {"thread_id": thread_id}}
        prev_values, at_interrupt = await _get_thread_snapshot(graph, thread_id)

    logger.info(
        f"Routing to Scrum Master (thread={thread_id}, "
        f"interrupt={at_interrupt}): {text_stripped[:50]}"
    )

    try:
        if at_interrupt:
            # Graph is paused at an interrupt — inject message and resume.
            # The Scrum Master will classify intent (merge approval vs question).
            # Carry over existing messages to preserve conversational context (IR-002).
            existing_messages = list(prev_values.get("messages", []))
            existing_messages.append({"role": "user", "content": text_stripped})
            await graph.aupdate_state(  # type: ignore[union-attr]
                config,
                {"messages": existing_messages},
                as_node="scrum_master",
            )
            await graph.ainvoke(None, config)  # type: ignore[union-attr]
        elif active_thread and prev_values:
            # Active story thread at END — start fresh run carrying context
            initial_state = _build_state_with_carryover(
                prev_values, project_config, text_stripped
            )
            await graph.ainvoke(initial_state, config)  # type: ignore[union-attr]
        else:
            # No active story — fresh invocation on lobby thread
            lobby_values = await _get_lobby_state(graph)
            initial_state = _build_state_with_carryover(
                lobby_values, project_config, text_stripped
            )
            await graph.ainvoke(initial_state, config)  # type: ignore[union-attr]

        # -- Sync lobby: track active story and cost data --
        await _post_invoke_sync(graph, thread_id)

    except Exception:
        logger.exception("Failed to route message to Scrum Master")
        await slack.post(
            "Sorry, I couldn't process that. The Scrum Master encountered an error."
        )


def _build_state_with_carryover(
    prev: dict,
    project_config: dict,
    user_message: str,
) -> SDLCState:
    """Build initial SDLCState carrying over durable fields from prior checkpoint.

    Critically, this carries over the conversation history (messages) from the
    previous checkpoint and appends the new user message. Without this, the SM
    loses all conversational context between messages (IR-002).
    """
    # Carry over conversation history and append new message
    prev_messages = list(prev.get("messages", []))
    prev_messages.append({"role": "user", "content": user_message})

    return SDLCState(
        workflow_stage="idle",
        # Carry over story context (SM sees it in system prompt)
        current_issue_number=prev.get("current_issue_number"),
        current_issue_body=prev.get("current_issue_body", ""),
        pr_number=prev.get("pr_number"),
        pr_url=prev.get("pr_url", ""),
        pr_risk_tier=prev.get("pr_risk_tier", "normal"),
        # Carry over durable cross-story fields
        cost_tracker=prev.get("cost_tracker", {}),
        budget_alerts_sent=prev.get("budget_alerts_sent", []),
        document_registry=prev.get("document_registry", {}),
        deploy_environment=prev.get("deploy_environment", "dev"),
        # Config + accumulated conversation history
        project_config=project_config,
        messages=prev_messages,
    )


async def _post_invoke_sync(graph: object, thread_id: str) -> None:
    """After graph invocation, sync the lobby with the active story state."""
    final_values, _ = await _get_thread_snapshot(graph, thread_id)
    final_stage = final_values.get("workflow_stage", "idle")
    issue_num = final_values.get("current_issue_number")
    cost_tracker = final_values.get("cost_tracker")

    if thread_id == LOBBY_THREAD:
        # Lobby invocation — check if SM picked up a story
        if issue_num and final_stage not in _TERMINAL_STAGES and final_stage != "idle":
            new_thread = f"story-{issue_num}"
            await _sync_lobby(graph, new_thread, cost_tracker)
    else:
        # Story thread invocation — check if story ended
        if final_stage in _TERMINAL_STAGES:
            await _sync_lobby(graph, None, cost_tracker)
        else:
            await _sync_lobby(graph, thread_id, cost_tracker)


# ── Intervention handler ──


async def _handle_intervention(
    command: str,
    slack: SlackClient,
    graph: object,
    project_config: dict,
) -> None:
    """Handle /pause, /resume, /cancel, /status intervention commands."""
    if command == "pause":
        set_workforce_paused(True)
        await slack.post(
            ":double_vertical_bar: Workforce *paused*. No new stories will be picked up.\n"
            "Use `/resume` to continue."
        )
        logger.info("Workforce paused via Slack command")

    elif command == "resume":
        set_workforce_paused(False)
        await slack.post(
            ":arrow_forward: Workforce *resumed*. Story pickup is active again."
        )
        logger.info("Workforce resumed via Slack command")

    elif command == "cancel":
        run_id = get_active_job_run_id()
        if not run_id:
            await slack.post(
                "No active job run to cancel. The workforce is idle."
            )
            return
        try:
            result = subprocess.run(
                ["gh", "run", "cancel", str(run_id)],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                set_active_job_run_id(None)
                await slack.post(
                    f":octagonal_sign: Job run `{run_id}` cancelled."
                )
                logger.info(f"Cancelled job run {run_id}")
            else:
                await slack.post(
                    f"Failed to cancel run `{run_id}`: {result.stderr.strip()}"
                )
        except Exception as e:
            await slack.post(f"Cancel failed: {e}")
            logger.error(f"Cancel command failed: {e}")

    elif command == "status":
        # Read active story from lobby checkpoint (not volatile context dict)
        active_thread = await _get_active_thread(graph)
        issue: Optional[int] = None
        if active_thread and active_thread.startswith("story-"):
            try:
                issue = int(active_thread.split("-", 1)[1])
            except (ValueError, IndexError):
                pass

        paused = is_workforce_paused()
        run_id = get_active_job_run_id()

        lines = [":clipboard: *Workforce Status*", ""]
        lines.append(f"*Paused:* {'Yes' if paused else 'No'}")

        if issue:
            lines.append(f"*Active story:* #{issue}")
            values, _ = await _get_thread_snapshot(graph, active_thread)  # type: ignore[arg-type]
            stage = values.get("workflow_stage", "unknown")
            lines.append(f"*Stage:* `{stage}`")
        else:
            lines.append("*Active story:* None")

        if run_id:
            lines.append(f"*Active job run:* `{run_id}`")

        cost_config = project_config.get("cost_control", {})
        daily_cap = cost_config.get("monthly_budget_usd", 50.0) / 30
        lines.append(f"*Daily budget cap:* ${daily_cap:.2f}")

        lines.append(
            f"*Last heartbeat:* {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
        )

        await slack.post("\n".join(lines))


# ── Daily digest ──


async def _schedule_daily_digest(
    slack: SlackClient,
    project_config: dict,
) -> None:
    """Schedule the daily KPI digest at 09:00 UTC (TRA-63).

    Uses wall-clock anchoring to avoid drift under container restarts.
    """
    while True:
        now = datetime.now(timezone.utc)
        target = now.replace(hour=9, minute=0, second=0, microsecond=0)
        if now >= target:
            from datetime import timedelta

            target += timedelta(days=1)

        wait_seconds = (target - now).total_seconds()
        logger.info(
            f"Daily digest scheduled in {wait_seconds:.0f}s "
            f"(at {target.isoformat()})"
        )
        await asyncio.sleep(wait_seconds)

        try:
            cost_config = project_config.get("cost_control", {})
            daily_cap = cost_config.get("monthly_budget_usd", 50.0) / 30

            digest = build_daily_digest(
                stories_completed=0,
                avg_cycle_time_seconds=None,
                retry_rate=0.0,
                budget_used_today=0.0,
                daily_cap=daily_cap,
                active_p1_issues=[],
            )
            await slack.post(digest)
            logger.info("Daily digest posted")
        except Exception:
            logger.exception("Failed to post daily digest")


# ── Health check server ──


async def _health_check(request: web.Request) -> web.Response:
    """Health check endpoint for Container Apps probes."""
    return web.Response(text="ok")


async def _start_health_server() -> None:
    """Start a minimal HTTP server for health probes."""
    app = web.Application()
    app.router.add_get("/healthz", _health_check)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.environ.get("PORT", "8080"))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info(f"Health check listening on :{port}/healthz")


# ── Entrypoint ──


async def main() -> None:
    """Start the LangGraph orchestrator."""
    logger.info("Starting Agentic Squad orchestrator...")

    # 0. Start health check server (Container Apps requires this)
    await _start_health_server()

    # 1. Load project config
    try:
        project_config = load_project_config(str(CONFIG_PATH))
    except (FileNotFoundError, ValueError) as e:
        logger.error(f"Failed to load config: {e}")
        sys.exit(1)

    logger.info(
        f"Project: {project_config['project']['name']} "
        f"({project_config['project']['repo']})"
    )

    # 2. Initialize checkpointer
    pg_connection = os.environ.get("SQUAD_PG_CONNECTION", "")
    checkpointer = None
    if pg_connection:
        pg_connection = _ensure_ssl_mode(pg_connection)
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            from psycopg import AsyncConnection
            from psycopg_pool import AsyncConnectionPool

            async with await AsyncConnection.connect(
                pg_connection, autocommit=True
            ) as setup_conn:
                setup_saver = AsyncPostgresSaver(setup_conn)
                await setup_saver.setup()
            logger.info("PostgreSQL schema setup complete")

            pool = AsyncConnectionPool(conninfo=pg_connection)
            await pool.open()
            checkpointer = AsyncPostgresSaver(pool)
            logger.info("PostgreSQL checkpointer initialized")
        except Exception:
            checkpointer = None
            logger.exception(
                "Failed to initialize PostgreSQL checkpointer — "
                "running without persistence"
            )
    else:
        logger.warning(
            "SQUAD_PG_CONNECTION not set — running without persistence"
        )

    # 3. Build the graph
    graph = build_graph(checkpointer=checkpointer)
    logger.info("LangGraph graph compiled")

    # 4. Start Slack Socket Mode listener
    slack = SlackClient(
        webhook_url=os.environ.get("SLACK_WEBHOOK_URL", ""),
        app_token=os.environ.get("SLACK_APP_TOKEN", ""),
    )

    loop = asyncio.get_running_loop()

    def on_message(text: str) -> None:
        asyncio.run_coroutine_threadsafe(
            handle_slack_message(text, graph, project_config),
            loop,
        )

    try:
        handler = slack.create_socket_mode_handler(on_message)
        logger.info("LangGraph agent started. Listening on Slack.")
        handler.connect()
    except Exception as e:
        logger.error(f"Slack Socket Mode not available: {e}")
        logger.info("Running without Slack listener (useful for testing)")

    # TRA-63: Schedule daily KPI digest at 09:00 UTC
    asyncio.create_task(_schedule_daily_digest(slack, project_config))

    # Keep the event loop alive — health server + Slack listener run forever
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
