"""Retry policy with exponential backoff for transient failures.

TRA-61: Applied to all LLM and external API calls.

Policy: max 3 attempts, delays 2s/4s/8s + ±0.5s jitter.
Does NOT retry 4xx client errors (permanent failures → immediate escalation).
"""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Type

logger = logging.getLogger(__name__)

# HTTP status codes that should NOT be retried (client errors = permanent)
NON_RETRYABLE_STATUS_CODES = range(400, 500)


class MaxRetriesExceeded(Exception):
    """Raised when all retry attempts are exhausted."""

    def __init__(
        self,
        message: str,
        attempts: int,
        last_error: Optional[Exception] = None,
    ) -> None:
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error


class PermanentError(Exception):
    """Wraps a non-retryable error (e.g. 4xx client error)."""

    def __init__(self, message: str, original: Optional[Exception] = None) -> None:
        super().__init__(message)
        self.original = original


@dataclass
class RetryPolicy:
    """Configuration for retry behavior.

    Attributes:
        max_attempts: Total number of tries (including the first).
        base_delay: Base delay in seconds for exponential backoff.
        max_delay: Maximum delay cap in seconds.
        jitter: Random jitter range in seconds (±jitter).
        non_retryable_errors: Exception types that should never be retried.
    """

    max_attempts: int = 3
    base_delay: float = 2.0
    max_delay: float = 16.0
    jitter: float = 0.5
    non_retryable_errors: tuple[Type[Exception], ...] = field(
        default_factory=lambda: (PermanentError,)
    )

    def delay_for_attempt(self, attempt: int) -> float:
        """Calculate delay for the given attempt number (0-indexed).

        Uses exponential backoff: base_delay * 2^attempt + random jitter.
        """
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        delay += random.uniform(-self.jitter, self.jitter)
        return max(0, delay)


# Default policy used across the workforce
DEFAULT_RETRY_POLICY = RetryPolicy(max_attempts=3, base_delay=2.0, jitter=0.5)


def _is_non_retryable(error: Exception) -> bool:
    """Check if an error is a permanent (non-retryable) failure.

    4xx HTTP errors and PermanentError instances are never retried.
    """
    if isinstance(error, PermanentError):
        return True

    # Check for HTTP status code attributes common in HTTP libraries
    status_code = getattr(error, "status_code", None) or getattr(
        error, "code", None
    )
    if isinstance(status_code, int) and status_code in NON_RETRYABLE_STATUS_CODES:
        return True

    # urllib HTTPError
    if hasattr(error, "status") and isinstance(error.status, int):
        if error.status in NON_RETRYABLE_STATUS_CODES:
            return True

    return False


async def with_retry(
    fn: Callable[..., Any],
    *args: Any,
    policy: Optional[RetryPolicy] = None,
    operation: str = "",
    **kwargs: Any,
) -> Any:
    """Execute an async callable with retry logic.

    Args:
        fn: Async callable to execute.
        *args: Positional arguments for fn.
        policy: Retry policy to use. Defaults to DEFAULT_RETRY_POLICY.
        operation: Human-readable operation name for logging.
        **kwargs: Keyword arguments for fn.

    Returns:
        The return value of fn on success.

    Raises:
        PermanentError: If the error is non-retryable (4xx, etc.).
        MaxRetriesExceeded: If all attempts fail.
    """
    if policy is None:
        policy = DEFAULT_RETRY_POLICY

    label = operation or getattr(fn, "__qualname__", str(fn))
    last_error: Optional[Exception] = None

    for attempt in range(policy.max_attempts):
        try:
            return await fn(*args, **kwargs)
        except Exception as e:
            last_error = e

            # Non-retryable errors fail immediately
            if _is_non_retryable(e):
                raise PermanentError(
                    f"{label}: permanent error (not retryable): {e}",
                    original=e,
                ) from e

            # Check non-retryable exception types
            if isinstance(e, policy.non_retryable_errors):
                raise

            remaining = policy.max_attempts - attempt - 1
            if remaining <= 0:
                break

            delay = policy.delay_for_attempt(attempt)
            logger.warning(
                f"{label}: attempt {attempt + 1}/{policy.max_attempts} failed "
                f"({type(e).__name__}: {str(e)[:200]}). "
                f"Retrying in {delay:.1f}s ({remaining} attempts left)"
            )
            await asyncio.sleep(delay)

    raise MaxRetriesExceeded(
        f"{label}: all {policy.max_attempts} attempts exhausted",
        attempts=policy.max_attempts,
        last_error=last_error,
    )


def with_retry_sync(
    fn: Callable[..., Any],
    *args: Any,
    policy: Optional[RetryPolicy] = None,
    operation: str = "",
    **kwargs: Any,
) -> Any:
    """Execute a synchronous callable with retry logic.

    Same semantics as with_retry but for synchronous functions.
    Used for Linear API calls (which use urllib synchronously).
    """
    import time

    if policy is None:
        policy = DEFAULT_RETRY_POLICY

    label = operation or getattr(fn, "__qualname__", str(fn))
    last_error: Optional[Exception] = None

    for attempt in range(policy.max_attempts):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_error = e

            if _is_non_retryable(e):
                raise PermanentError(
                    f"{label}: permanent error (not retryable): {e}",
                    original=e,
                ) from e

            if isinstance(e, policy.non_retryable_errors):
                raise

            remaining = policy.max_attempts - attempt - 1
            if remaining <= 0:
                break

            delay = policy.delay_for_attempt(attempt)
            logger.warning(
                f"{label}: attempt {attempt + 1}/{policy.max_attempts} failed "
                f"({type(e).__name__}: {str(e)[:200]}). "
                f"Retrying in {delay:.1f}s ({remaining} attempts left)"
            )
            time.sleep(delay)

    raise MaxRetriesExceeded(
        f"{label}: all {policy.max_attempts} attempts exhausted",
        attempts=policy.max_attempts,
        last_error=last_error,
    )
