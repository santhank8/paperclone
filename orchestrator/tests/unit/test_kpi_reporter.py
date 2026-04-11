"""Tests for KPI reporter and daily digest (TRA-63).

Min 5 tests required per spec.
"""

from src.tools.kpi_reporter import (
    build_daily_digest,
    compute_cycle_time_seconds,
    format_duration,
)


class TestFormatDuration:
    def test_seconds(self) -> None:
        assert format_duration(45) == "45s"

    def test_minutes(self) -> None:
        assert format_duration(125) == "2m 5s"

    def test_hours(self) -> None:
        assert format_duration(3725) == "1h 2m"


class TestBuildDailyDigest:
    def test_full_digest_content(self) -> None:
        digest = build_daily_digest(
            stories_completed=3,
            avg_cycle_time_seconds=1200.0,
            retry_rate=0.15,
            budget_used_today=2.50,
            daily_cap=5.00,
            active_p1_issues=["TRA-99"],
        )
        assert "Daily Workforce Digest" in digest
        assert "3" in digest  # stories completed
        assert "20m" in digest  # 1200s = 20m
        assert "15.0%" in digest  # retry rate
        assert "$2.50" in digest
        assert "$5.00" in digest
        assert "TRA-99" in digest

    def test_no_stories(self) -> None:
        digest = build_daily_digest(
            stories_completed=0,
            avg_cycle_time_seconds=None,
            retry_rate=0.0,
            budget_used_today=0.0,
            daily_cap=0.0,
        )
        assert "0" in digest
        assert "N/A" in digest

    def test_no_p1_issues(self) -> None:
        digest = build_daily_digest(
            stories_completed=1,
            active_p1_issues=[],
        )
        assert "None" in digest

    def test_budget_percentage_calculated(self) -> None:
        digest = build_daily_digest(
            budget_used_today=2.0,
            daily_cap=4.0,
        )
        assert "50%" in digest


class TestComputeCycleTime:
    def test_valid_timestamps(self) -> None:
        started = "2026-03-17T10:00:00+00:00"
        ended = "2026-03-17T10:30:00+00:00"
        assert compute_cycle_time_seconds(started, ended) == 1800

    def test_none_started_returns_none(self) -> None:
        assert compute_cycle_time_seconds(None) is None

    def test_invalid_timestamp_returns_none(self) -> None:
        assert compute_cycle_time_seconds("not-a-date") is None

    def test_defaults_to_now_when_no_end(self) -> None:
        # Very recent start should give a small positive number
        from datetime import datetime, timezone

        started = datetime.now(timezone.utc).isoformat()
        result = compute_cycle_time_seconds(started)
        assert result is not None
        assert 0 <= result <= 5
