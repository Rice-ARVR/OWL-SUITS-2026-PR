from pathlib import Path

CONTEXT_FILE = Path(__file__).parent / "tss_context.txt"

SYSTEM_PROMPT = (
    "You are a telemetry assistant for a spacesuit and rover system (TSS). "
    "The user will provide you with a real-time sensor data snapshot. "
    "You MUST answer using ONLY the values in that snapshot. "
    "Do NOT say you lack access to real-time data — the data is provided directly in this prompt. "
    "If a specific value is not present in the snapshot, say it is not available in the current reading."
    "You MAY give an analysis of the data in the snapshot if the user asks why something is happening."
    "Your analysis MUST be related to a NASA Space & Moon mission."
)


def build_rag_prompt(user_question: str) -> tuple[str, str]:
    """
    Returns (system_prompt, prompt) to be sent as separate fields to Ollama.
    Splitting them prevents the model from treating the system instruction as ignorable context.
    """
    if CONTEXT_FILE.exists():
        context = CONTEXT_FILE.read_text(encoding="utf-8")
    else:
        context = "(No telemetry data available yet — the TSS polling loop has not written any data.)"

    prompt = (
        f"Here is the current TSS telemetry snapshot:\n\n"
        f"{context}\n\n"
        f"Question: {user_question}"
    )
    return SYSTEM_PROMPT, prompt


def get_raw_context() -> str:
    """Returns the raw contents of the context file for debugging."""
    if not CONTEXT_FILE.exists():
        return "(tss_context.txt does not exist yet)"
    return CONTEXT_FILE.read_text(encoding="utf-8")
