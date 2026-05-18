import asyncio
import logging
import shutil
from pathlib import Path

from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings

logger = logging.getLogger(__name__)

_DOCS_DIR = Path(__file__).parent.parent.parent.parent / "documents"
_CHROMA_DIR = Path(__file__).parent / "chroma_db"

_vectorstore: Chroma | None = None


def _embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings(model=settings.EMBED_MODEL, base_url=settings.OLLAMA_URL)


def get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        _CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        _vectorstore = Chroma(
            persist_directory=str(_CHROMA_DIR),
            embedding_function=_embeddings(),
        )
    return _vectorstore


def get_retriever(k: int = 4):
    return get_vectorstore().as_retriever(search_kwargs={"k": k})


async def ingest_documents(force: bool = False) -> dict:
    """Load PDFs and .txt files from documents/, chunk, embed, and persist to Chroma."""
    global _vectorstore

    _DOCS_DIR.mkdir(parents=True, exist_ok=True)

    paths = [
        *_DOCS_DIR.glob("**/*.pdf"),
        *_DOCS_DIR.glob("**/*.txt"),
        *_DOCS_DIR.glob("**/*.csv"),
    ]
    if not paths:
        logger.info("No documents found in %s", _DOCS_DIR)
        return {"files": 0, "chunks": 0}

    docs = []
    for path in paths:
        try:
            loader = (
                PyPDFLoader(str(path))
                if path.suffix == ".pdf"
                else TextLoader(str(path), encoding="utf-8")
            )
            docs.extend(await asyncio.to_thread(loader.load))
        except Exception:
            logger.exception("Failed to load %s", path.name)

    if not docs:
        return {"files": 0, "chunks": 0}

    chunks = RecursiveCharacterTextSplitter(
        chunk_size=500, chunk_overlap=50
    ).split_documents(docs)

    if force:
        shutil.rmtree(_CHROMA_DIR, ignore_errors=True)
        _vectorstore = None

    await asyncio.to_thread(get_vectorstore().add_documents, chunks)
    logger.info("Ingested %d chunks from %d files", len(chunks), len(paths))
    return {"files": len(paths), "chunks": len(chunks)}
