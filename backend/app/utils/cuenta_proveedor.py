"""Cuenta corriente de cada proveedor: cuánto se le debe.

Cada movimiento queda en "proveedor_movimientos":
- "deuda": se le debe dinero (una compra que quedó sin pagar, o cargada a mano).
- "pago": se le pagó (baja la deuda).
El saldo (lo que se le debe) se guarda en el proveedor como `saldo_deuda` y se
actualiza con $inc en cada movimiento. Un saldo negativo es dinero a favor.
Los movimientos no se borran: se anulan (y el saldo se corrige).
"""
from datetime import datetime

from bson import ObjectId
from fastapi import HTTPException

TIPOS = ("deuda", "pago")


def redondear(v) -> float:
    return round(float(v or 0) + 1e-9, 2)


def formato_movimiento(m: dict) -> dict:
    return {
        "id": str(m["_id"]),
        "proveedor_id": m["proveedor_id"],
        "tipo": m["tipo"],
        "monto": m["monto"],
        "concepto": m.get("concepto"),
        "metodo": m.get("metodo"),
        "compra_id": m.get("compra_id"),
        "numero_compra": m.get("numero_compra"),
        "fecha": m.get("fecha"),
        "usuario_id": m.get("usuario_id"),
        "usuario_nombre": m.get("usuario_nombre"),
        "anulado": m.get("anulado", False),
        "fecha_anulacion": m.get("fecha_anulacion"),
    }


async def registrar_movimiento(db, proveedor_id: str, tipo: str, monto: float, usuario: dict,
                               concepto: str | None = None, metodo: str | None = None,
                               compra: dict | None = None) -> dict:
    if tipo not in TIPOS:
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido")
    monto = redondear(monto)
    if monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    nombre = ""
    if ObjectId.is_valid(usuario.get("user_id", "")):
        u = await db.usuarios.find_one({"_id": ObjectId(usuario["user_id"])}, {"nombre": 1})
        nombre = (u or {}).get("nombre", "")
    mov = {
        "proveedor_id": proveedor_id,
        "tipo": tipo,
        "monto": monto,
        "concepto": (concepto or "").strip() or None,
        "metodo": metodo,
        "compra_id": str(compra["_id"]) if compra else None,
        "numero_compra": compra.get("numero_compra") if compra else None,
        "fecha": datetime.utcnow(),
        "usuario_id": usuario.get("user_id"),
        "usuario_nombre": nombre,
        "anulado": False,
    }
    res = await db.proveedor_movimientos.insert_one(mov)
    mov["_id"] = res.inserted_id
    delta = monto if tipo == "deuda" else -monto
    await db.proveedores.update_one({"_id": ObjectId(proveedor_id)}, {"$inc": {"saldo_deuda": delta}})
    return mov


async def anular_movimiento(db, mov: dict) -> bool:
    """Anula un movimiento y corrige el saldo. Devuelve False si ya estaba anulado."""
    res = await db.proveedor_movimientos.update_one(
        {"_id": mov["_id"], "anulado": {"$ne": True}},
        {"$set": {"anulado": True, "fecha_anulacion": datetime.utcnow()}},
    )
    if res.modified_count != 1:
        return False
    delta = -mov["monto"] if mov["tipo"] == "deuda" else mov["monto"]
    await db.proveedores.update_one({"_id": ObjectId(mov["proveedor_id"])}, {"$inc": {"saldo_deuda": delta}})
    return True


async def recalcular_saldo(db, proveedor_id: str) -> float:
    """Saldo desde cero con los movimientos vigentes (para comprobar o corregir)."""
    saldo = 0.0
    async for m in db.proveedor_movimientos.find({"proveedor_id": proveedor_id, "anulado": {"$ne": True}}):
        saldo += m["monto"] if m["tipo"] == "deuda" else -m["monto"]
    saldo = redondear(saldo)
    await db.proveedores.update_one({"_id": ObjectId(proveedor_id)}, {"$set": {"saldo_deuda": saldo}})
    return saldo
