"""Catálogo de marcas y modelos de equipos, para buscarlos al cargar una
orden de reparación (y crearlos en el momento si no están)."""
import re

MARCAS_INICIALES = ["Samsung", "Motorola", "Apple", "Xiaomi", "Huawei", "TCL", "Alcatel", "LG", "Nokia", "Realme", "OPPO", "ZTE"]


def _igual(nombre: str):
    return {"$regex": f"^{re.escape(nombre.strip())}$", "$options": "i"}


async def registrar_marca_modelo(db, marca: str, modelo: str = ""):
    """Agrega la marca (y el modelo) al catálogo si todavía no están."""
    marca = (marca or "").strip()
    modelo = (modelo or "").strip()
    if not marca:
        return None
    doc = await db.marcas.find_one({"nombre": _igual(marca)})
    if not doc:
        res = await db.marcas.insert_one({"nombre": marca, "modelos": [], "activo": True})
        doc = {"_id": res.inserted_id, "nombre": marca, "modelos": []}
    if modelo and not any(m.lower() == modelo.lower() for m in doc.get("modelos", [])):
        await db.marcas.update_one({"_id": doc["_id"]}, {"$push": {"modelos": modelo}})
    return doc["_id"]


async def cargar_marcas_iniciales(db):
    """Una sola vez: marcas comunes más las que ya aparecen en las órdenes."""
    if await db.configuracion.find_one({"_id": "marcas_iniciales"}):
        return
    await db.configuracion.insert_one({"_id": "marcas_iniciales"})
    for nombre in MARCAS_INICIALES:
        await registrar_marca_modelo(db, nombre)
    async for r in db.reparaciones.find({}, {"equipo.marca": 1, "equipo.modelo": 1}):
        eq = r.get("equipo") or {}
        await registrar_marca_modelo(db, eq.get("marca", ""), eq.get("modelo", ""))
