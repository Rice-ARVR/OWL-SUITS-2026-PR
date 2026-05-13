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
When asked about "cabin pressure", "cabin temperature", or any rover metric, \
always read from the ROVER section, NOT the EVA section.
When asked about suit pressure, heart rate, or oxygen storage, read from the EVA section.

RESPONSE RULES:
- Be short and concise: 40 words maximum per response.
- Do not provide any additional information not asked by the user.
- Answer using ONLY the data provided below.
- If a specific value is missing from the snapshot, say it is not available in the current reading.
- When the user says "I", "my", or "myself", treat them as EVA 1 in the telemetry data.
- You MAY analyse data to explain anomalies, but ground all analysis in NASA space and lunar mission context.
- Truncate all telemetry values to two decimal places when reporting them (e.g. 67.1235234 → 67.12).

EXAMPLES:
User: "What is my current heart rate?"
Sammy: "EVA 1 heart rate is 92.00 BPM."

User: "What is the cabin pressure?"
Sammy: "Rover cabin pressure is 3.93 psi."

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
                "documents": get_retriever() | RunnableLambda(_format_docs),
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
