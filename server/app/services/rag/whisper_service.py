import logging
import os
import tempfile

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        logger.info("Loading faster-whisper model (tiny, int8)...")
        _model = WhisperModel("tiny", device="cpu", compute_type="int8")
        logger.info("faster-whisper model loaded.")
    return _model


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    model = _get_model()
    suffix = os.path.splitext(filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        segments, _ = model.transcribe(tmp_path, beam_size=5)
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        os.unlink(tmp_path)
