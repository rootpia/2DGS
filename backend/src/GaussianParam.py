from pydantic import BaseModel
from typing import Optional

class GaussianParam(BaseModel):
    index: int
    mean_x: float
    mean_y: float
    sigma_x: float
    sigma_y: float
    sigma_xy: Optional[float] = None
    weight: float