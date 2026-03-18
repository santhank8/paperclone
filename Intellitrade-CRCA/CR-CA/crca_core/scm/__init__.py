"""SCM implementations for `crca_core`.

Counterfactuals require an explicit SCM. v0.1 implements linear-Gaussian SCMs
and temporal linear-Gaussian (lagged parents, path/branch).
"""

from crca_core.scm.linear_gaussian import LinearGaussianSCM
from crca_core.scm.temporal_linear_gaussian import TemporalLinearGaussianSCM

__all__ = ["LinearGaussianSCM", "TemporalLinearGaussianSCM"]

