"""
Cotización del dólar: la carga el administrador A MANO o se trae de
InfoDolar (dólar blue en Córdoba), con un botón o en forma automática.

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
        "fuente": doc.get("fuente") or "Cargada manualmente",
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


async def guardar_cotizacion(db, valor: float, user_id: str, fuente: str = "Cargada manualmente",
                            nombre_si_no_hay: str = "") -> dict:
    """Guarda el valor vigente y lo anota en el historial."""
    valor = round(float(valor), 2)
    anterior_doc = await db.configuracion.find_one({"_id": DOC_ID})
    anterior = float(anterior_doc["venta"]) if anterior_doc and anterior_doc.get("venta") else None

    nombre = nombre_si_no_hay
    try:
        u = await db.usuarios.find_one({"_id": ObjectId(user_id)})
        nombre = (u or {}).get("nombre", "") or nombre_si_no_hay
    except Exception:
        pass

    ahora = datetime.now(timezone.utc)
    await db.configuracion.update_one(
        {"_id": DOC_ID},
        {"$set": {"venta": valor, "guardada": ahora, "actualizada_por": nombre, "fuente": fuente}},
        upsert=True,
    )
    await db.cotizacion_historial.insert_one({
        "valor": valor,
        "anterior": anterior,
        "usuario_id": user_id,
        "usuario_nombre": nombre,
        "fuente": fuente,
        "fecha": ahora,
    })
    return await obtener_cotizacion(db)


# ---- Actualización automática desde InfoDolar -------------------------
CONFIG_AUTO = "cotizacion_automatica"


async def config_automatica(db) -> dict:
    doc = await db.configuracion.find_one({"_id": CONFIG_AUTO}) or {}
    return {
        "activa": bool(doc.get("activa", False)),
        "usar": doc.get("usar", "venta"),  # venta | compra
        "ultimo_intento": doc.get("ultimo_intento"),
        "ultimo_error": doc.get("ultimo_error"),
    }


async def actualizar_desde_infodolar(db, usar: str, user_id: str = "", nombre: str = "") -> dict:
    """Trae el blue de Córdoba y lo guarda si es razonable (no se aleja más
    de un 25 % del valor vigente: protege de una lectura equivocada)."""
    from app.utils.cotizacion_externa import consultar_blue_cordoba, FUENTE, CotizacionNoDisponible
    datos = await consultar_blue_cordoba()
    valor = datos["venta"] if usar != "compra" else datos["compra"]
    vigente = await cotizacion_venta(db)
    if vigente and abs(valor - vigente) / vigente > 0.25:
        monto = f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        raise CotizacionNoDisponible(
            f"InfoDolar informa $ {monto}, muy distinto del valor actual. No se cambió: revisalo y cargalo a mano."
        )
    if vigente and abs(valor - vigente) < 0.005:
        return {**(await obtener_cotizacion(db)), "sin_cambios": True}
    etiqueta = f"{FUENTE} ({'venta' if usar != 'compra' else 'compra'})"
    return await guardar_cotizacion(db, valor, user_id, fuente=etiqueta, nombre_si_no_hay=nombre)


async def ciclo_automatico(get_db, cada_minutos: int = 30):
    """Corre mientras el servidor está encendido: si la actualización
    automática está activa, trae el valor de lunes a sábado de 9 a 21 h."""
    import asyncio
    from datetime import timedelta
    from app.utils.cajas import ZONA_AR
    from app.utils.logger import log_errores
    while True:
        try:
            db = get_db()
            cfg = await config_automatica(db) if db is not None else {"activa": False}
            ahora = datetime.now(timezone.utc).astimezone(ZONA_AR)
            if cfg["activa"] and ahora.weekday() < 6 and 9 <= ahora.hour < 21:
                error = None
                try:
                    await actualizar_desde_infodolar(db, cfg["usar"], nombre="Actualización automática")
                except Exception as e:  # la página no respondió o cambió
                    error = str(e)[:300]
                    log_errores.error(f"Cotización automática: {error}")
                await db.configuracion.update_one(
                    {"_id": CONFIG_AUTO},
                    {"$set": {"ultimo_intento": datetime.now(timezone.utc), "ultimo_error": error}},
                    upsert=True,
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
        await asyncio.sleep(cada_minutos * 60)
