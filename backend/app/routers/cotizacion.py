from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.cotizacion import (
    VALOR_MAXIMO,
    guardar_cotizacion,
    obtener_cotizacion,
)
from app.utils.logger import registrar_auditoria
from app.utils.permissions import check_permission

router = APIRouter()


def _utc(momento):
    """ISO con zona UTC explícita (Mongo devuelve las fechas sin zona)."""
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.isoformat()


class CotizacionIn(BaseModel):
    valor: float


@router.get("/")
async def get_cotizacion(current_user: dict = Depends(get_current_user)):
    """Cotización vigente. La ve cualquier usuario (la usa todo el sistema)."""
    return await obtener_cotizacion(get_db())


@router.put("/")
async def set_cotizacion(data: CotizacionIn, current_user: dict = Depends(get_current_user)):
    """Carga el valor del dólar. Solo el administrador."""
    check_permission(current_user["role"], "*")
    if not (0 < data.valor <= VALOR_MAXIMO):
        raise HTTPException(status_code=400, detail="Ingresá un valor del dólar mayor a 0")
    db = get_db()
    anterior = (await obtener_cotizacion(db))["venta"]
    nueva = await guardar_cotizacion(db, data.valor, current_user["user_id"])
    await registrar_auditoria(
        db=db,
        usuario_id=current_user["user_id"],
        rol=current_user["role"],
        accion="actualizar",
        modulo="cotizacion",
        descripcion="Cotización del dólar cargada manualmente",
        dato_anterior={"valor": anterior},
        dato_nuevo={"valor": nueva["venta"]},
    )
    return nueva


@router.get("/historial")
async def get_historial(current_user: dict = Depends(get_current_user)):
    """Últimos cambios del valor del dólar. Solo el administrador."""
    check_permission(current_user["role"], "*")
    db = get_db()
    filas = await db.cotizacion_historial.find().sort("fecha", -1).to_list(50)
    return [
        {
            "id": str(f["_id"]),
            "valor": f["valor"],
            "anterior": f.get("anterior"),
            "usuario": f.get("usuario_nombre") or "-",
            "fecha": _utc(f["fecha"]),
        }
        for f in filas
    ]
