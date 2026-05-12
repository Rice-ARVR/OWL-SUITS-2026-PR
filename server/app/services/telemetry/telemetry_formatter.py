from typing import Any


def format_key(key: str) -> str:
    replacements = {
        "oxy": "oxygen",
        "o2": "oxygen",
        "pri": "primary",
        "sec": "secondary",
        "co2": "carbon dioxide",
        "temp": "temperature",
        "rpm": "RPM",
        "pos": "position",
    }

    parts = key.split("_")

    return " ".join(replacements.get(part.lower(), part) for part in parts)


def flatten_telemetry(
    data: dict[str, Any],
    prefix: str = "",
) -> list[str]:

    lines = []

    for key, value in data.items():
        current_key = f"{prefix} {key}".strip()

        if isinstance(value, dict):
            lines.extend(flatten_telemetry(value, current_key))

        else:
            readable_key = format_key(current_key)

            if isinstance(value, float):
                value = round(value, 2)

            lines.append(f"{readable_key} is {value}")

    return lines
