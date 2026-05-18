from typing import Any
from app.services.telemetry.replacements import get_replacements


def _format_label(key: str) -> str:
    replacements = get_replacements()
    parts = key.lower().split("_")
    for i in range(len(parts)):
        candidate = "_".join(parts[i:])
        if candidate in replacements:
            return replacements[candidate]
    return " ".join(parts).title()


def _infer_unit(key: str) -> str | None:
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


def _infer_status(key: str, value: Any) -> str:
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


def _build_action_widget(key: str, label: str, status: str, source: str = "") -> dict[str, Any] | None:
    if status not in ("warning", "critical"):
        return None

    key_lower = key.lower()
    severity = status.title()

    if "battery" in key_lower or "power" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Switch to backup power?",
            "actionLabel": "Switch Backup Power",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "switch_backup_power",
                "target": key,
                "value": True,
            },
        }

    if "oxygen" in key_lower or "oxy" in key_lower or "o2" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Find out how to switch oxygen source or verify oxygen supply?",
            "actionLabel": "Check Oxygen",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "check_oxygen_system",
                "target": key,
                "value": True,
            },
        }

    if "co2" in key_lower or "carbon_dioxide" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Activate or inspect the scrubber system?",
            "actionLabel": "Find out how to check scrubber?",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "check_scrubber_system",
                "target": key,
                "value": True,
            },
        }

    if "scrubber" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Inspect scrubber status?",
            "actionLabel": "See how to inspect scrubber?",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "inspect_scrubber",
                "target": key,
                "value": True,
            },
        }

    if "fan" in key_lower or "rpm" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Find out how to switch fan channel or inspect ventilation?",
            "actionLabel": "Check Fan",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "check_fan_system",
                "target": key,
                "value": True,
            },
        }

    if "coolant" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Inspect coolant system?",
            "actionLabel": "See how to check coolant?",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "check_coolant_system",
                "target": key,
                "value": True,
            },
        }

    if "cabin_temperature" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": "Cabin Temperature Low",
            "description": "Turn on fan heating?",
            "actionLabel": "Find out how to turn on Heating",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "turn_on",
                "target": "fan_heating",
                "value": True,
            },
        }

    if "temperature" in key_lower or "temp" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Review thermal controls?",
            "actionLabel": "Review Thermal",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "review_thermal_status",
                "target": key,
                "value": True,
            },
        }

    if "pressure" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Check pressure system?",
            "actionLabel": "Find out how to check pressure?",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "check_pressure_system",
                "target": key,
                "value": True,
            },
        }

    if "signal" in key_lower or "rssi" in key_lower or "comm" in key_lower:
        return {
            "type": "system_action",
            "id": f"{key}_action",
            "title": f"{label} {severity}",
            "description": "Run communication signal check?",
            "actionLabel": "See how to check signal?",
            "confirmText": "Yes",
            "cancelText": "No",
            "source": source,
            "payload": {
                "action": "check_signal",
                "target": key,
                "value": True,
            },
        }

    return {
        "type": "system_action",
        "id": f"{key}_action",
        "title": f"{label} {severity}",
        "description": "Review this telemetry issue?",
        "actionLabel": "Review",
        "confirmText": "Yes",
        "cancelText": "No",
        "source": source,
        "payload": {
            "action": "review_telemetry",
            "target": key,
            "value": True,
        },
    }

    return None


def flatten_widget_candidates(
    data: dict[str, Any],
    prefix: str = "",
    source: str = "",
) -> list[dict[str, Any]]:
    widgets = []

    for key, value in data.items():
        current_key = f"{prefix}_{key}" if prefix else key

        if isinstance(value, dict):
            widgets.extend(flatten_widget_candidates(value, current_key, source))
        else:
            display_value = round(value, 2) if isinstance(value, float) else value

            status = _infer_status(current_key, value)
            label = _format_label(current_key)
            telemetry_widget = {
                "type": "telemetry",
                "id": current_key,
                "key": current_key,
                "telemetryKey": current_key,
                "label": label,
                "name": label,
                "value": display_value,
                "unit": _infer_unit(current_key),
                "status": status,
                "source": source,
            }

            widgets.append(telemetry_widget)

    return widgets


def select_widgets_for_prompt(
    prompt: str,
    sections: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    prompt_lower = prompt.lower()

    required_terms = []

    if "external" in prompt_lower:
        required_terms.append("external")
    if "cabin" in prompt_lower:
        required_terms.append("cabin")
    if "coolant" in prompt_lower:
        required_terms.append("coolant")
    if "primary" in prompt_lower:
        required_terms.append("primary")
    if "secondary" in prompt_lower:
        required_terms.append("secondary")
    if "suit" in prompt_lower:
        required_terms.append("suit")
    if "helmet" in prompt_lower:
        required_terms.append("helmet")

    requested_sources = []

    requested_entities = []

    if "eva 1" in prompt_lower or "eva1" in prompt_lower:
        requested_entities.append("eva1")
    if "eva 2" in prompt_lower or "eva2" in prompt_lower:
        requested_entities.append("eva2")

    if "rover" in prompt_lower:
        requested_sources.append("ROVER")
    if "eva 1" in prompt_lower or "eva1" in prompt_lower:
        requested_sources.append("EVA")
    if "eva 2" in prompt_lower or "eva2" in prompt_lower:
        requested_sources.append("EVA")
    if "ltv" in prompt_lower:
        requested_sources.append("LTV")

    keyword_groups = {
        "heart": ["heart_rate"],
        "oxygen": ["oxygen", "oxy", "o2"],
        "o2": ["oxygen", "oxy", "o2"],
        "co2": ["co2", "carbon_dioxide"],
        "carbon dioxide": ["co2", "carbon_dioxide"],
        "battery": ["battery"],
        "power": ["power"],
        "pressure": ["pressure"],
        "temperature": ["temperature", "temp"],
        "coolant": ["coolant"],
        "fan": ["fan", "rpm"],
        "rpm": ["rpm"],
        "speed": ["speed"],
        "throttle": ["throttle"],
        "steering": ["steering"],
        "brakes": ["brakes"],
        "location": ["pos", "position", "coordinate", "heading"],
        "position": ["pos", "position"],
        "coordinates": ["pos", "position", "coordinate"],
        "heading": ["heading"],
        "distance": ["distance"],
        "traveled": ["distance_traveled"],
        "base": ["distance_from_base"],
        "pitch": ["pitch"],
        "roll": ["roll"],
        "incline": ["incline"],
        "sunlight": ["sunlight"],
        "storage": ["storage"],
        "scrubber": ["scrubber"],
        "signal": ["signal", "rssi", "strength"],
        "rssi": ["signal", "rssi", "strength"],
        "ping": ["ping"],
        "elapsed": ["elapsed_time"],
        "time": ["elapsed_time"],
    }

    active_terms = []

    for word, terms in keyword_groups.items():
        if word in prompt_lower:
            active_terms.extend(terms)

    if not active_terms:
        return []

    all_widgets = []

    for source, data in sections.items():
        all_widgets.extend(flatten_widget_candidates(data, source=source))

    matched_widgets = []

    for widget in all_widgets:
        if requested_sources and widget["source"] not in requested_sources:
            continue

        key = widget["key"].lower()
        label = widget["label"].lower()

        if requested_entities and not any(
            entity in key for entity in requested_entities
        ):
            continue

        if required_terms and not all(
            term in key or term in label for term in required_terms
        ):
            continue

        if any(term in key or term in label for term in active_terms):
            matched_widgets.append(widget)

            action_widget = _build_action_widget(
                widget["key"],
                widget["label"],
                widget["status"],
                widget["source"],
            )

            if action_widget:
                matched_widgets.append(action_widget)

    return matched_widgets[:6]
