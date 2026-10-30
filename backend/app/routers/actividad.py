"""Registro de actividad: quién hizo qué, ingresos fallidos y errores del
sistema. Solo lo ve el administrador."""
from datetime import datetime, timedelta
import re
from fastapi import APIRouter, Depends
from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission

router = APIRouter()


@router.get("/")
async def listar(
    desde: str = None,
    hasta: str = None,
    tipo: str = None,
    modulo: str = None,
    usuario: str = None,
    texto: str = None,
    current_user: dict = Depends(get_current_user),
):
    check_permission(current_user["role"], "*")
    db = get_db()
    filtro = {}
    if desde or hasta:
        filtro["fecha"] = {}
        # Las fechas del filtro son días de Argentina (UTC-3)
        if desde:
            filtro["fecha"]["$gte"] = datetime.strptime(desde, "%Y-%m-%d") + timedelta(hours=3)
        if hasta:
            filtro["fecha"]["$lt"] = datetime.strptime(hasta, "%Y-%m-%d") + timedelta(days=1, hours=3)
    if tipo:
        filtro["tipo"] = tipo
    if modulo:
        filtro["modulo"] = modulo
    if usuario:
        filtro["usuario_nombre"] = usuario
    if texto:
        filtro["descripcion"] = {"$regex": re.escape(texto.strip()), "$options": "i"}
    eventos = await db.actividad.find(filtro).sort("fecha", -1).to_list(1000)
    return [{**e, "_id": str(e["_id"]), "id": str(e["_id"])} for e in eventos]


@router.get("/resumen")
async def resumen(current_user: dict = Depends(get_current_user)):
    """Cantidades de los últimos 7 días, para los avisos de arriba."""
    check_permission(current_user["role"], "*")
    db = get_db()
    desde = datetime.utcnow() - timedelta(days=7)
    return {
        "ingresos_fallidos": await db.actividad.count_documents({"tipo": "ingreso_fallido", "fecha": {"$gte": desde}}),
        "errores": await db.actividad.count_documents({"tipo": "error", "fecha": {"$gte": desde}}),
        "modulos": sorted(m for m in await db.actividad.distinct("modulo") if m),
        "usuarios": sorted(u for u in await db.actividad.distinct("usuario_nombre") if u),
    }
