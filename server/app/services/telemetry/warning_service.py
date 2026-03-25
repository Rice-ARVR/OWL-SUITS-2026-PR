import json
import logging
from dataclasses import asdict

from app.core.ws_manager import WebSocketManager
from app.models.eva import Eva1Telemetry, Eva2Telemetry, EvaSchema
from app.models.ranges import NominalRange
from app.models.rover import PrTelemetry, RoverSchema
from app.models.warning import Warning

logger = logging.getLogger(__name__)


manager = WebSocketManager()


def _check_model(obj, model_class: type, source: str) -> list[Warning]:
    # TODO: save warnings to external source for historical tracking and analysis, not just broadcasting over WebSocket
    warnings = []
    # loop through all fields in given model
    # model = EVA1Telemetry, EVA2Telemetry, or PrTelemetry
    for field_name, field_info in model_class.model_fields.items():
        # loop through all telemetry values in given field and check against NominalRange metadata
        for meta in field_info.metadata:
            if isinstance(meta, NominalRange):
                value = getattr(obj, field_name)
                out_of_range = (
                    (meta.min is not None and value < meta.min)
                    or (meta.max is not None and value > meta.max)
                )
                off_nominal = (
                    not out_of_range
                    and meta.nominal is not None
                    and value != meta.nominal
                )
                if out_of_range or off_nominal:
                    warnings.append(Warning(
                        source=source,
                        field=field_name,
                        value=value,
                        min=meta.min,
                        max=meta.max,
                        nominal=meta.nominal,
                        out_of_range=out_of_range,
                        off_nominal=off_nominal,
                    ))
    return warnings


async def check_and_broadcast(eva: EvaSchema | None, rover: RoverSchema | None) -> None:
    warnings: list[Warning] = []

    if eva is not None:
        warnings += _check_model(eva.telemetry.eva1, Eva1Telemetry, "eva1")
        warnings += _check_model(eva.telemetry.eva2, Eva2Telemetry, "eva2")

    if rover is not None:
        warnings += _check_model(rover.pr_telemetry, PrTelemetry, "rover")

    await manager.broadcast(json.dumps([asdict(w) for w in warnings]))
