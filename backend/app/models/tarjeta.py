from pydantic import BaseModel, Field
from typing import List, Optional


class PlanCuotas(BaseModel):
    cuotas: int = Field(ge=1, le=48)
    recargo: float = Field(default=0, ge=0, le=300)  # % que se suma al monto


# Tarjeta aceptada en el local (Visa, Mastercard, Naranja X...). Con crédito
# se elige además el plan de cuotas, que puede tener recargo.
class TarjetaCreate(BaseModel):
    nombre: str
    debito: bool = True
    credito: bool = True
    planes: List[PlanCuotas] = [PlanCuotas(cuotas=1, recargo=0)]


class TarjetaUpdate(BaseModel):
    nombre: Optional[str] = None
    debito: Optional[bool] = None
    credito: Optional[bool] = None
    planes: Optional[List[PlanCuotas]] = None
    activo: Optional[bool] = None
