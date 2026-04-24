import logging
from pathlib import Path

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda, RunnablePassthrough
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
    try:
        return CONTEXT_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "(No telemetry data available yet — TSS polling has not started.)"


def _format_docs(docs: list) -> str:
    if not docs:
        return "(No relevant documents found.)"
    return "\n\n---\n\n".join(
        f"[{doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in docs
    )


def get_raw_context() -> str:
    return _read_telemetry()


def build_rag_chain(model: str):
    """
    LCEL chain: question → parallel(telemetry fetch, document retrieval) → prompt → LLM.
    Both data sources are combined before the model sees anything.
    """
    llm = ChatOllama(model=model, base_url=settings.OLLAMA_URL)
    retriever = get_retriever()

    prompt = ChatPromptTemplate.from_messages([
        ("system", _SYSTEM),
        ("human", "{question}"),
    ])

    chain = (
        {
            "question": RunnablePassthrough(),
            "telemetry": RunnableLambda(lambda _: _read_telemetry()),
            "documents": retriever | RunnableLambda(_format_docs),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    return chain
