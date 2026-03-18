"""P(event) and predict artifact at T by aggregating over trajectories."""

from __future__ import annotations

from typing import List, Optional, Tuple

import numpy as np

from crca_core.models.result import EventSpec
from crca_core.models.spec import PathValues


def event_satisfied(path: PathValues, event: EventSpec) -> bool:
    """True iff the path satisfies the event (artifact at time with condition)."""
    if event.artifact not in path.data or event.time not in path.times:
        return False
    idx = path.times.index(event.time)
    if idx >= len(path.data[event.artifact]):
        return False
    x = path.data[event.artifact][idx]
    op = event.op
    if op == "in":
        if event.value_low is not None and event.value_high is not None:
            return bool(event.value_low <= x <= event.value_high)
        return False
    if op == "gt" and event.value is not None:
        return bool(x > event.value)
    if op == "gte" and event.value is not None:
        return bool(x >= event.value)
    if op == "lt" and event.value is not None:
        return bool(x < event.value)
    if op == "lte" and event.value is not None:
        return bool(x <= event.value)
    if op == "eq" and event.value is not None:
        return bool(x == event.value)
    return False


def p_event(
    paths: List[PathValues],
    event: EventSpec,
    *,
    weights: Optional[List[float]] = None,
) -> Tuple[float, Optional[float]]:
    """P(event) = fraction (or importance-weighted) of paths satisfying event. Returns (p, std_error)."""
    if not paths:
        return 0.0, None
    hits = [1.0 if event_satisfied(p, event) else 0.0 for p in paths]
    if weights is not None and len(weights) == len(paths):
        p = float(np.average(hits, weights=weights))
        var = np.average((np.array(hits) - p) ** 2, weights=weights)
        n_eff = max(1, sum(weights) ** 2 / (sum(w**2 for w in weights) or 1))
        std_error = float(np.sqrt(var / n_eff)) if n_eff > 0 else None
    else:
        p = float(np.mean(hits))
        std_error = float(np.std(hits) / np.sqrt(len(paths))) if len(paths) > 1 else None
    return p, std_error


def predict_artifact_at_t(
    paths: List[PathValues],
    artifact: str,
    t: int,
) -> Tuple[List[float], float, float]:
    """Collect artifact values at time t across paths. Returns (samples, mean, std)."""
    samples: List[float] = []
    for p in paths:
        if artifact not in p.data or t not in p.times:
            continue
        idx = p.times.index(t)
        if idx < len(p.data[artifact]):
            samples.append(p.data[artifact][idx])
    if not samples:
        return [], 0.0, 0.0
    arr = np.array(samples, dtype=float)
    return samples, float(np.mean(arr)), float(np.std(arr)) if len(arr) > 1 else 0.0
