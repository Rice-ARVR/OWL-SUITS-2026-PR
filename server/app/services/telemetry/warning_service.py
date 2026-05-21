import json
import logging
import os
import pathlib
from dataclasses import asdict

from app.core.ws_manager import WebSocketManager
from app.models.eva import Eva1Telemetry, Eva2Telemetry, EvaSchema
from app.models.ranges import NominalRange
from app.models.rover import PrTelemetry, RoverSchema
from app.models.warning import Warning

logger = logging.getLogger(__name__)

manager = WebSocketManager()

_REASONS_PATH = (
    pathlib.Path(__file__).parent.parent.parent.parent / "data" / "warning_reasons.json"
)

_WARNINGS_PATH = (
    pathlib.Path(__file__).parent.parent.parent.parent
    / "app"
    / "services"
    / "rag"
    / "active_warnings.json"
)


def _load_reasons() -> dict:
    try:
        with open(_REASONS_PATH) as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(
            "warning_reasons.json not found at %s — reasons will be empty",
            _REASONS_PATH,
        )
        return {}


_REASONS: dict = _load_reasons()


def _resolve_reason_key(
    value: float, meta: NominalRange, out_of_range: bool, off_nominal: bool
) -> str:
    if out_of_range:
        return "low" if (meta.min is not None and value < meta.min) else "high"
    if off_nominal:
        return "below_nominal" if value < meta.nominal else "above_nominal"
    return ""


def _check_model(obj, model_class: type, source: str) -> list[Warning]:
    # TODO: save warnings to external source for historical tracking and analysis, not just broadcasting over WebSocket
    warnings = []
    # loop through all fields in given model
    # model = EVA1Telemetry, EVA2Telemetry, or PrTelemetry
    for field_name, field_info in model_class.model_fields.items():
        # 5/18/26 -> bug in TSS, these fields are unused
        # tech team said they'll address it, but for day 1 test let's just ignore here
        # TODO address this issue for AIA later
        if source == "rover" and field_name in (
            "battery_level",
            "secondary_battery_level",
            "fan_pri_rpm",
            "fan_sec_rpm",
            "throttle",
            "steering",
            "rover_pos_x",
            "rover_pos_y",
            "rover_pos_z",
            "heading",
            "pitch",
            "roll",
            "distance_traveled",
            "speed",
            "surface_incline",
            "cabin_temperature_target",
        ):
            continue
        if model_class == Eva2Telemetry:
            # we only care about EVA1 this year
            continue
        # loop through all telemetry values in given field and check against NominalRange metadata
        for meta in field_info.metadata:
            if isinstance(meta, NominalRange):
                value = getattr(obj, field_name)
                out_of_range = (meta.min is not None and value < meta.min) or (
                    meta.max is not None and value > meta.max
                )
                off_nominal = (
                    not out_of_range
                    and meta.nominal is not None
                    and value != meta.nominal
                )
                if out_of_range:
                    reason_key = _resolve_reason_key(
                        value, meta, out_of_range, off_nominal
                    )
                    field_reasons = _REASONS.get(field_name)
                    if field_reasons is None:
                        logger.warning(
                            "No reasons defined for field '%s' in warning_reasons.json",
                            field_name,
                        )
                        reason = ""
                    else:
                        reason = field_reasons.get(reason_key, "")
                    warnings.append(
                        Warning(
                            source=source,
                            field=field_name,
                            value=value,
                            min=meta.min,
                            max=meta.max,
                            nominal=meta.nominal,
                            out_of_range=out_of_range,
                            off_nominal=off_nominal,
                            reason=reason,
                        )
                    )
    return warnings


def _export_warnings(warnings: list[Warning]) -> None:
    payload = json.dumps([asdict(w) for w in warnings], indent=2, ensure_ascii=False)
    tmp = _WARNINGS_PATH.with_suffix(".json.tmp")
    try:
        tmp.write_text(payload, encoding="utf-8")
        os.replace(tmp, _WARNINGS_PATH)
    except Exception:
        logger.exception("Failed to write active_warnings.json")


async def check_and_broadcast(eva: EvaSchema | None, rover: RoverSchema | None) -> None:
    warnings: list[Warning] = []

    if eva is not None:
        warnings += _check_model(eva.telemetry.eva1, Eva1Telemetry, "eva1")
        warnings += _check_model(eva.telemetry.eva2, Eva2Telemetry, "eva2")

    if rover is not None:
        warnings += _check_model(rover.pr_telemetry, PrTelemetry, "rover")

    serialized = [asdict(w) for w in warnings]
    await manager.broadcast(json.dumps(serialized))
    _export_warnings(warnings)
