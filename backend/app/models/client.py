from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


def _limpiar(v):
    """Los formularios mandan "" en los campos que no se completan: se guardan
    como vacíos (None) en lugar de rechazar el alta (el email vacío daba error)."""
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class ClientCreate(BaseModel):
    nombre: str
    apellido: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    direccion: Optional[str] = None

    @field_validator("apellido", "dni", "telefono", "email", "direccion", mode="before")
    @classmethod
    def vacio_a_none(cls, v):
        return _limpiar(v)

    @field_validator("nombre", mode="before")
    @classmethod
    def nombre_obligatorio(cls, v):
        v = (v or "").strip() if isinstance(v, str) else v
        if not v:
            raise ValueError("El nombre es obligatorio")
        return v


class ClientUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    direccion: Optional[str] = None
    activo: Optional[bool] = None

    @field_validator("nombre", "apellido", "dni", "telefono", "email", "direccion", mode="before")
    @classmethod
    def vacio_a_none(cls, v):
        return _limpiar(v)


class ClientResponse(BaseModel):
    id: str
    nombre: str
    apellido: Optional[str]
    dni: Optional[str]
    telefono: Optional[str]
    email: Optional[str]
    direccion: Optional[str]
    activo: bool
    fecha_creacion: datetime
