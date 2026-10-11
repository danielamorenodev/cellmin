"""Reglas de las cajas.

- Cada sucursal tiene su propia caja; pueden estar abiertas las dos a la vez.
- Una caja por día por sucursal.
- Un usuario no puede tener dos cajas abiertas al mismo tiempo.
- Solo quien abrió la caja registra en ella (ventas, cobros y movimientos).
"""
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

# Argentina no usa horario de verano: UTC-3 fijo
ZONA_AR = timezone(timedelta(hours=-3))
NOMBRES_SUCURSAL = {"sucursal_1": "Sucursal 1", "sucursal_2": "Sucursal 2"}


def nombre_sucursal(s):
    return NOMBRES_SUCURSAL.get(s, s)


def dia_local(momento=None):
    """Fecha (AAAA-MM-DD) en horario argentino."""
    momento = momento or datetime.now(timezone.utc)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(ZONA_AR).strftime("%Y-%m-%d")


def es_admin(user):
    return user.get("role") == "administrador"


def puede_sucursal(user, sucursal):
    return es_admin(user) or sucursal in (user.get("sucursales") or [])


async def caja_propia(db, user):
    """La caja abierta que abrió este usuario (o None)."""
    return await db.cajas.find_one({"estado": "abierta", "usuario_apertura_id": user["user_id"]})


async def exigir_caja_propia(db, user, para="registrar esta operación"):
    caja = await caja_propia(db, user)
    if not caja:
        raise HTTPException(
            status_code=400,
            detail=f"Para {para} necesitás tener tu caja abierta. Solo quien abrió la caja puede registrar en ella.",
        )
    return caja


def exigir_dueno_o_admin(caja, user, accion="operar en"):
    if caja.get("usuario_apertura_id") != user["user_id"] and not es_admin(user):
        raise HTTPException(
            status_code=403,
            detail=f"Solo quien abrió la caja (o un administrador) puede {accion} esta caja.",
        )
