import logging
from pathlib import Path
from typing import Any

from app.models.eva import EvaSchema
from app.models.ltv import LtvSchema
from app.models.ltv_errors import LtvErrorsSchema
from app.models.rover import RoverSchema

logger = logging.getLogger(__name__)

CONTEXT_FILE = Path(__file__).parent / "tss_context.txt"


def _format_key(key: str) -> str:
    replacements = {
        "oxy": "oxygen",
        "pri": "primary",
        "sec": "secondary",
        "co2": "carbon dioxide",
        "temp": "temperature",
        "rpm": "RPM",
        "pos": "position",
    }

    parts = key.split("_")
    return " ".join(replacements.get(part.lower(), part) for part in parts)


def _flatten_telemetry(data: dict[str, Any], prefix: str = "") -> list[str]:
    lines = []

    for key, value in data.items():
        current_key = f"{prefix} {key}".strip()

        if isinstance(value, dict):
            lines.extend(_flatten_telemetry(value, current_key))
        else:
            readable_key = _format_key(current_key)
            if isinstance(value, float):
                value = round(value, 2)
                lines.append(f"{readable_key} is {value}")

    return lines


async def build_and_save_context(
    eva: EvaSchema | None = None,
    rover: RoverSchema | None = None,
    ltv: LtvSchema | None = None,
    ltv_errors: LtvErrorsSchema | None = None,
) -> str:
    """Formats telemetry snapshots as readable text and writes to tss_context.txt."""
    sections: dict = {}
    if eva:
        sections["EVA"] = eva.model_dump()
    if rover:
        sections["ROVER"] = rover.model_dump()
    if ltv:
        sections["LTV"] = ltv.model_dump()
    if ltv_errors:
        sections["LTV_ERRORS"] = ltv_errors.model_dump()

    if not sections:
        text = "(No telemetry data available yet.)"
    else:
        text = "=== CURRENT TSS TELEMETRY SNAPSHOT ===\n"

        for name, data in sections.items():
            text += f"\n[{name}]\n"

            formatted_lines = _flatten_telemetry(data)

            for line in formatted_lines:
                text += f"- {line}\n"

    try:
        CONTEXT_FILE.write_text(text, encoding="utf-8")
    except Exception:
        logger.exception("Failed to write TSS context file")

    return text
