from pydantic import BaseModel, Field
from typing import List, Optional


class ItemRemito(BaseModel):
    producto_id: str
    variante_nombre: Optional[str] = None
    cantidad: int = Field(gt=0)


# Remito interno: mercadería que se envía de una sucursal a la otra
class RemitoCreate(BaseModel):
    origen: str
    destino: str
    items: List[ItemRemito]
    notas: Optional[str] = None
    clave_idempotencia: Optional[str] = None
