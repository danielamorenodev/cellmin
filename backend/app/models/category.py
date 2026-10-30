from pydantic import BaseModel
from typing import Optional

# Las categorías son una lista simple (sin categoría padre)
class CategoryCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class CategoryUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None

class CategoryResponse(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    activo: bool
