"""
Cotización del dólar, cargada A MANO por el administrador.

- El valor vigente se guarda en la colección "configuracion" (un solo
  documento). Todo el sistema (precios en USD, cobros en dólares, caja,
  reparaciones) lee de ahí, así que al guardar un valor nuevo todo se
  recalcula solo.
- Cada cambio también queda en "cotizacion_historial" (quién, cuándo,
  valor anterior y nuevo).
- Si nunca se cargó un valor, "disponible" es False: el sistema sigue
  funcionando, pero no muestra precios en USD ni deja cobrar en dólares.
- "obsoleta" es True si el valor se cargó un día anterior a hoy. Es solo un
  aviso para que se acuerden de actualizarlo; el valor se sigue usando.
"""
from datetime import datetime, timezone

from bson import ObjectId

from app.utils.cajas import dia_local

DOC_ID = "cotizacion_blue"  # mismo documento que usaba la versión automática
VALOR_MAXIMO = 100_000_000


def _respuesta(doc: dict | None) -> dict:
    if not doc or not doc.get("venta"):
        return {
            "disponible": False, "venta": None, "fecha": None,
            "obsoleta": False, "fuente": None, "actualizada_por": None,
        }
    guardada = doc.get("guardada")
    obsoleta = False
    fecha = None
    if isinstance(guardada, datetime):
        if guardada.tzinfo is None:
            guardada = guardada.replace(tzinfo=timezone.utc)
        obsoleta = dia_local(guardada) != dia_local()
        fecha = guardada.isoformat()
    return {
        "disponible": True,
        "venta": float(doc["venta"]),
        "fecha": fecha,
        "obsoleta": obsoleta,
        "fuente": "Cargada manualmente",
        "actualizada_por": doc.get("actualizada_por"),
    }


async def obtener_cotizacion(db=None) -> dict:
    doc = None
    if db is not None:
        try:
            doc = await db.configuracion.find_one({"_id": DOC_ID})
        except Exception:
            doc = None
    return _respuesta(doc)


async def cotizacion_venta(db=None) -> float | None:
    """Valor de 1 USD en pesos o None si todavía no se cargó ninguno."""
    c = await obtener_cotizacion(db)
    return c["venta"] if c["disponible"] else None


async def guardar_cotizacion(db, valor: float, user_id: str) -> dict:
    """Guarda el valor vigente y lo anota en el historial."""
    valor = round(float(valor), 2)
    anterior_doc = await db.configuracion.find_one({"_id": DOC_ID})
    anterior = float(anterior_doc["venta"]) if anterior_doc and anterior_doc.get("venta") else None

    nombre = ""
    try:
        u = await db.usuarios.find_one({"_id": ObjectId(user_id)})
        nombre = (u or {}).get("nombre", "")
    except Exception:
        pass

    ahora = datetime.now(timezone.utc)
    await db.configuracion.update_one(
        {"_id": DOC_ID},
        {"$set": {"venta": valor, "guardada": ahora, "actualizada_por": nombre}},
        upsert=True,
    )
    await db.cotizacion_historial.insert_one({
        "valor": valor,
        "anterior": anterior,
        "usuario_id": user_id,
        "usuario_nombre": nombre,
        "fecha": ahora,
    })
    return await obtener_cotizacion(db)
