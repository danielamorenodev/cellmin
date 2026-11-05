"""Precios en pesos o en dólares.

Cada producto elige la moneda de su precio:
- En pesos (por defecto): el precio queda fijo aunque cambie el dólar
  (por ejemplo fundas, vidrios, cargadores).
- En dólares (`precio_en_usd`): se guarda el precio en US$
  (`precio_venta_usd`, `precio_costo_usd`, también en cada variante) y el
  precio en pesos se recalcula con la cotización vigente. Se recalcula al
  guardar el producto, cada vez que se actualiza el dólar y al vender.

`precio_venta` y `precio_costo` siguen siendo siempre los valores en pesos,
así el resto del sistema (ventas, stock, reportes) no cambia.
"""
from fastapi import HTTPException

from app.utils.cotizacion import cotizacion_venta


def a_pesos(usd, cotizacion):
    if usd is None or cotizacion is None:
        return None
    return round(float(usd) * float(cotizacion), 2)


def _aplicar(item: dict, cotizacion: float) -> bool:
    """Actualiza los pesos de un producto o variante desde sus dólares.
    Devuelve True si algo cambió."""
    cambio = False
    for campo in ("precio_venta", "precio_costo"):
        usd = item.get(f"{campo}_usd")
        if usd is None:
            continue
        pesos = a_pesos(usd, cotizacion)
        if item.get(campo) != pesos:
            item[campo] = pesos
            cambio = True
    return cambio


def aplicar_cotizacion(producto: dict, cotizacion: float) -> bool:
    """Recalcula los precios en pesos de un producto en dólares (y de sus
    variantes). En un producto en pesos no hace nada."""
    if not producto.get("precio_en_usd") or not cotizacion:
        return False
    cambio = False
    if producto.get("tiene_variantes"):
        for v in producto.get("variantes") or []:
            cambio = _aplicar(v, cotizacion) or cambio
    else:
        cambio = _aplicar(producto, cotizacion) or cambio
    return cambio


def normalizar_moneda(datos: dict, cotizacion: float | None, actual: dict | None = None):
    """Valida y prepara los precios al crear o editar un producto.
    `datos` son los campos recibidos; `actual`, el producto guardado (al editar)."""
    en_usd = datos.get("precio_en_usd")
    if en_usd is None:
        en_usd = bool((actual or {}).get("precio_en_usd"))
    if not en_usd:
        # Precio fijo en pesos: se borran los dólares que pudiera tener
        if datos.get("precio_en_usd") is False:
            datos["precio_venta_usd"] = None
            datos["precio_costo_usd"] = None
            for v in datos.get("variantes") or []:
                v["precio_venta_usd"] = None
                v["precio_costo_usd"] = None
        return datos

    if not cotizacion:
        raise HTTPException(
            status_code=400,
            detail="Para que un precio siga al dólar primero hay que cargar el valor del dólar.",
        )
    tiene_variantes = datos.get("tiene_variantes")
    if tiene_variantes is None:
        tiene_variantes = bool((actual or {}).get("tiene_variantes"))

    def completar_usd(item, etiqueta):
        # Si llegan solo los pesos (por ejemplo, un ingreso de mercadería), se
        # pasan a dólares con la cotización del día
        for campo in ("precio_venta", "precio_costo"):
            if item.get(f"{campo}_usd") is None and item.get(campo) is not None:
                item[f"{campo}_usd"] = round(float(item[campo]) / cotizacion, 2)
            usd = item.get(f"{campo}_usd")
            if usd is not None and usd < 0:
                raise HTTPException(status_code=400, detail=f"{etiqueta}: el precio no puede ser negativo")
        if item.get("precio_venta_usd") is None:
            raise HTTPException(status_code=400, detail=f"{etiqueta}: falta el precio de venta en dólares")
        _aplicar(item, cotizacion)

    if tiene_variantes:
        if "variantes" in datos:
            for v in datos["variantes"]:
                completar_usd(v, f"Variante '{v.get('nombre', '')}'")
    elif any(k in datos for k in ("precio_venta", "precio_venta_usd", "precio_en_usd")):
        base = {**{k: (actual or {}).get(k) for k in ("precio_venta_usd", "precio_costo_usd")}, **datos}
        if "precio_venta" in datos and "precio_venta_usd" not in datos:
            base["precio_venta_usd"] = None
        if "precio_costo" in datos and "precio_costo_usd" not in datos:
            base["precio_costo_usd"] = None
        completar_usd(base, "Producto")
        for k in ("precio_venta", "precio_costo", "precio_venta_usd", "precio_costo_usd"):
            datos[k] = base.get(k)
    datos["precio_en_usd"] = True
    return datos


async def actualizar_precios_en_usd(db, cotizacion: float | None = None) -> int:
    """Recalcula los pesos de todos los productos con precio en dólares.
    Se llama cada vez que se guarda una cotización nueva. Devuelve cuántos cambiaron."""
    cotizacion = cotizacion or await cotizacion_venta(db)
    if not cotizacion:
        return 0
    cambiados = 0
    async for p in db.productos.find({"precio_en_usd": True}):
        if aplicar_cotizacion(p, cotizacion):
            # Solo los campos de precio: así no se pisa el stock si justo hay una venta
            if p.get("tiene_variantes"):
                campos = {}
                for i, v in enumerate(p.get("variantes") or []):
                    for c in ("precio_venta", "precio_costo"):
                        if v.get(f"{c}_usd") is not None:
                            campos[f"variantes.{i}.{c}"] = v.get(c)
            else:
                campos = {"precio_venta": p.get("precio_venta"), "precio_costo": p.get("precio_costo")}
            if campos:
                await db.productos.update_one({"_id": p["_id"]}, {"$set": campos})
                cambiados += 1
    return cambiados
