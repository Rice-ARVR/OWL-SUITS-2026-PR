from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.services.rag.procedures_service import (
    get_all_procedures,
    set_procedure,
    get_procedures_context,
)

router = APIRouter()


@router.get("/procedures")
async def list_procedures():
    print(get_procedures_context())
    return JSONResponse(get_all_procedures())


@router.patch("/procedures/{procedure_id}/set_complete")
async def set_complete_procedure(procedure_id: int):
    if not set_procedure(procedure_id, True):
        return JSONResponse(
            {"error": f"Procedure {procedure_id} not found"}, status_code=404
        )
    return JSONResponse({"id": procedure_id, "completed": True})


@router.patch("/procedures/{procedure_id}/set_incomplete")
async def set_incomplete_procedure(procedure_id: int):
    if not set_procedure(procedure_id, False):
        return JSONResponse(
            {"error": f"Procedure {procedure_id} not found"}, status_code=404
        )
    return JSONResponse({"id": procedure_id, "completed": False})
