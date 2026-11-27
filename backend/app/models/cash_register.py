from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

METODOS = ("efectivo", "transferencia", "debito", "credito", "usd")


class MontoPorMetodo(BaseModel):
    metodo: str
    monto: float = Field(ge=0)

class CashMovement(BaseModel):
    tipo: str
    monto: float = Field(gt=0)
    motivo: str
    metodo_pago: str = "efectivo"
    notas: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def tipo_valido(cls, v):
        if v not in ("ingreso", "egreso"):
            raise ValueError("El movimiento tiene que ser un ingreso o un egreso")
        return v

    @field_validator("motivo")
    @classmethod
    def motivo_completo(cls, v):
        if not v or not v.strip():
            raise ValueError("Escribí el motivo del movimiento")
        return v.strip()

    @field_validator("metodo_pago")
    @classmethod
    def metodo_valido(cls, v):
        if v not in METODOS:
            raise ValueError("Medio de pago inválido")
        return v

class CashOpen(BaseModel):
    monto_inicial: float = Field(ge=0)
    sucursal: str = "sucursal_1"
    notas: Optional[str] = None

class CashClose(BaseModel):
    montos_por_metodo: List[MontoPorMetodo]
    # Efectivo que queda en la caja para el día siguiente (será el monto
    # inicial esperado de la próxima apertura). El resto se retira.
    dejar_en_caja: float = Field(default=0, ge=0)
    # Solo el administrador: cerrar una caja que abrió otro usuario
    caja_id: Optional[str] = None
    notas: Optional[str] = None

class CashResponse(BaseModel):
    id: str
    estado: str
    monto_inicial: float
    monto_final_esperado: Optional[float]
    monto_final_real: Optional[float]
    diferencia: Optional[float]
    movimientos: List[dict]
    usuario_apertura_id: str
    usuario_cierre_id: Optional[str]
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime]