"""Temporal linear-Gaussian SCM: time-indexed variables and lagged parents.

Supports path (variable, time) assignment, abduction from path, and forward
simulation along a single branch. Framework-agnostic interface for Phase 6–7.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Mapping, Optional, Tuple

import numpy as np

from crca_core.models.spec import (
    InterventionSchedule,
    PathValues,
    SCMSpec,
    StructuralEquationSpec,
    TemporalConfig,
)


@dataclass(frozen=True)
class TemporalLinearGaussianSCM:
    """Linear SCM with optional lagged parents for temporal simulation."""

    variables: Tuple[str, ...]
    parents: Dict[str, Tuple[str, ...]]
    coefficients: Dict[Tuple[str, str], float]
    intercepts: Dict[str, float]
    parent_lags: Dict[Tuple[str, str], int]  # (parent, child) -> lag (0 or negative)
    temporal: Optional[TemporalConfig] = None
    noise_cov: Optional[np.ndarray] = None

    @classmethod
    def from_spec(cls, spec: SCMSpec) -> "TemporalLinearGaussianSCM":
        if spec.scm_type != "linear_gaussian":
            raise ValueError(f"Unsupported scm_type: {spec.scm_type}")

        variables: List[str] = []
        parents: Dict[str, Tuple[str, ...]] = {}
        coefficients: Dict[Tuple[str, str], float] = {}
        intercepts: Dict[str, float] = {}
        parent_lags: Dict[Tuple[str, str], int] = {}

        for eq in spec.equations:
            if eq.form != "linear_gaussian":
                raise ValueError(f"Unsupported equation form: {eq.form}")
            v = eq.variable
            if v in variables:
                raise ValueError(f"Duplicate equation for variable: {v}")
            variables.append(v)
            parents[v] = tuple(eq.parents)
            intercepts[v] = float(eq.intercept)
            for p in eq.parents:
                coefficients[(p, v)] = float(eq.coefficients.get(p, 0.0))
                lag = 0
                if eq.parent_lags is not None and p in eq.parent_lags:
                    lag = int(eq.parent_lags[p])
                parent_lags[(p, v)] = lag

        noise_cov = None
        if spec.noise_cov is not None:
            noise_cov = np.array(spec.noise_cov, dtype=float)
            if noise_cov.shape[0] != noise_cov.shape[1] or noise_cov.shape[0] != len(variables):
                raise ValueError("noise_cov must be square and match number of variables")

        return cls(
            variables=tuple(variables),
            parents=parents,
            coefficients=coefficients,
            intercepts=intercepts,
            parent_lags=parent_lags,
            temporal=spec.temporal,
            noise_cov=noise_cov,
        )

    def _min_lag(self) -> int:
        """Minimum lag (most negative) across all parent_lags."""
        if not self.parent_lags:
            return 0
        return min(self.parent_lags.values())

    def _is_temporal(self) -> bool:
        return any(lag != 0 for lag in self.parent_lags.values())

    def _topological_order(self) -> List[str]:
        """Variable order for same-time dependencies (no lag)."""
        order: List[str] = []
        seen: set = set()
        deps = {v: set(self.parents.get(v, ())) for v in self.variables}
        # Only same-time edges (lag == 0)
        for (p, c), lag in self.parent_lags.items():
            if lag != 0:
                deps[c] = deps[c] - {p}
        while len(order) < len(self.variables):
            for v in self.variables:
                if v in seen:
                    continue
                if deps[v].issubset(seen):
                    order.append(v)
                    seen.add(v)
                    break
            else:
                raise ValueError("SCM has a cycle among same-time dependencies")
        return order

    def run_one_trajectory(
        self,
        u_path: Dict[str, List[float]],
        *,
        initial: Optional[Dict[str, float]] = None,
        interventions: Optional[InterventionSchedule] = None,
        times: Optional[List[int]] = None,
    ) -> PathValues:
        """Forward simulate one trajectory; returns path (variable -> list of values per time)."""
        min_lag = self._min_lag()
        if times is None:
            t_cfg = self.temporal
            if t_cfg is None:
                # Infer from u_path length
                n = max(len(u_path.get(v, [])) for v in self.variables) if u_path else 0
                times = list(range(n)) if n else [0]
            else:
                t_end = t_cfg.t_end if t_cfg.t_end is not None else 50
                times = list(range(t_cfg.t_start, t_end + 1, max(1, t_cfg.step)))
        by_time: Dict[int, Dict[str, float]] = {}
        inter_by_t = (interventions.by_time or {}) if interventions else {}

        t0 = min(times)
        for t in times:
            state: Dict[str, float] = {}
            for v in self._topological_order():
                if (inter_by_t.get(t) or {}).get(v) is not None:
                    state[v] = float(inter_by_t[t][v])
                    continue
                pred = self.intercepts.get(v, 0.0)
                for p in self.parents.get(v, ()):
                    lag = self.parent_lags.get((p, v), 0)
                    pt = t + lag
                    if pt == t:
                        val = state.get(p)
                    elif pt in by_time and p in by_time[pt]:
                        val = by_time[pt][p]
                    elif initial is not None and pt < t0 and p in initial:
                        val = initial[p]
                    else:
                        val = None
                    if val is not None:
                        pred += self.coefficients.get((p, v), 0.0) * val
                u_list = u_path.get(v, [])
                idx = times.index(t) if t in times else None
                u_val = float(u_list[idx]) if idx is not None and idx < len(u_list) else 0.0
                state[v] = float(pred + u_val)
            by_time[t] = state

        data = {v: [by_time[t][v] for t in times] for v in self.variables}
        return PathValues(times=times, data=data)

    def abduce_noise_from_path(
        self,
        path: PathValues,
        *,
        allow_partial: bool = False,
    ) -> Dict[str, List[float]]:
        """Infer U trajectory from observed path. Returns var -> list of U values (one per time in path.times)."""
        u_path: Dict[str, List[float]] = {v: [] for v in self.variables}
        by_t: Dict[int, Dict[str, float]] = {}
        for i, t in enumerate(path.times):
            by_t[t] = {
                v: path.data[v][i]
                for v in path.data
                if v in self.variables and i < len(path.data.get(v, []))
            }
        for i, t in enumerate(path.times):
            for v in self._topological_order():
                if v not in path.data or i >= len(path.data[v]):
                    if allow_partial:
                        continue
                    raise ValueError(f"Path missing {v} at t={t}")
                x_v = path.data[v][i]
                pred = self.intercepts.get(v, 0.0)
                for p in self.parents.get(v, ()):
                    lag = self.parent_lags.get((p, v), 0)
                    pt = t + lag
                    if pt in by_t and p in by_t[pt]:
                        pred += self.coefficients.get((p, v), 0.0) * by_t[pt][p]
                    elif allow_partial:
                        pass
                    else:
                        raise ValueError(
                            f"Path missing parent {p} at t={pt} (needed for {v} at t={t})"
                        )
                u_path.setdefault(v, []).append(float(x_v - pred))
        return u_path
