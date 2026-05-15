_TASKS: dict[str, tuple[str, range]] = {
    "A": ("Complete Pre-Navigation Checklist", range(1, 10)),
    "B": ("Navigate to LTV last known location", range(10, 15)),
    "C": ("Initial ping and calculate search area", range(15, 18)),
}

_PROCEDURES: dict[int, str] = {
    1:  "Pilot verbally confirm battery level is > 95%",
    2:  "Pilot verbally confirm O2 levels are > 95%",
    3:  "Pilot verbally confirm O2 pressure is > 2900 psi",
    4:  "Pilot verbally confirm PR Cabin Pressure is > 3.95 psi",
    5:  "Pilot verify PR headlights are operational by manually cycling lights ON, OFF, ON, OFF, ON, verbally confirm success",
    6:  "Pilot drop pin at current location, verbally confirm success",
    7:  "Drop pin at LTV last known position, verbally confirm success",
    8:  "Calculate optimal path to the LTV last nominal position",
    9:  "Verbally announce completion of checklist",
    10: "Begin navigation to LTV last nominal position",
    11: "Upon arrival, fully stop the PR, verbally confirm success",
    12: "Verbally announce arrival at LTV last nominal position",
    13: "Check telemetry data and look for any off-nominal values before proceeding",
    14: "Verbally announce beginning LTV search",
    15: "Send first ping, analyze the incoming RSSI (signal strength)",
    16: "Calculate a search area based on the LTV max speed and time away from last nominal position",
    17: "Set pin for next ping location and calculate optimal path of navigation",
}

_state: dict[int, bool] = {id: False for id in _PROCEDURES}


def _task_status(task_letter: str) -> str:
    _, r = _TASKS[task_letter]
    completed = sum(1 for id in r if _state[id])
    if completed == 0:
        return "NOT STARTED"
    if completed == len(r):
        return "COMPLETE"
    return "IN PROGRESS"


def _get_task_letter(procedure_id: int) -> str:
    for letter, (_, r) in _TASKS.items():
        if procedure_id in r:
            return letter
    return ""


def set_procedure(procedure_id: int, completed: bool) -> bool:
    """Set a procedure's completion status. Returns False if the id doesn't exist."""
    if procedure_id not in _state:
        return False
    _state[procedure_id] = completed
    return True


def get_all_procedures() -> list[dict]:
    return [
        {"id": id, "description": desc, "task": _get_task_letter(id), "completed": _state[id]}
        for id, desc in _PROCEDURES.items()
    ]


def get_procedures_context() -> str:
    lines = []
    for letter, (name, r) in _TASKS.items():
        status = _task_status(letter)
        lines.append(f"\n[Task {letter}: {name}] — {status}")
        for id in r:
            mark = "complete" if _state[id] else "incomplete"
            lines.append(f"  [{mark}] {id}. {_PROCEDURES[id]}")
    return "\n".join(lines)
