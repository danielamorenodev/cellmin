"""Tarjetas y planes de cuotas: datos que se guardan con cada cobro con
tarjeta y recargo que corresponde según las cuotas."""
from bson import ObjectId
from fastapi import HTTPException

TARJETAS_INICIALES = ["Visa", "Mastercard", "American Express", "Naranja X", "Cabal"]
METODOS_TARJETA = ("debito", "credito")


def redondear(valor: float) -> float:
    return round(valor + 1e-9, 2)


def formato_tarjeta(t: dict) -> dict:
    return {
        "id": str(t["_id"]),
        "nombre": t["nombre"],
        "debito": t.get("debito", True),
        "credito": t.get("credito", True),
        "planes": sorted(t.get("planes", []), key=lambda p: p["cuotas"]),
        "activo": t.get("activo", True),
    }


async def crear_tarjetas_iniciales(db):
    """La primera vez quedan cargadas las tarjetas más comunes, en 1 pago y
    sin recargo; el administrador agrega los planes de cuotas."""
    if await db.tarjetas.count_documents({}) == 0:
        await db.tarjetas.insert_many([
            {"nombre": n, "debito": n not in ("American Express", "Naranja X"), "credito": True,
             "planes": [{"cuotas": 1, "recargo": 0}], "activo": True}
            for n in TARJETAS_INICIALES
        ])


async def datos_tarjeta(db, metodo: str, tarjeta_id, cuotas, base: float) -> dict:
    """Valida la tarjeta elegida y devuelve lo que se guarda con el pago:
    nombre, cuotas, % de recargo y monto del recargo sobre 'base'.
    Si todavía no hay tarjetas cargadas para ese medio, no se exige."""
    if metodo not in METODOS_TARJETA:
        return {}
    hay = await db.tarjetas.count_documents({"activo": True, metodo: True})
    if not tarjeta_id:
        if hay:
            raise HTTPException(status_code=400, detail="Elegí la tarjeta con la que se paga")
        return {}
    if not ObjectId.is_valid(tarjeta_id):
        raise HTTPException(status_code=400, detail="Tarjeta inválida")
    t = await db.tarjetas.find_one({"_id": ObjectId(tarjeta_id), "activo": True})
    if not t or not t.get(metodo, True):
        raise HTTPException(status_code=400, detail="Esa tarjeta no está habilitada para este medio de pago")
    if metodo == "debito":
        return {"tarjeta_id": tarjeta_id, "tarjeta": t["nombre"], "cuotas": 1, "recargo_pct": 0.0, "recargo": 0.0}
    cuotas = int(cuotas or 1)
    plan = next((p for p in t.get("planes", []) if p["cuotas"] == cuotas), None)
    if not plan:
        if cuotas == 1:
            plan = {"cuotas": 1, "recargo": 0}
        else:
            raise HTTPException(status_code=400, detail=f"{t['nombre']} no tiene plan de {cuotas} cuotas")
    pct = float(plan.get("recargo", 0))
    return {
        "tarjeta_id": tarjeta_id,
        "tarjeta": t["nombre"],
        "cuotas": cuotas,
        "recargo_pct": pct,
        "recargo": redondear(base * pct / 100),
    }


def texto_tarjeta(p: dict) -> str:
    """'Visa 3 cuotas' / 'Visa' para tickets y listados."""
    if not p.get("tarjeta"):
        return ""
    if p.get("metodo") == "credito" and (p.get("cuotas") or 1) > 1:
        return f"{p['tarjeta']} {p['cuotas']} cuotas"
    return p["tarjeta"]
