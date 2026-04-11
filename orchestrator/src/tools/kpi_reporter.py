"""KPI reporter — daily digest and cycle time tracking.

TRA-63: Cycle time + retry rate tracking with daily Slack digest at 09:00 UTC.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def format_duration(seconds: int) -> str:
    """Format seconds into human-readable duration."""
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}m {secs}s"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours}h {minutes}m"


def build_daily_digest(
    *,
    stories_completed: int = 0,
    avg_cycle_time_seconds: Optional[float] = None,
    retry_rate: float = 0.0,
    budget_used_today: float = 0.0,
    daily_cap: float = 0.0,
    active_p1_issues: list[str] | None = None,
) -> str:
    """Build the daily KPI digest message for Slack.

    Fields:
    - Stories completed (last 24h)
    - Average cycle time
    - Retry rate (retries / total node calls)
    - Budget used today vs. daily cap
    - Any active P1 issues
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [f":bar_chart: *Daily Workforce Digest — {now}*", ""]

    # Stories completed
    lines.append(f"*Stories completed (24h):* {stories_completed}")

    # Average cycle time
    if avg_cycle_time_seconds is not None and avg_cycle_time_seconds > 0:
        lines.append(
            f"*Avg cycle time:* {format_duration(int(avg_cycle_time_seconds))}"
        )
    else:
        lines.append("*Avg cycle time:* N/A")

    # Retry rate
    pct = retry_rate * 100
    lines.append(f"*Retry rate:* {pct:.1f}%")

    # Budget
    if daily_cap > 0:
        usage_pct = (budget_used_today / daily_cap) * 100
        lines.append(
            f"*Budget today:* ${budget_used_today:.2f} / ${daily_cap:.2f} "
            f"({usage_pct:.0f}%)"
        )
    else:
        lines.append(f"*Budget today:* ${budget_used_today:.2f}")

    # P1 issues
    p1 = active_p1_issues or []
    if p1:
        lines.append(f"*Active P1 issues:* {', '.join(p1)}")
    else:
        lines.append("*Active P1 issues:* None")

    return "\n".join(lines)


def compute_cycle_time_seconds(
    started_at: Optional[str],
    completed_at: Optional[str] = None,
) -> Optional[int]:
    """Compute cycle time in seconds between two ISO timestamps.

    Args:
        started_at: ISO timestamp when story started.
        completed_at: ISO timestamp when story completed.
            Defaults to now (UTC).

    Returns:
        Cycle time in seconds, or None if started_at is not available.
    """
    if not started_at:
        return None

    try:
        start = datetime.fromisoformat(started_at)
        if completed_at:
            end = datetime.fromisoformat(completed_at)
        else:
            end = datetime.now(timezone.utc)
        delta = (end - start).total_seconds()
        return max(0, int(delta))
    except (ValueError, TypeError):
        logger.warning(f"Invalid timestamps: started_at={started_at}")
        return None
