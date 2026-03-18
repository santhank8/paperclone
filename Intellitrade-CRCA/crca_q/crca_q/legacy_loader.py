"""Load CR-CA/branches/CRCA-Q.py as a module (expects CR-CA on sys.path)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


def intellitrade_root() -> Path:
    """Intellitrade-CRCA directory (parent of crca_q package)."""
    return Path(__file__).resolve().parents[2]


def load_crca_q_branch_module() -> ModuleType:
    cr_ca = intellitrade_root() / "CR-CA"
    branch_file = cr_ca / "branches" / "CRCA-Q.py"
    if not branch_file.is_file():
        raise FileNotFoundError(
            f"CRCA-Q.py not found at {branch_file}. Set cwd to Intellitrade-CRCA or install CR-CA alongside.",
        )
    cr_ca_str = str(cr_ca)
    if cr_ca_str not in sys.path:
        sys.path.insert(0, cr_ca_str)
    name = "crca_q_legacy_crca_q_branch"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, branch_file)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load spec for {branch_file}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod
