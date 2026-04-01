from typing import Annotated
from pydantic import BaseModel, Field


class RoverControlRequest(BaseModel):
    throttle: Annotated[float, Field(ge=-100.0, le=100.0)] = 0.0
    steering: Annotated[float, Field(ge=-1.0, le=1.0)] = 0.0
    brakes: Annotated[float, Field(ge=0.0, le=1.0)] = 0.0
