from pydantic import BaseModel, field_validator
from typing import Optional

class RepairTypeCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    activo: bool = True

    @field_validator("nombre")
    @classmethod
    def nombre_obligatorio(cls, v):
        v = " ".join(v.split())
        if not v:
            raise ValueError("El nombre es obligatorio")
        return v

    @field_validator("precio")
    @classmethod
    def precio_valido(cls, v):
        if v < 0:
            raise ValueError("El precio no puede ser negativo")
        return round(v, 2)

class RepairTypeUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    activo: Optional[bool] = None

    @field_validator("precio")
    @classmethod
    def precio_valido(cls, v):
        if v is not None and v < 0:
            raise ValueError("El precio no puede ser negativo")
        return v

class RepairTypeResponse(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    precio: float
    activo: bool