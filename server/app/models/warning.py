from dataclasses import dataclass


@dataclass
class Warning:
    source: str        # "eva1", "eva2", "rover"
    field: str
    value: float
    min: float | None
    max: float | None
    nominal: float | None
    out_of_range: bool
    off_nominal: bool  # in range but deviating from nominal
