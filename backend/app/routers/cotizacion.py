from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.cotizacion import (
    VALOR_MAXIMO,
    CONFIG_AUTO,
    actualizar_desde_infodolar,
    config_automatica,
    guardar_cotizacion,
    obtener_cotizacion,
)
from app.utils.cotizacion_externa import CotizacionNoDisponible, consultar_blue_cordoba
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
            "fuente": f.get("fuente") or "Cargada manualmente",
            "fecha": _utc(f["fecha"]),
        }
        for f in filas
    ]


@router.get("/infodolar")
async def ver_infodolar(current_user: dict = Depends(get_current_user)):
    """Consulta ahora el blue de Córdoba en InfoDolar, sin guardar nada."""
    check_permission(current_user["role"], "*")
    try:
        return await consultar_blue_cordoba()
    except CotizacionNoDisponible as e:
        raise HTTPException(status_code=502, detail=str(e))


class UsarInfodolar(BaseModel):
    usar: str = "venta"  # venta | compra


@router.post("/infodolar")
async def usar_infodolar(data: UsarInfodolar, current_user: dict = Depends(get_current_user)):
    """Trae el blue de Córdoba y lo deja como valor vigente."""
    check_permission(current_user["role"], "*")
    db = get_db()
    anterior = (await obtener_cotizacion(db))["venta"]
    try:
        nueva = await actualizar_desde_infodolar(db, data.usar, current_user["user_id"])
    except CotizacionNoDisponible as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not nueva.get("sin_cambios"):
        await registrar_auditoria(
            db=db, usuario_id=current_user["user_id"], rol=current_user["role"], accion="actualizar",
            modulo="cotizacion", descripcion=f"Cotización del dólar tomada de InfoDolar (blue Córdoba, {data.usar})",
            dato_anterior={"valor": anterior}, dato_nuevo={"valor": nueva["venta"]},
        )
    return nueva


class Automatica(BaseModel):
    activa: bool
    usar: str = "venta"


@router.get("/automatica")
async def ver_automatica(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    return await config_automatica(get_db())


@router.put("/automatica")
async def cambiar_automatica(data: Automatica, current_user: dict = Depends(get_current_user)):
    """Activa o desactiva la actualización automática (cada 30 minutos, de
    lunes a sábado de 9 a 21 h)."""
    check_permission(current_user["role"], "*")
    if data.usar not in ("venta", "compra"):
        raise HTTPException(status_code=400, detail="Elegí venta o compra")
    db = get_db()
    await db.configuracion.update_one(
        {"_id": CONFIG_AUTO}, {"$set": {"activa": data.activa, "usar": data.usar}}, upsert=True
    )
    await registrar_auditoria(
        db=db, usuario_id=current_user["user_id"], rol=current_user["role"], accion="configurar",
        modulo="cotizacion",
        descripcion=("Actualización automática del dólar activada" if data.activa else "Actualización automática del dólar desactivada")
                    + f" (valor de {data.usar})",
    )
    return await config_automatica(db)
