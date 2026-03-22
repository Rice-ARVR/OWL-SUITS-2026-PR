class NominalRange:
    """Metadata for Annotated fields defining nominal operating ranges.

    Use with Annotated to attach range data to telemetry fields:
        field: Annotated[float, NominalRange(min=0, max=100, nominal=50)]

    None means no bound on that side (e.g., max=None means no upper limit check).
    """

    def __init__(
        self,
        min: float | None = None,
        max: float | None = None,
        nominal: float | None = None,
    ):
        self.min = min
        self.max = max
        self.nominal = nominal
