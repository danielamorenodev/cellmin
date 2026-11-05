from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime

ROLES = ("administrador", "cajero", "vendedor", "deposito", "tecnico")
SUCURSALES = ("sucursal_1", "sucursal_2")


def _validar_sucursales(v):
    if v is None:
        return v
    limpias = list(dict.fromkeys(v))  # sin repetidas, en el mismo orden
    if not limpias:
        raise ValueError("Elegí al menos una sucursal")
    invalidas = [s for s in limpias if s not in SUCURSALES]
    if invalidas:
        raise ValueError(f"Sucursal inválida: {', '.join(invalidas)}")
    return limpias


class UserCreate(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: str  # administrador, cajero, vendedor, deposito, tecnico
    sucursales: List[str] = ["sucursal_1"]

    @field_validator("sucursales")
    @classmethod
    def sucursales_validas(cls, v):
        return _validar_sucursales(v)

    @field_validator("nombre")
    @classmethod
    def nombre_obligatorio(cls, v):
        if not v.strip():
            raise ValueError("El nombre es obligatorio")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_minusculas(cls, v):
        return v.lower()


class UserUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    rol: Optional[str] = None
    sucursales: Optional[List[str]] = None
    activo: Optional[bool] = None

    @field_validator("sucursales")
    @classmethod
    def sucursales_validas(cls, v):
        return _validar_sucursales(v)

    @field_validator("password", "nombre", mode="before")
    @classmethod
    def vacio_a_none(cls, v):
        # El formulario de edición manda "" si no se cambia la contraseña
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("email")
    @classmethod
    def email_minusculas(cls, v):
        return v.lower() if v else v


class UserResponse(BaseModel):
    id: str
    nombre: str
    email: str
    rol: str
    sucursales: List[str]
    activo: bool
    fecha_creacion: datetime
