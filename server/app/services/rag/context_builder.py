import json
import logging
from pathlib import Path

from app.models.eva import EvaSchema
from app.models.ltv import LtvSchema
from app.models.ltv_errors import LtvErrorsSchema
from app.models.rover import RoverSchema

logger = logging.getLogger(__name__)

CONTEXT_FILE = Path(__file__).parent / "tss_context.txt"


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
            text += f"\n[{name}]\n{json.dumps(data, indent=2)}\n"

    try:
        CONTEXT_FILE.write_text(text, encoding="utf-8")
    except Exception:
        logger.exception("Failed to write TSS context file")

    return text
