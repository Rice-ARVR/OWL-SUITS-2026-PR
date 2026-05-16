import logging
import time
from collections import deque
from pathlib import Path

from app.models.eva import EvaSchema
from app.models.ltv import LtvSchema
from app.models.ltv_errors import LtvErrorsSchema
from app.models.rover import RoverSchema
from app.services.telemetry.telemetry_formatter import flatten_telemetry_text

logger = logging.getLogger(__name__)

CONTEXT_FILE = Path(__file__).parent / "tss_context.txt"

_TREND_FIELDS = [
    "heart_rate",
    "suit_pressure_oxy",
    "suit_pressure_co2",
    "suit_pressure_other",
    "suit_pressure_total",
    "helmet_pressure_co2",
    "fan_pri_rpm",
    "fan_sec_rpm",
    "scrubber_a_co2_storage",
    "scrubber_b_co2_storage",
    "temperature",
    "coolant_storage",
    "coolant_gas_pressure",
]

# Stores (timestamp, eva1_dict, eva2_dict) — last 10 poll cycles
_eva_history: deque = deque(maxlen=10)

_latest_sections: dict = {}


def _compute_trends(current_eva1: dict, current_eva2: dict) -> str:
    if len(_eva_history) < 2:
        return "=== EVA TELEMETRY TRENDS ===\n(Insufficient history — trends available after a few poll cycles.)"

    oldest_ts, oldest_eva1, oldest_eva2 = _eva_history[0]
    elapsed = time.monotonic() - oldest_ts
    if elapsed < 0.1:
        elapsed = 0.1

    lines = [f"=== EVA TELEMETRY TRENDS (last ~{elapsed:.0f}s) ==="]

    for label, current, oldest in (
        ("EVA1", current_eva1, oldest_eva1),
        ("EVA2", current_eva2, oldest_eva2),
    ):
        lines.append(f"\n[{label}]")
        for field in _TREND_FIELDS:
            curr = current.get(field)
            old = oldest.get(field)
            if curr is None or old is None:
                continue
            delta = curr - old
            if abs(delta) < 0.01:
                arrow, direction = "→", "stable"
            elif delta > 0:
                arrow, direction = "↑", "rising"
            else:
                arrow, direction = "↓", "falling"
            lines.append(
                f"  {field}: {curr:.2f}  [{arrow} {delta:+.2f} over {elapsed:.0f}s — {direction}]"
            )

    return "\n".join(lines)


async def build_and_save_context(
    eva: EvaSchema | None = None,
    rover: RoverSchema | None = None,
    ltv: LtvSchema | None = None,
    ltv_errors: LtvErrorsSchema | None = None,
) -> str:
    """Formats telemetry snapshots as readable text and writes to tss_context.txt."""
    sections: dict = {}
    eva_dump = eva.model_dump() if eva else None
    if eva_dump:
        sections["EVA"] = eva_dump
    if rover:
        sections["ROVER"] = rover.model_dump()
    if ltv:
        sections["LTV"] = ltv.model_dump()
    if ltv_errors:
        sections["LTV_ERRORS"] = ltv_errors.model_dump()

    global _latest_sections
    _latest_sections = sections

    if not sections:
        text = "(No telemetry data available yet.)"
    else:
        text = "=== CURRENT TSS TELEMETRY SNAPSHOT ===\n"

        for name, data in sections.items():
            text += f"\n[{name}]\n"

            formatted_lines = flatten_telemetry_text(data)

            for line in formatted_lines:
                text += f"- {line}\n"

    if eva_dump:
        eva1 = eva_dump.get("telemetry", {}).get("eva1", {})
        eva2 = eva_dump.get("telemetry", {}).get("eva2", {})
        _eva_history.append((time.monotonic(), eva1, eva2))
        text += "\n\n" + _compute_trends(eva1, eva2)

    try:
        CONTEXT_FILE.write_text(text, encoding="utf-8")
    except Exception:
        logger.exception("Failed to write TSS context file")

    return text


def get_current_telemetry_sections() -> dict:
    return _latest_sections
