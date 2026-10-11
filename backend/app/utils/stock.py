"""Stock por sucursal.

Cada producto (o cada variante) guarda:
  stock_sucursal:         {"sucursal_1": 5, "sucursal_2": 0}
  stock_minimo_sucursal:  {"sucursal_1": 2, "sucursal_2": 1}
y mantiene stock_actual / stock_minimo como TOTAL (suma de las sucursales)
para los listados y reportes generales.
"""
from fastapi import HTTPException
from bson import ObjectId

SUCURSALES = ["sucursal_1", "sucursal_2"]
NOMBRES = {"sucursal_1": "Sucursal 1", "sucursal_2": "Sucursal 2"}


def validar_sucursal(sucursal):
    if sucursal not in SUCURSALES:
        raise HTTPException(status_code=400, detail="Sucursal inválida")
    return sucursal


def _entero(v):
    try:
        return max(0, int(v or 0))
    except (TypeError, ValueError):
        return 0


def mapa(valores=None):
    """Mapa completo {sucursal: entero >= 0}; las sucursales sin dato quedan en 0."""
    valores = valores or {}
    return {s: _entero(valores.get(s)) for s in SUCURSALES}


def stock_en(item, sucursal):
    """Stock de un producto/variante en una sucursal (con respaldo para datos viejos)."""
    por = item.get("stock_sucursal")
    if por is None:
        return _entero(item.get("stock_actual")) if sucursal == SUCURSALES[0] else 0
    return _entero(por.get(sucursal))


def minimo_en(item, sucursal):
    por = item.get("stock_minimo_sucursal")
    if por is None:
        return _entero(item.get("stock_minimo")) if sucursal == SUCURSALES[0] else 0
    return _entero(por.get(sucursal))


def completar(item):
    """Deja stock_sucursal / stock_minimo_sucursal completos y los totales al día."""
    item["stock_sucursal"] = mapa(
        item.get("stock_sucursal") if item.get("stock_sucursal") is not None
        else {SUCURSALES[0]: item.get("stock_actual", 0)}
    )
    item["stock_minimo_sucursal"] = mapa(
        item.get("stock_minimo_sucursal") if item.get("stock_minimo_sucursal") is not None
        else {SUCURSALES[0]: item.get("stock_minimo", 0)}
    )
    item["stock_actual"] = sum(item["stock_sucursal"].values())
    item["stock_minimo"] = sum(item["stock_minimo_sucursal"].values())
    return item


async def aplicar_delta(db, producto_id, variante_nombre, sucursal, delta):
    """Suma (o resta) stock en UNA sucursal y actualiza el total."""
    if delta == 0:
        return
    if variante_nombre:
        await db.productos.update_one(
            {"_id": ObjectId(producto_id), "variantes.nombre": variante_nombre},
            {"$inc": {
                f"variantes.$.stock_sucursal.{sucursal}": delta,
                "variantes.$.stock_actual": delta,
            }},
        )
    else:
        await db.productos.update_one(
            {"_id": ObjectId(producto_id)},
            {"$inc": {f"stock_sucursal.{sucursal}": delta, "stock_actual": delta}},
        )


async def migrar_stock_por_sucursal(db):
    """Productos creados antes del stock por sucursal: su stock pasa a la Sucursal 1."""
    cursor = db.productos.find({})
    async for p in cursor:
        cambios = {}
        if p.get("stock_sucursal") is None or p.get("stock_minimo_sucursal") is None:
            base = completar({
                "stock_actual": p.get("stock_actual", 0),
                "stock_minimo": p.get("stock_minimo", 0),
                "stock_sucursal": p.get("stock_sucursal"),
                "stock_minimo_sucursal": p.get("stock_minimo_sucursal"),
            })
            cambios.update({
                "stock_sucursal": base["stock_sucursal"],
                "stock_minimo_sucursal": base["stock_minimo_sucursal"],
                "stock_actual": base["stock_actual"],
                "stock_minimo": base["stock_minimo"],
            })
        variantes = p.get("variantes") or []
        if any(v.get("stock_sucursal") is None or v.get("stock_minimo_sucursal") is None for v in variantes):
            cambios["variantes"] = [completar(dict(v)) for v in variantes]
        if cambios:
            await db.productos.update_one({"_id": p["_id"]}, {"$set": cambios})
