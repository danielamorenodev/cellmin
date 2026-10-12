"""Reglas de las cajas.

- Cada sucursal tiene su propia caja; pueden estar abiertas las dos a la vez.
- Una caja por día por sucursal.
- Un usuario no puede tener dos cajas abiertas al mismo tiempo.
- Solo quien abrió la caja registra en ella (ventas, cobros y movimientos).
  Excepción: un vendedor puede registrar ventas en la caja abierta de su
  sucursal (no cobros de reparaciones ni movimientos).
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


async def caja_para_vender(db, user, sucursal=None):
    """Caja en la que este usuario registra una venta.

    - Cajero (o administrador): solo en la caja que abrió él.
    - Vendedor: en la caja abierta de la sucursal a la que pertenece. Si
      pertenece a las dos, tiene que indicar cuál.
    """
    if user.get("role") != "vendedor":
        return await exigir_caja_propia(db, user, "registrar ventas")

    propias = user.get("sucursales") or []
    if sucursal is None:
        if len(propias) == 1:
            sucursal = propias[0]
        else:
            raise HTTPException(status_code=400, detail="Elegí la sucursal en la que vas a vender.")
    if sucursal not in propias:
        raise HTTPException(status_code=403, detail="No pertenecés a esa sucursal.")
    caja = await db.cajas.find_one({"estado": "abierta", "sucursal": sucursal})
    if not caja:
        raise HTTPException(
            status_code=400,
            detail=f"No hay una caja abierta en {nombre_sucursal(sucursal)}. Pedile a un cajero que la abra para poder vender.",
        )
    return caja


def exigir_dueno_o_admin(caja, user, accion="operar en"):
    if caja.get("usuario_apertura_id") != user["user_id"] and not es_admin(user):
        raise HTTPException(
            status_code=403,
            detail=f"Solo quien abrió la caja (o un administrador) puede {accion} esta caja.",
        )
