from typing import Annotated
from pydantic import BaseModel, Field


class RoverControlRequest(BaseModel):
    throttle: Annotated[float | None, Field(ge=-100.0, le=100.0)] = None
    steering: Annotated[float | None, Field(ge=-1.0, le=1.0)] = None
    brakes: Annotated[float | None, Field(ge=0.0, le=1.0)] = None
    cabin_heating: Annotated[float | None, Field(ge=0.0, le=1.0)] = None
    cabin_cooling: Annotated[float | None, Field(ge=0.0, le=1.0)] = None
    headlights: Annotated[float | None, Field(ge=0.0, le=1.0)] = None
