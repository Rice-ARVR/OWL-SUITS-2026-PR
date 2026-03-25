import asyncio

from pydantic import BaseModel


# --- Pydantic schema ---

class ErrorProcedure(BaseModel):
    code: str
    description: str
    needs_resolved: bool
    procedures: list[str]


class LtvErrorsSchema(BaseModel):
    error_procedures: list[ErrorProcedure]


# --- Wrapper ---

class LtvErrorsData:
    def __init__(self) -> None:
        self._data: LtvErrorsSchema | None = None
        self._lock: asyncio.Lock = asyncio.Lock()

    async def update(self, raw: dict) -> None:
        parsed = LtvErrorsSchema.model_validate(raw)
        async with self._lock:
            self._data = parsed

    async def get_snapshot(self) -> LtvErrorsSchema | None:
        async with self._lock:
            return self._data

    # --- error_procedures ---

    async def get_error_procedures(self) -> list[ErrorProcedure] | None:
        async with self._lock:
            return self._data.error_procedures if self._data else None

    async def get_error_procedure_at(self, index: int) -> ErrorProcedure | None:
        async with self._lock:
            if self._data is None:
                return None
            return self._data.error_procedures[index]

    async def get_error_procedure_by_code(self, code: str) -> ErrorProcedure | None:
        async with self._lock:
            if self._data is None:
                return None
            for procedure in self._data.error_procedures:
                if procedure.code == code:
                    return procedure
            return None
