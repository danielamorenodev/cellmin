"""Control de efectivo: no se puede sacar de la caja más efectivo del que hay.

Se usa en todo egreso en efectivo: movimientos manuales, devoluciones de
ventas, cancelaciones de ventas y de reparaciones con pagos."""
from fastapi import HTTPException


def _pesos(n: float) -> str:
    return f"$ {n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


async def efectivo_en_caja(db, caja) -> float:
    """Efectivo que debería haber ahora en la caja (lo mismo que se espera al cierre)."""
    from app.routers.cash_register import calcular_esperado  # import diferido: evita el ciclo
    ventas = await db.ventas.find({
        "estado": {"$in": ["completada", "cancelada"]},
        "fecha": {"$gte": caja["fecha_apertura"]},
        "sucursal": caja["sucursal"],
    }).to_list(None)
    return calcular_esperado(caja, ventas)["esperado_por_metodo"].get("efectivo", 0)


async def exigir_efectivo(db, caja, monto: float, para: str):
    """400 si la caja no tiene efectivo suficiente para sacar `monto`."""
    if monto <= 0.005:
        return
    hay = await efectivo_en_caja(db, caja)
    if monto > hay + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"En la caja hay {_pesos(max(hay, 0))} en efectivo: no alcanza para {para} ({_pesos(monto)}). "
                   "Elegí otro medio o registrá antes un ingreso de efectivo.",
        )
