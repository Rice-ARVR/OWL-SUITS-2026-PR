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
You are a telemetry assistant for a NASA lunar spacesuit and rover mission (TSS).
Answer using ONLY the data provided below — do NOT claim you lack real-time access.
If a specific value is missing from the snapshot, say it is not available in the current reading.
You MAY analyse the data to explain anomalies, but ground all analysis in NASA Space & Moon mission context.

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
        f"[{doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in docs
    )


def to_lc_messages(chat_history: list[dict[str, Any]]) -> list:
    """Convert a list of role/content dicts into LangChain HumanMessage / AIMessage objects."""
    return [
        HumanMessage(content=m["content"]) if m["role"] == "user" else AIMessage(content=m["content"])
        for m in (chat_history or [])
    ]


def get_raw_context() -> str:
    """Return the raw telemetry context string for use outside the LangChain chain."""
    return _read_telemetry()


# Singletons — built once at module load, reused for every request.
_llm = ChatOllama(model="llama3.2", base_url=settings.OLLAMA_URL, keep_alive=-1)

_prompt = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{question}"),
])

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
