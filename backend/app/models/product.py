from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class Variante(BaseModel):
    nombre: str
    sku: Optional[str] = None
    codigo_barras: Optional[str] = None
    precio_costo: float
    precio_venta: float
    # Si el producto tiene el precio en dólares: los valores en US$
    precio_costo_usd: Optional[float] = None
    precio_venta_usd: Optional[float] = None
    stock_actual: int = 0
    stock_minimo: int = 0
    # Stock y mínimo de cada sucursal: {"sucursal_1": 5, "sucursal_2": 0}
    stock_sucursal: Optional[Dict[str, int]] = None
    stock_minimo_sucursal: Optional[Dict[str, int]] = None

class ProductCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    categoria_id: str
    codigo_barras: Optional[str] = None
    unidad_medida: str
    tiene_variantes: bool = False
    variantes: List[Variante] = []
    precio_costo: Optional[float] = None
    precio_venta: Optional[float] = None
    # Precio en dólares: el precio en pesos se recalcula cada vez que cambia
    # el dólar. En pesos (False) queda fijo, por ejemplo en fundas.
    precio_en_usd: bool = False
    precio_costo_usd: Optional[float] = None
    precio_venta_usd: Optional[float] = None
    stock_actual: Optional[int] = 0
    stock_minimo: Optional[int] = 0
    stock_sucursal: Optional[Dict[str, int]] = None
    stock_minimo_sucursal: Optional[Dict[str, int]] = None
    pide_imei: bool = False  # celulares: al venderlo hay que cargar el IMEI de cada unidad
    activo: bool = True

class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria_id: Optional[str] = None
    codigo_barras: Optional[str] = None
    unidad_medida: Optional[str] = None
    tiene_variantes: Optional[bool] = None
    pide_imei: Optional[bool] = None
    variantes: Optional[List[Variante]] = None
    precio_costo: Optional[float] = None
    precio_venta: Optional[float] = None
    precio_en_usd: Optional[bool] = None
    precio_costo_usd: Optional[float] = None
    precio_venta_usd: Optional[float] = None
    stock_minimo: Optional[int] = None
    stock_minimo_sucursal: Optional[Dict[str, int]] = None
    activo: Optional[bool] = None

class ProductResponse(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    categoria_id: str
    codigo_barras: Optional[str]
    unidad_medida: str
    tiene_variantes: bool
    variantes: List[Variante]
    precio_costo: Optional[float]
    precio_venta: Optional[float]
    stock_actual: Optional[int]
    stock_minimo: Optional[int]
    activo: bool
    fecha_creacion: datetime