import logging

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.services.rag.whisper_service import transcribe_audio

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/speech/transcribe")
async def transcribe(file: UploadFile = File(...)):
    logger.info(
        "Speech transcribe: filename=%s content_type=%s",
        file.filename,
        file.content_type,
    )
    try:
        audio_bytes = await file.read()
        transcript = transcribe_audio(audio_bytes, file.filename or "audio.webm")
        return JSONResponse({"transcript": transcript})
    except Exception as e:
        logger.exception("Speech transcription failed: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)
