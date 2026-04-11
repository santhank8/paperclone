"""Tests for RetryPolicy (TRA-61).

Min 6 tests required per spec.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.tools.retry import (
    DEFAULT_RETRY_POLICY,
    MaxRetriesExceeded,
    PermanentError,
    RetryPolicy,
    _is_non_retryable,
    with_retry,
    with_retry_sync,
)


class TestRetryPolicyConfig:
    def test_default_policy_values(self) -> None:
        policy = RetryPolicy()
        assert policy.max_attempts == 3
        assert policy.base_delay == 2.0
        assert policy.jitter == 0.5

    def test_delay_exponential_backoff(self) -> None:
        policy = RetryPolicy(base_delay=2.0, jitter=0.0)
        assert policy.delay_for_attempt(0) == 2.0  # 2 * 2^0
        assert policy.delay_for_attempt(1) == 4.0  # 2 * 2^1
        assert policy.delay_for_attempt(2) == 8.0  # 2 * 2^2

    def test_delay_respects_max(self) -> None:
        policy = RetryPolicy(base_delay=2.0, max_delay=5.0, jitter=0.0)
        assert policy.delay_for_attempt(5) == 5.0

    def test_delay_jitter_within_range(self) -> None:
        policy = RetryPolicy(base_delay=2.0, jitter=0.5)
        delays = [policy.delay_for_attempt(0) for _ in range(100)]
        assert all(1.5 <= d <= 2.5 for d in delays)


class TestIsNonRetryable:
    def test_permanent_error_is_non_retryable(self) -> None:
        assert _is_non_retryable(PermanentError("bad")) is True

    def test_generic_error_is_retryable(self) -> None:
        assert _is_non_retryable(RuntimeError("transient")) is False

    def test_http_400_is_non_retryable(self) -> None:
        err = RuntimeError("bad request")
        err.status_code = 400  # type: ignore[attr-defined]
        assert _is_non_retryable(err) is True

    def test_http_500_is_retryable(self) -> None:
        err = RuntimeError("server error")
        err.status_code = 500  # type: ignore[attr-defined]
        assert _is_non_retryable(err) is False

    def test_urllib_http_error_status_non_retryable(self) -> None:
        err = RuntimeError("not found")
        err.status = 404  # type: ignore[attr-defined]
        assert _is_non_retryable(err) is True


@pytest.mark.asyncio
class TestWithRetry:
    async def test_success_on_first_attempt(self) -> None:
        fn = AsyncMock(return_value="ok")
        result = await with_retry(fn, policy=RetryPolicy(max_attempts=3))
        assert result == "ok"
        assert fn.call_count == 1

    async def test_success_after_transient_failure(self) -> None:
        fn = AsyncMock(side_effect=[RuntimeError("fail"), "ok"])
        policy = RetryPolicy(max_attempts=3, base_delay=0.01, jitter=0.0)
        result = await with_retry(fn, policy=policy)
        assert result == "ok"
        assert fn.call_count == 2

    async def test_raises_max_retries_exceeded(self) -> None:
        fn = AsyncMock(side_effect=RuntimeError("always fails"))
        policy = RetryPolicy(max_attempts=2, base_delay=0.01, jitter=0.0)
        with pytest.raises(MaxRetriesExceeded) as exc_info:
            await with_retry(fn, policy=policy, operation="test_op")
        assert exc_info.value.attempts == 2
        assert exc_info.value.last_error is not None

    async def test_permanent_error_no_retry(self) -> None:
        fn = AsyncMock(side_effect=PermanentError("auth failure"))
        policy = RetryPolicy(max_attempts=3, base_delay=0.01)
        with pytest.raises(PermanentError):
            await with_retry(fn, policy=policy)
        assert fn.call_count == 1

    async def test_4xx_http_error_no_retry(self) -> None:
        err = RuntimeError("forbidden")
        err.status_code = 403  # type: ignore[attr-defined]
        fn = AsyncMock(side_effect=err)
        policy = RetryPolicy(max_attempts=3, base_delay=0.01)
        with pytest.raises(PermanentError):
            await with_retry(fn, policy=policy)
        assert fn.call_count == 1

    async def test_passes_args_and_kwargs(self) -> None:
        fn = AsyncMock(return_value="result")
        await with_retry(fn, "arg1", "arg2", key="val")
        fn.assert_called_once_with("arg1", "arg2", key="val")


class TestWithRetrySync:
    def test_success_on_first_attempt(self) -> None:
        fn = MagicMock(return_value="ok")
        result = with_retry_sync(fn, policy=RetryPolicy(max_attempts=3))
        assert result == "ok"
        assert fn.call_count == 1

    def test_raises_max_retries_exceeded(self) -> None:
        fn = MagicMock(side_effect=RuntimeError("fail"))
        policy = RetryPolicy(max_attempts=2, base_delay=0.01, jitter=0.0)
        with pytest.raises(MaxRetriesExceeded):
            with_retry_sync(fn, policy=policy)
        assert fn.call_count == 2
