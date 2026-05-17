from typing import Any
from app.services.telemetry.replacements import get_replacements


def format_key(key: str) -> str:
    replacements = get_replacements()

    parts = key.lower().split("_")

    # Try longest matching suffix first (handles prefixed keys like "eva_primary_battery_level")
    for i in range(len(parts)):
        candidate = "_".join(parts[i:])
        if candidate in replacements:
            return replacements[candidate]

    return " ".join(part.capitalize() for part in parts)


def flatten_telemetry_text(
    data: dict[str, Any],
    prefix: str = "",
) -> list[str]:
    lines = []

    for key, value in data.items():
        current_key = f"{prefix}_{key}" if prefix else key

        if isinstance(value, dict):
            lines.extend(flatten_telemetry_text(value, current_key))
        else:
            readable_key = format_key(current_key)

            if isinstance(value, float):
                value = round(value, 2)

            lines.append(f"{readable_key} is {value}")

    return lines


def infer_unit(key: str) -> str | None:
    key = key.lower()

    if "heart_rate" in key:
        return "bpm"
    if "temperature" in key or "temp" in key:
        return "°C"
    if "pressure" in key:
        return "psi"
    if "storage" in key or "battery" in key:
        return "%"
    if "rpm" in key:
        return "rpm"
    if "speed" in key:
        return "m/s"

    return None


def infer_status(key: str, value: Any) -> str:
    if value is None:
        return "unknown"

    if not isinstance(value, (int, float)):
        return "normal"

    key = key.lower()

    if "battery" in key or "storage" in key:
        if value < 20:
            return "critical"
        if value < 40:
            return "warning"

    if "heart_rate" in key:
        if value > 140 or value < 45:
            return "warning"

    if "temperature" in key or "temp" in key:
        if value > 38 or value < 0:
            return "warning"

    return "normal"


def flatten_telemetry_widgets(
    data: dict[str, Any],
    prefix: str = "",
    source: str = "",
) -> list[dict[str, Any]]:
    widgets = []

    for key, value in data.items():
        current_key = f"{prefix}_{key}" if prefix else key

        if isinstance(value, dict):
            widgets.extend(flatten_telemetry_widgets(value, current_key, source))
        else:
            display_value = round(value, 2) if isinstance(value, float) else value

            widgets.append(
                {
                    "type": "telemetry",
                    "key": current_key,
                    "label": format_key(current_key),
                    "value": display_value,
                    "unit": infer_unit(current_key),
                    "status": infer_status(current_key, value),
                    "source": source,
                }
            )

    return widgets


def select_widgets_for_prompt(
    prompt: str,
    sections: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    prompt_lower = prompt.lower()

    keyword_groups = {
        "heart": ["heart_rate"],
        "oxygen": ["oxygen", "oxy", "o2"],
        "o2": ["oxygen", "oxy", "o2"],
        "battery": ["battery"],
        "pressure": ["pressure"],
        "temperature": ["temperature", "temp"],
        "coolant": ["coolant"],
        "fan": ["fan", "rpm"],
        "speed": ["speed"],
        "location": ["pos", "position", "coordinate", "heading"],
        "heading": ["heading"],
        "storage": ["storage"],
    }

    active_terms = []

    for word, terms in keyword_groups.items():
        if word in prompt_lower:
            active_terms.extend(terms)

    if not active_terms:
        return []

    all_widgets = []

    for source, data in sections.items():
        all_widgets.extend(flatten_telemetry_widgets(data, source=source))

    matched_widgets = []

    for widget in all_widgets:
        key = widget["key"].lower()
        label = widget["label"].lower()

        if any(term in key or term in label for term in active_terms):
            matched_widgets.append(widget)

    return matched_widgets[:6]
