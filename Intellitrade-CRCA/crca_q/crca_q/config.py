"""Trading/risk config; extend as CR-CA logic is migrated out of branches/CRCA-Q.py."""

from pydantic import BaseModel


class RiskLimits(BaseModel):
    max_position_size: float = 0.2
    stop_loss_pct: float = -10.0
