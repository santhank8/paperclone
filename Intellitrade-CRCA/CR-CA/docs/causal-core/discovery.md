# Discovery

**Where it lives:** `crca_core.discovery.tabular`, `crca_core.timeseries.pcmci`

Causal discovery produces **hypotheses** (graphs / structure) from data. Both modules are wrap-first: if the required backend is missing, they return a **RefusalResult** with an actionable checklist instead of falling back to unvalidated heuristics.

---

## Tabular discovery

**Module:** `crca_core.discovery.tabular`

```python
class TabularDiscoveryConfig(BaseModel):
    algorithm: Literal["pc", "fci", "ges"] = "pc"
    alpha: float = 0.05
    bootstrap_samples: int = 0
    ci_test: Literal["fisherz", "gsq", "chisq"] = "fisherz"
    stable: bool = True
    min_samples: int = 200
    notes: Optional[str] = None

def discover_tabular(
    data: Any,
    discovery_config: Optional[TabularDiscoveryConfig] = None,
    assumptions: Optional[List[str]] = None,
) -> DiscoveryHypothesisResult | RefusalResult:
```

**Behaviour:** Uses **causal-learn** (`causallearn`) when available. Builds a schema-level signature for provenance (no raw data hashing). If `causallearn` is not installed, returns **RefusalResult** with `RefusalReasonCode.UNSUPPORTED_OPERATION` and suggested_next_steps (e.g. install causal-learn).

**DiscoveryHypothesisResult** carries provenance, algorithm config, and the discovered structure (e.g. graph or adjacency). Discovery is **hypothesis generation only**; the result should be validated and locked before use in identification/estimation.

---

## Time-series discovery (PCMCI / PCMCI+)

**Module:** `crca_core.timeseries.pcmci`

```python
class PCMCIConfig(BaseModel):
    max_lag: int = 5
    alpha: float = 0.05
    variant: Literal["pcmci", "pcmci_plus"] = "pcmci"
    time_index_column: Optional[str] = None
    assume_sorted: bool = False
    min_samples: int = 200
    notes: Optional[str] = None

def discover_timeseries_pcmci(
    data: Any,
    config: Optional[PCMCIConfig] = None,
    assumptions: Optional[List[str]] = None,
) -> DiscoveryHypothesisResult | RefusalResult:
```

**Behaviour:** Uses **tigramite** when available. If not installed, returns **RefusalResult** with `UNSUPPORTED_OPERATION` and suggested_next_steps (e.g. `pip install tigramite`). Builds schema-only signature for provenance. Runs PCMCI or PCMCI+ according to `config.variant` and returns **DiscoveryHypothesisResult** or refuses.

Data is expected in a form compatible with tigramite (e.g. pandas DataFrame with time index when relevant).
