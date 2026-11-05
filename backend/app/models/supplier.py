from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


def _limpiar(v):
    """Campos vacíos del formulario ("") se guardan vacíos (el email "" daba error)."""
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class SupplierCreate(BaseModel):
    nombre: str
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    direccion: Optional[str] = None
    contacto: Optional[str] = None

    @field_validator("cuit", "telefono", "email", "direccion", "contacto", mode="before")
    @classmethod
    def vacio_a_none(cls, v):
        return _limpiar(v)

    @field_validator("nombre", mode="before")
    @classmethod
    def nombre_obligatorio(cls, v):
        v = v.strip() if isinstance(v, str) else v
        if not v:
            raise ValueError("El nombre es obligatorio")
        return v


class SupplierUpdate(BaseModel):
    nombre: Optional[str] = None
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    direccion: Optional[str] = None
    contacto: Optional[str] = None
    activo: Optional[bool] = None

    @field_validator("nombre", "cuit", "telefono", "email", "direccion", "contacto", mode="before")
    @classmethod
    def vacio_a_none(cls, v):
        return _limpiar(v)


class MovimientoCuenta(BaseModel):
    tipo: str            # "deuda" (se le debe) o "pago" (se le pagó)
    monto: float
    concepto: Optional[str] = None
    metodo: Optional[str] = None  # cómo se pagó (efectivo, transferencia...)


class SupplierResponse(BaseModel):
    id: str
    nombre: str
    cuit: Optional[str]
    telefono: Optional[str]
    email: Optional[str]
    direccion: Optional[str]
    contacto: Optional[str]
    activo: bool
    fecha_creacion: datetime
