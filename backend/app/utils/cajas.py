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


def inicio_dia_local(momento=None):
    """Medianoche de hoy en Argentina, expresada en UTC sin zona (como se
    guardan las fechas en la base)."""
    momento = momento or datetime.now(timezone.utc)
    local = momento.astimezone(ZONA_AR).replace(hour=0, minute=0, second=0, microsecond=0)
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def a_utc(local: datetime) -> datetime:
    """Hora argentina (sin zona) -> UTC sin zona, como se guardan las fechas."""
    return local.replace(tzinfo=ZONA_AR).astimezone(timezone.utc).replace(tzinfo=None)


def rango_periodo(periodo: str = "mes", desde: str | None = None, hasta: str | None = None):
    """Desde/hasta (UTC sin zona) de un período de los reportes, contado en
    horario argentino: "mes" arranca el día 1 a las 00:00 de acá, y un rango
    AAAA-MM-DD incluye el día "hasta" completo (hasta las 23:59 de acá)."""
    ahora = datetime.utcnow()
    if desde or hasta:
        try:
            inicio = a_utc(datetime.strptime(desde, "%Y-%m-%d")) if desde else datetime(2000, 1, 1)
            fin = (a_utc(datetime.strptime(hasta, "%Y-%m-%d") + timedelta(days=1)) - timedelta(microseconds=1)
                   if hasta else ahora)
        except ValueError:
            raise HTTPException(status_code=400, detail="Fecha inválida: usá el formato AAAA-MM-DD")
        if fin < inicio:
            raise HTTPException(status_code=400, detail="La fecha «hasta» es anterior a la fecha «desde»")
        return inicio, fin
    hoy_local = datetime.now(ZONA_AR).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
    if periodo == "dia":
        return a_utc(hoy_local), ahora
    if periodo == "semana":
        return ahora - timedelta(days=7), ahora
    if periodo == "año":
        return a_utc(hoy_local.replace(month=1, day=1)), ahora
    return a_utc(hoy_local.replace(day=1)), ahora


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

    - Cajero: solo en la caja que abrió él.
    - Vendedor: en la caja abierta de la sucursal a la que pertenece. Si
      pertenece a las dos, tiene que indicar cuál.
    - Administrador: en la caja que abrió él; si no abrió ninguna, como un
      vendedor de las dos sucursales (en la caja abierta de la que elija; si
      hay una sola abierta, en esa).
    """
    if es_admin(user):
        propia = await caja_propia(db, user)
        if propia:
            return propia
        if sucursal is None:
            abiertas = await db.cajas.find({"estado": "abierta"}).to_list(None)
            if len(abiertas) == 1:
                return abiertas[0]
            if not abiertas:
                raise HTTPException(status_code=400, detail="No hay ninguna caja abierta. Abrí una caja para vender.")
            raise HTTPException(status_code=400, detail="Hay cajas abiertas en las dos sucursales: elegí en cuál vas a vender.")
        from app.utils.stock import validar_sucursal
        validar_sucursal(sucursal)
        caja = await db.cajas.find_one({"estado": "abierta", "sucursal": sucursal})
        if not caja:
            raise HTTPException(status_code=400, detail=f"No hay una caja abierta en {nombre_sucursal(sucursal)}.")
        return caja

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
