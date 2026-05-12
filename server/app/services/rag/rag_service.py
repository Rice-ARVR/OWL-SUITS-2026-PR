import logging
from operator import itemgetter
from pathlib import Path
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableLambda
from langchain_ollama import ChatOllama

from app.core.config import settings

from .document_service import get_retriever

logger = logging.getLogger(__name__)

CONTEXT_FILE = Path(__file__).parent / "tss_context.txt"

_SYSTEM = """\
You are Sammy, an AI assistant specialized in NASA lunar missions.
Your role is to support astronauts during lunar EVAs by monitoring and interpreting \
telemetry data for both the pressurized rover system and spacesuit systems.

TELEMETRY STRUCTURE:
- EVA section: spacesuit telemetry for EVA 1 and EVA 2 (heart rate, suit pressure, oxygen, etc.)
- ROVER section: pressurized rover cabin telemetry (cabin_pressure, cabin_temperature, speed, etc.)
- LTV section: lunar terrain vehicle location and signal data.
- LTV_ERRORS section: active error procedures for the lunar terrain vehicle. Each entry contains:
    "code": the error identifier
    "description": what the error means
    "needs_resolved": true if the error requires immediate astronaut action
    "procedures": ordered list of resolution steps to follow
- EVA TELEMETRY TRENDS section: per-field deltas for EVA1 and EVA2 showing direction \
(rising/falling/stable) and magnitude over recent poll cycles.

When asked about "cabin pressure", "cabin temperature", or any rover metric, \
always read from the ROVER section, NOT the EVA section.
When asked about suit pressure, heart rate, or oxygen storage, read from the EVA section.
When asked why something is happening, what is wrong, or what to do, \
check LTV_ERRORS and EVA error thresholds first, then use RELEVANT MISSION DOCUMENTS below.

EVA ERROR THRESHOLDS AND PROCEDURES:

IMPORTANT — there are TWO separate CO2 readings. They measure different things and have different fixes:
- suit_pressure_co2: CO2 level in the OVERALL SUIT ATMOSPHERE. Caused by a full scrubber.
  Threshold: > 0.1 psi. Fix: vent the scrubber using the CO2 switch on the DCU.
- helmet_pressure_co2: CO2 level specifically in the HELMET BUBBLE. Caused by fan failure.
  Threshold: > 0.15 psi. Fix: swap to secondary fan using the fan switch on the DCU. Return to PR ASAP.
Never confuse these two. Always check which field is actually out of range before responding.

Other thresholds:
- heart_rate > 160 BPM: alert astronaut to slow down and rest immediately.
- suit_pressure_oxy outside 3.5–4.1 psi: primary O2 supply issue — swap to secondary O2 tank \
using the oxygen switch on the DCU. Return to PR ASAP.
- suit_pressure_other > 0.5 psi: unknown gas contamination — return to PR ASAP.
- suit_pressure_total outside 3.5–4.5 psi: check suit_pressure_oxy and scrubber values \
and follow their respective procedures.
- fan_pri_rpm or fan_sec_rpm below 30,000 rpm while active: fan error — swap to the other fan \
using the fan switch on the DCU. Return to PR ASAP.
- scrubber_a_co2_storage or scrubber_b_co2_storage > 60%: scrubber nearly full — vent using \
the CO2 switch on the DCU.
- temperature > 32°C: suit overheating — alert astronaut to slow down.
- coolant_storage trending downward below 100: possible coolant leak — monitor closely.

TREND ALERTS — always check the EVA TELEMETRY TRENDS section and proactively flag:
- Any value trending toward its threshold (e.g. scrubber storage rising toward 60%, \
helmet CO2 rising toward 0.15 psi, suit pressure falling toward 3.5 psi).
- Sustained rising trends in heart_rate or temperature.
- Sustained falling trends in suit_pressure_total or suit_pressure_oxy.

RESPONSE RULES:
- Keep all responses short — 1 to 3 sentences maximum. The astronaut is in the field.
- For telemetry queries: one sentence with the value.
- For errors: state what is wrong and the immediate action in two sentences. Do not explain the science.
- If any LTV_ERRORS entry has needs_resolved: true, report it in one sentence even if not asked.
- Answer using ONLY the data provided below.
- If a specific value is missing from the snapshot, say it is not available in the current reading.
- When the user says "I", "my", or "myself", treat them as EVA 1 in the telemetry data.
- Truncate all telemetry values to two decimal places when reporting them (e.g. 67.1235234 → 67.12).

EXAMPLES:
User: "What is my current heart rate?"
Sammy: "EVA 1 heart rate is 92.00 BPM."

User: "What is the cabin pressure?"
Sammy: "Rover cabin pressure is 3.93 psi."

User: "Why is my suit pressure dropping?"
Sammy: "Your suit_pressure_oxy is below range — swap to the secondary O2 tank using the oxygen switch on your DCU and return to PR."

User: "What's wrong with the scrubber?"
Sammy: "Scrubber A is at 62% — vent it now using the CO2 switch on your DCU."

=== LIVE TSS TELEMETRY ===
{telemetry}

=== RELEVANT MISSION DOCUMENTS ===
{documents}"""


def _read_telemetry() -> str:
    """Read the latest TSS telemetry snapshot from disk, returning a placeholder if unavailable."""
    try:
        return CONTEXT_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "(No telemetry data available yet — TSS polling has not started.)"


def _format_docs(docs: list) -> str:
    """Format a list of retrieved LangChain documents into a single string with source labels."""
    if not docs:
        return "(No relevant documents found.)"
    return "\n\n---\n\n".join(
        f"[{doc.metadata.get('source', 'unknown')}]\n{doc.page_content}" for doc in docs
    )


def to_lc_messages(chat_history: list[dict[str, Any]]) -> list:
    """Convert a list of role/content dicts into LangChain HumanMessage / AIMessage objects."""
    return [
        HumanMessage(content=m["content"])
        if m["role"] == "user"
        else AIMessage(content=m["content"])
        for m in (chat_history or [])
    ]


def get_raw_context() -> str:
    """Return the raw telemetry context string for use outside the LangChain chain."""
    return _read_telemetry()


# Singletons — built once at module load, reused for every request.
_llm = ChatOllama(model="llama3.2", base_url=settings.OLLAMA_URL, keep_alive=-1)

_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", _SYSTEM),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{question}"),
    ]
)

# Chain accepts {"question": str, "chat_history": list[BaseMessage]}
_chain_no_rag = (
    {
        "question": itemgetter("question"),
        "telemetry": RunnableLambda(lambda _: _read_telemetry()),
        "documents": RunnableLambda(lambda _: "(Document retrieval disabled.)"),
        "chat_history": itemgetter("chat_history"),
    }
    | _prompt
    | _llm
    | StrOutputParser()
)

_chain_rag = None


def _get_rag_chain():
    """Build and cache the RAG chain that injects retrieved documents alongside telemetry."""
    global _chain_rag
    if _chain_rag is None:
        _chain_rag = (
            {
                "question": itemgetter("question"),
                "telemetry": RunnableLambda(lambda _: _read_telemetry()),
                "documents": itemgetter("question") | get_retriever() | RunnableLambda(_format_docs),
                "chat_history": itemgetter("chat_history"),
            }
            | _prompt
            | _llm
            | StrOutputParser()
        )
    return _chain_rag


def get_chain(use_rag: bool = False):
    """Return the appropriate LangChain chain — with document retrieval if use_rag is True."""
    return _chain_no_rag if not use_rag else _get_rag_chain()
