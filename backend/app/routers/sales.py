from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.sale import SaleCreate, DevolucionCreate
from app.models.repair import EnvioEmail
from app.utils.envio_comprobantes import preparar_destino, enviar_ticket
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from bson import ObjectId
from datetime import datetime
from app.utils.logger import registrar_auditoria
from app.utils import imei as imei_util
from app.utils.stock import stock_en, aplicar_delta, descontar_varios
import re
from app.utils.cajas import caja_para_vender, exigir_dueno_o_admin, rango_periodo
from app.utils.idempotencia import resultado_previo, reclamar_clave, guardar_resultado, liberar_clave
from app.utils.tarjetas import datos_tarjeta, texto_tarjeta
from app.utils.personal import persona, ROLES_VENDEDOR
from app.utils.pagos import (
    validar_medios_unicos,
    METODOS_VALIDOS,
    USD,
    cotizacion_para_cobro,
    formato_usd,
    movimiento_vuelto,
    pagos_de_venta,
)

router = APIRouter()

async def get_next_number(db, collection: str, prefix: str) -> str:
    counter = await db.contadores.find_one_and_update(
        {"_id": collection},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"{prefix}{str(counter['seq']).zfill(4)}"

LIMITE_LISTADO = 1000


@router.get("/")
async def get_sales(
    desde: str = None,
    hasta: str = None,
    q: str = None,
    limite: int = LIMITE_LISTADO,
    current_user: dict = Depends(get_current_user),
):
    """Ventas, de la más nueva a la más vieja. Sin filtros trae las últimas
    LIMITE_LISTADO; con fechas (AAAA-MM-DD, horario de acá) o con un número de
    venta / IMEI en q, busca en todas."""
    check_permission(current_user["role"], "ventas:read")
    db = get_db()
    filtro = {}
    if desde or hasta:
        inicio, fin = rango_periodo(None, desde, hasta)
        filtro["fecha"] = {"$gte": inicio, "$lte": fin}
    texto = (q or "").strip()
    if texto:
        opciones = [{"numero_venta": {"$regex": re.escape(texto), "$options": "i"}}]
        digitos = imei_util.normalizar(texto)
        if len(digitos) >= 4:
            opciones.append({"items.imeis": {"$regex": re.escape(digitos)}})
        filtro["$or"] = opciones
    limite = max(1, min(limite, 10000))
    sales = await db.ventas.find(filtro).sort("fecha", -1).limit(limite).to_list(None)
    return [{**s, "_id": str(s["_id"])} for s in sales]

@router.get("/{sale_id}")
async def get_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "ventas:read")
    db = get_db()
    if not ObjectId.is_valid(sale_id):
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    sale = await db.ventas.find_one({"_id": ObjectId(sale_id)})
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return {**sale, "_id": str(sale["_id"])}

TIPOS_AJUSTE = ("ninguno", "descuento", "interes")


def redondear(valor: float) -> float:
    return round(valor + 1e-9, 2)


def formato_monto(monto: float) -> str:
    # 10000.5 -> "$ 10.000,50" (mismo formato que usa el frontend)
    texto = f"{monto:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"$ {texto}"


@router.post("/")
async def create_sale(sale: SaleCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "ventas:create")
    db = get_db()

    # Reenvio de una venta que ya se registró: devolver el mismo resultado
    ya_hecha = await resultado_previo(db, sale.clave_idempotencia, "venta")
    if ya_hecha:
        return ya_hecha

    # 1. Validaciones básicas del pedido
    if not sale.items:
        raise HTTPException(status_code=400, detail="La venta no tiene productos")
    if sale.tipo_ajuste not in TIPOS_AJUSTE:
        raise HTTPException(status_code=400, detail="Tipo de ajuste inválido")
    porcentaje = 0.0 if sale.tipo_ajuste == "ninguno" else sale.porcentaje_ajuste
    if porcentaje < 0 or porcentaje > 100:
        raise HTTPException(status_code=400, detail="El porcentaje debe estar entre 0 y 100")

    # Toda venta se registra en una caja, y esa caja define la sucursal: de ahí
    # sale el stock y ahí entra el dinero. El cajero vende en la caja que abrió
    # él; el vendedor, en la caja abierta de su sucursal.
    caja_cobro = await caja_para_vender(db, current_user, sale.sucursal)
    sucursal = caja_cobro["sucursal"]

    # 2. Tomar precios y nombres de la base de datos (nunca del frontend)
    #    y validar el stock ANTES de escribir nada
    productos = {}
    items_finales = []
    pedidos = {}  # (producto_id, variante) -> cantidad total pedida
    stock_por_clave = {}
    nombre_por_clave = {}
    imeis_de_la_venta = set()

    for item in sale.items:
        if item.cantidad < 1:
            raise HTTPException(status_code=400, detail="La cantidad debe ser al menos 1")
        if not ObjectId.is_valid(item.producto_id):
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        if item.producto_id not in productos:
            productos[item.producto_id] = await db.productos.find_one({"_id": ObjectId(item.producto_id)})
        producto = productos[item.producto_id]
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        if not producto.get("activo", True):
            raise HTTPException(status_code=400, detail=f"'{producto['nombre']}' está inactivo")

        if item.variante_nombre:
            variante = next(
                (v for v in producto.get("variantes", []) if v["nombre"] == item.variante_nombre),
                None,
            )
            if not variante:
                raise HTTPException(status_code=404, detail=f"Variante '{item.variante_nombre}' no encontrada")
            precio = variante.get("precio_venta", 0)
            costo = variante.get("precio_costo")
            stock = stock_en(variante, sucursal)
            nombre = f"{producto['nombre']} — {item.variante_nombre}"
        else:
            precio = producto.get("precio_venta", 0) or 0
            costo = producto.get("precio_costo")
            stock = stock_en(producto, sucursal)
            nombre = producto["nombre"]

        clave = (item.producto_id, item.variante_nombre)
        pedidos[clave] = pedidos.get(clave, 0) + item.cantidad
        stock_por_clave[clave] = stock
        nombre_por_clave[clave] = nombre

        final = {
            "producto_id": item.producto_id,
            "variante_nombre": item.variante_nombre,
            "nombre_producto": nombre,
            "cantidad": item.cantidad,
            "precio_unitario": precio,
            "subtotal": redondear(precio * item.cantidad),
            # Costo al momento de la venta: la rentabilidad no cambia si después sube el costo
            "precio_costo": costo,
        }

        # Celulares: un IMEI válido y distinto por cada unidad vendida
        if producto.get("pide_imei"):
            imeis = [imei_util.normalizar(x) for x in (item.imeis or []) if imei_util.normalizar(x)]
            if len(imeis) != item.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Falta el IMEI de '{nombre}': hay que cargar uno por cada unidad ({item.cantidad}).",
                )
            for x in imeis:
                if not imei_util.es_valido(x):
                    raise HTTPException(
                        status_code=400,
                        detail=f"El IMEI {x} de '{nombre}' no es válido. Revisá los 15 números.",
                    )
                if x in imeis_de_la_venta:
                    raise HTTPException(status_code=400, detail=f"El IMEI {x} está cargado dos veces.")
                imeis_de_la_venta.add(x)
            final["imeis"] = imeis

        items_finales.append(final)

    for clave, cantidad in pedidos.items():
        if cantidad > stock_por_clave[clave]:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{nombre_por_clave[clave]}'. Disponible: {stock_por_clave[clave]}, solicitado: {cantidad}",
            )

    # 3. Calcular totales en el servidor
    subtotal = redondear(sum(i["subtotal"] for i in items_finales))
    monto_ajuste = redondear(subtotal * porcentaje / 100)
    descuento = monto_ajuste if sale.tipo_ajuste == "descuento" else 0
    interes = monto_ajuste if sale.tipo_ajuste == "interes" else 0
    total = redondear(subtotal - descuento + interes)

    # Si los precios cambiaron mientras se armaba la venta, avisar en vez de cobrar otro monto
    if abs(total - sale.total) > 0.01:
        raise HTTPException(
            status_code=409,
            detail=f"El total cambió porque se actualizaron los precios. Total actual: {formato_monto(total)}. Revisá la venta y confirmá de nuevo.",
        )

    # 4. Validar el pago y armar el texto del medio de pago
    #    Con medio "usd" el monto del pago es en dólares: se convierte a pesos
    #    con la cotización del servidor y la diferencia con el total es el
    #    vuelto, que se entrega en pesos.
    vuelto = 0.0
    cotizacion = None
    if sale.pagos:
        for p in sale.pagos:
            if p.metodo not in METODOS_VALIDOS:
                raise HTTPException(status_code=400, detail=f"Medio de pago inválido: {p.metodo}")
        validar_medios_unicos([p.metodo for p in sale.pagos])
        usa_usd = any(p.metodo == USD for p in sale.pagos)
        if usa_usd:
            cotizacion = await cotizacion_para_cobro(db)

        if len(sale.pagos) == 1 and not usa_usd:
            metodo_pago = sale.pagos[0].metodo
            pagos_venta = [{"metodo": metodo_pago, "monto": total}]
        else:
            if any(p.monto <= 0 for p in sale.pagos):
                raise HTTPException(status_code=400, detail="Cada medio de pago debe tener un monto mayor a 0")
            pagos_venta = []
            for p in sale.pagos:
                if p.metodo == USD:
                    usd = redondear(p.monto)
                    pagos_venta.append({
                        "metodo": USD,
                        "monto": redondear(usd * cotizacion),
                        "usd": usd,
                        "cotizacion": cotizacion,
                    })
                else:
                    pagos_venta.append({"metodo": p.metodo, "monto": redondear(p.monto)})
            pagado = redondear(sum(p["monto"] for p in pagos_venta))

            if not usa_usd:
                if abs(pagado - total) > 0.01:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El total pagado ({formato_monto(pagado)}) no coincide con el total ({formato_monto(total)})",
                    )
            else:
                if pagado < total - 0.01:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Lo recibido ({formato_monto(pagado)}) no alcanza para cubrir el total ({formato_monto(total)})",
                    )
                if pagado > total + 0.01:
                    vuelto = redondear(pagado - total)
                    en_efectivo = sum(p["monto"] for p in pagos_venta if p["metodo"] in ("efectivo", USD))
                    if vuelto > en_efectivo + 0.01:
                        raise HTTPException(
                            status_code=400,
                            detail="El vuelto solo puede salir de lo cobrado en efectivo o en dólares, no de tarjeta ni transferencia.",
                        )

            def texto_pago(p):
                if p["metodo"] == USD:
                    return f"usd: {formato_usd(p['usd'])}"
                return f"{p['metodo']}: {formato_monto(p['monto'])}"

            if len(pagos_venta) > 1:
                metodo_pago = " + ".join(texto_pago(p) for p in pagos_venta)
            else:
                metodo_pago = USD
    else:
        if sale.metodo_pago == USD:
            raise HTTPException(status_code=400, detail="Indicá cuántos dólares se recibieron")
        if sale.metodo_pago not in METODOS_VALIDOS:
            raise HTTPException(status_code=400, detail="Medio de pago inválido")
        metodo_pago = sale.metodo_pago
        pagos_venta = [{"metodo": metodo_pago, "monto": total}]

    # 4b. Tarjetas: cuál se usó, cuotas y recargo. El recargo se suma a lo
    #     que se cobra en esa tarjeta y al total de la venta.
    if sale.pagos:
        for entrada, pv in zip(sale.pagos, pagos_venta):
            extra = await datos_tarjeta(db, pv["metodo"], entrada.tarjeta_id, entrada.cuotas, pv["monto"])
            if extra:
                pv.update(extra)
                pv["monto"] = redondear(pv["monto"] + extra["recargo"])
        recargo_tarjeta = redondear(sum(pv.get("recargo", 0) for pv in pagos_venta))
        if recargo_tarjeta or any(pv.get("tarjeta") for pv in pagos_venta):
            total = redondear(total + recargo_tarjeta)

            def texto_con_tarjeta(p):
                if p["metodo"] == USD:
                    return f"usd: {formato_usd(p['usd'])}"
                tarjeta = texto_tarjeta(p)
                return f"{p['metodo']}{' (' + tarjeta + ')' if tarjeta else ''}: {formato_monto(p['monto'])}"

            if len(pagos_venta) > 1:
                metodo_pago = " + ".join(texto_con_tarjeta(p) for p in pagos_venta)
            elif pagos_venta[0].get("tarjeta"):
                metodo_pago = f"{pagos_venta[0]['metodo']} ({texto_tarjeta(pagos_venta[0])})"

    # 4c. Vendedor: el elegido o, si no se eligió, quien registra la venta
    vendedor = await persona(db, sale.vendedor_id or current_user["user_id"], ROLES_VENDEDOR, "vendedor")

    # 4d. Ticket por email: el destino se valida antes de registrar la venta
    destino = cliente_email = None
    if sale.enviar_email:
        destino, cliente_email = await preparar_destino(db, sale.cliente_id, sale.email_destino)

    # 5. Registrar la venta (una sola vez por clave: un doble click no duplica)
    previa = await reclamar_clave(db, sale.clave_idempotencia, "venta")
    if previa:
        return previa["resultado"]
    try:
        respuesta = await _registrar_venta(
            db, sale, current_user, items_finales, subtotal, porcentaje, descuento,
            interes, total, metodo_pago, pagos_venta, vuelto, cotizacion, caja_cobro, sucursal, vendedor,
        )
    except Exception:
        await liberar_clave(db, sale.clave_idempotencia, "venta")
        raise
    if sale.enviar_email:
        # La venta ya quedó registrada: si el email falla, se avisa pero no se deshace
        venta = await db.ventas.find_one({"_id": ObjectId(respuesta["id"])})
        respuesta = {**respuesta, "envio_email": await enviar_ticket(
            db, venta, destino, cliente_email, current_user["user_id"])}
    return respuesta


async def _registrar_venta(db, sale, current_user, items_finales, subtotal, porcentaje, descuento,
                           interes, total, metodo_pago, pagos_venta, vuelto, cotizacion, caja_cobro, sucursal, vendedor):
    # Reservar el stock ANTES de registrar nada. El descuento es atómico y
    # condicional: si otra venta se llevó mientras tanto las últimas unidades,
    # esta falla sin dejar el stock en negativo.
    faltante = await descontar_varios(
        db,
        [(i["producto_id"], i["variante_nombre"], i["cantidad"]) for i in items_finales],
        sucursal,
    )
    if faltante:
        nombre = next(
            i["nombre_producto"] for i in items_finales
            if i["producto_id"] == faltante[0] and i["variante_nombre"] == faltante[1]
        )
        raise HTTPException(
            status_code=409,
            detail=f"Stock insuficiente para '{nombre}': otra venta se llevó las últimas unidades. Actualizá y revisá la venta.",
        )

    try:
        return await _guardar_venta(
            db, sale, current_user, items_finales, subtotal, porcentaje, descuento,
            interes, total, metodo_pago, pagos_venta, vuelto, cotizacion, caja_cobro, sucursal, vendedor,
        )
    except Exception:
        # Si algo falla después de reservar, el stock vuelve a su lugar
        for i in items_finales:
            await aplicar_delta(db, i["producto_id"], i["variante_nombre"], sucursal, i["cantidad"])
        raise


async def _guardar_venta(db, sale, current_user, items_finales, subtotal, porcentaje, descuento,
                         interes, total, metodo_pago, pagos_venta, vuelto, cotizacion, caja_cobro, sucursal, vendedor):
    numero = await get_next_number(db, "ventas", "V-")
    new_sale = {
        "cliente_id": sale.cliente_id,
        "items": items_finales,
        "subtotal": subtotal,
        "tipo_ajuste": sale.tipo_ajuste,
        "porcentaje_ajuste": porcentaje,
        "descuento": descuento,
        "interes": interes,
        "total": total,
        "recargo_tarjeta": redondear(sum(p.get("recargo", 0) for p in pagos_venta)),
        "metodo_pago": metodo_pago,
        "pagos": pagos_venta,
        "vuelto": vuelto,
        "cotizacion_usd": cotizacion,
        "sucursal": sucursal,
        "caja_id": str(caja_cobro["_id"]),
        "notas": sale.notas,
        "numero_venta": numero,
        "estado": "completada",
        "usuario_id": current_user["user_id"],
        "vendedor_id": vendedor["id"],
        "vendedor_nombre": vendedor["nombre"],
        "fecha": datetime.utcnow(),
    }
    result = await db.ventas.insert_one(new_sale)

    # Vuelto en pesos entregado al cobrar en dólares: sale de la caja
    if vuelto > 0 and caja_cobro:
        await db.cajas.update_one(
            {"_id": caja_cobro["_id"]},
            {"$push": {"movimientos": movimiento_vuelto(
                vuelto, f"venta {numero}", str(result.inserted_id), current_user["user_id"]
            )}},
        )

    # 6. Registrar los movimientos de stock (el stock ya se descontó arriba)
    for item in items_finales:
        await db.stock_movimientos.insert_one({
            "producto_id": item["producto_id"],
            "variante_nombre": item["variante_nombre"],
            "tipo": "salida",
            "cantidad": item["cantidad"],
            "sucursal": sucursal,
            "motivo": "venta",
            "referencia_id": str(result.inserted_id),
            "usuario_id": current_user["user_id"],
            "fecha": datetime.utcnow(),
        })

    await registrar_auditoria(
        db=db,
        usuario_id=current_user["user_id"],
        usuario_nombre="",
        rol=current_user["role"],
        accion="crear",
        modulo="ventas",
        descripcion=f"Venta registrada: {numero}" + (
            f". IMEI vendidos: {', '.join(sorted(imeis))}"
            if (imeis := [x for i in items_finales for x in i.get("imeis", [])]) else ""
        ),
    )

    respuesta = {"message": "Venta registrada", "numero_venta": numero, "id": str(result.inserted_id), "total": total, "vuelto": vuelto}
    await guardar_resultado(db, sale.clave_idempotencia, "venta", respuesta)
    return respuesta


@router.post("/{sale_id}/email")
async def email_ticket(sale_id: str, datos: EnvioEmail, current_user: dict = Depends(get_current_user)):
    """Envía (o reenvía) el ticket al email del cliente o al indicado."""
    check_permission(current_user["role"], "ventas:read")
    db = get_db()
    if not ObjectId.is_valid(sale_id):
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    venta = await db.ventas.find_one({"_id": ObjectId(sale_id)})
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    destino, cliente = await preparar_destino(db, venta.get("cliente_id"), datos.email)
    resultado = await enviar_ticket(db, venta, destino, cliente, current_user["user_id"])
    if not resultado["enviado"]:
        raise HTTPException(status_code=502, detail=resultado["error"])
    return resultado


@router.put("/{sale_id}/cancel")
async def cancel_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "ventas:cancel")
    db = get_db()
    try:
        oid = ObjectId(sale_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    sale = await db.ventas.find_one({"_id": oid})
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale["estado"] == "cancelada":
        raise HTTPException(status_code=400, detail="La venta ya está cancelada")
    if sale.get("devoluciones"):
        raise HTTPException(
            status_code=400,
            detail="Esta venta ya tiene devoluciones: para devolver el resto, registrá otra devolución.",
        )

    # La devolución del dinero se registra en la caja abierta de la sucursal
    # de la venta. La cancela quien abrió esa caja o un administrador.
    caja = await db.cajas.find_one({"estado": "abierta", "sucursal": sale.get("sucursal")})
    if not caja:
        raise HTTPException(
            status_code=400,
            detail="Para cancelar una venta hace falta que la caja de su sucursal esté abierta, donde se registra la devolución del dinero.",
        )
    exigir_dueno_o_admin(caja, current_user, "cancelar ventas de")

    # Solo se pueden cancelar ventas de la caja abierta: las de cajas ya
    # cerradas quedaron incluidas en un cierre y no se pueden modificar.
    if sale["fecha"] < caja["fecha_apertura"]:
        raise HTTPException(
            status_code=400,
            detail="Esta venta corresponde a una caja anterior (ya cerrada), por eso no se puede cancelar.",
        )

    # Marcar como cancelada solo si seguía completada (evita doble cancelación simultánea)
    resultado = await db.ventas.update_one(
        {"_id": oid, "estado": "completada"},
        {"$set": {
            "estado": "cancelada",
            "fecha_cancelacion": datetime.utcnow(),
            "cancelada_por": current_user["user_id"],
        }},
    )
    if resultado.modified_count == 0:
        raise HTTPException(status_code=400, detail="La venta ya está cancelada")

    numero = sale.get("numero_venta", "")

    # Devolver stock (producto base o variante) y registrar el movimiento
    for item in sale.get("items", []):
        variante = item.get("variante_nombre")
        await db.stock_movimientos.insert_one({
            "producto_id": item["producto_id"],
            "variante_nombre": variante,
            "tipo": "entrada",
            "cantidad": item["cantidad"],
            "sucursal": sale.get("sucursal", "sucursal_1"),
            "motivo": "cancelacion_venta",
            "referencia_id": sale_id,
            "usuario_id": current_user["user_id"],
            "fecha": datetime.utcnow(),
        })
        await aplicar_delta(db, item["producto_id"], variante, sale.get("sucursal", "sucursal_1"), item["cantidad"])

    # Devolver el dinero por el mismo medio con el que se cobró: lo cobrado
    # en dólares se descuenta del esperado en dólares. Si hubo vuelto en
    # pesos, se revierte (el cliente lo devuelve junto con los dólares).
    egresos = []
    for p in pagos_de_venta(sale):
        if p["monto"] <= 0:
            continue
        egreso = {
            "tipo": "egreso",
            "monto": p["monto"],
            "motivo": f"Cancelación venta {numero} — {p['metodo']}",
            "metodo_pago": p["metodo"],
            "concepto": "cancelacion_venta",
            "referencia_id": sale_id,
            "notas": f"Cancelación de la venta {numero}",
            "usuario_id": current_user["user_id"],
            "fecha": datetime.utcnow(),
        }
        if p["metodo"] == USD:
            egreso["monto_usd"] = p.get("usd")
        egresos.append(egreso)
    vuelto_entregado = sale.get("vuelto", 0) or 0
    if vuelto_entregado > 0:
        egresos.append({
            "tipo": "ingreso",
            "monto": vuelto_entregado,
            "motivo": f"Cancelación venta {numero} — vuelto devuelto",
            "metodo_pago": "efectivo",
            "concepto": "cancelacion_venta",
            "referencia_id": sale_id,
            "notas": f"Se revierte el vuelto en pesos de la venta {numero}",
            "usuario_id": current_user["user_id"],
            "fecha": datetime.utcnow(),
        })
    if egresos:
        await db.cajas.update_one({"_id": caja["_id"]}, {"$push": {"movimientos": {"$each": egresos}}})

    await registrar_auditoria(
        db=db,
        usuario_id=current_user["user_id"],
        usuario_nombre="",
        rol=current_user["role"],
        accion="cancelar",
        modulo="ventas",
        descripcion=f"Venta cancelada: {numero}. Devuelto: {sale['total']}",
    )

    return {"message": "Venta cancelada", "numero_venta": numero, "total_devuelto": sale["total"]}


# ── Devoluciones ─────────────────────────────────────────────────────────
# Para ventas de cualquier fecha (también las de cajas ya cerradas, que no se
# pueden cancelar). La venta original no cambia: se le anota la devolución.
# El dinero sale de la caja abierta HOY en la sucursal de la venta; cada
# producto vuelve o no al stock (si vino fallado).

METODOS_DEVOLUCION = ("efectivo", "transferencia", "debito", "credito")


def devuelto_por_item(sale) -> list:
    """Unidades ya devueltas de cada producto de la venta (por posición)."""
    devueltas = [0] * len(sale.get("items", []))
    for d in sale.get("devoluciones", []):
        for it in d.get("items", []):
            if 0 <= it["indice"] < len(devueltas):
                devueltas[it["indice"]] += it["cantidad"]
    return devueltas


def precio_pagado_unitario(sale, item) -> float:
    """Lo que pagó el cliente por unidad: el precio con el descuento o el
    recargo de la venta repartido en proporción."""
    suma = sum(i.get("subtotal", 0) for i in sale.get("items", [])) or 0
    factor = (sale.get("total", 0) / suma) if suma > 0 else 1
    return (item.get("subtotal", 0) / item["cantidad"]) * factor if item.get("cantidad") else 0


@router.post("/{sale_id}/devolucion")
async def registrar_devolucion(sale_id: str, datos: DevolucionCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "ventas:cancel")
    db = get_db()
    if not ObjectId.is_valid(sale_id):
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    oid = ObjectId(sale_id)
    sale = await db.ventas.find_one({"_id": oid})
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale["estado"] != "completada":
        raise HTTPException(status_code=400, detail="La venta está cancelada: no se puede devolver")
    if datos.metodo not in METODOS_DEVOLUCION:
        raise HTTPException(status_code=400, detail="Elegí cómo se devuelve el dinero: efectivo, transferencia, débito o crédito")

    sucursal = sale.get("sucursal", "sucursal_1")
    caja = await db.cajas.find_one({"estado": "abierta", "sucursal": sucursal})
    if not caja:
        raise HTTPException(
            status_code=400,
            detail="Para registrar una devolución tiene que estar abierta la caja de la sucursal de la venta, "
                   "de donde sale el dinero.",
        )
    exigir_dueno_o_admin(caja, current_user, "registrar devoluciones en")

    items_venta = sale.get("items", [])
    devueltas = devuelto_por_item(sale)
    elegidos, monto_calculado, vistos = [], 0.0, set()
    for it in datos.items:
        if it.cantidad <= 0:
            continue
        if not 0 <= it.indice < len(items_venta) or it.indice in vistos:
            raise HTTPException(status_code=400, detail="Producto de la venta inválido")
        vistos.add(it.indice)
        original = items_venta[it.indice]
        quedan = original["cantidad"] - devueltas[it.indice]
        if it.cantidad > quedan:
            raise HTTPException(
                status_code=400,
                detail=f"De «{original['nombre_producto']}» se pueden devolver como máximo {quedan} unidad(es).",
            )
        imeis = []
        if original.get("imeis"):
            ya = {x for d in sale.get("devoluciones", []) for i in d.get("items", []) if i["indice"] == it.indice for x in i.get("imeis", [])}
            imeis = [imei_util.normalizar(x) for x in (it.imeis or [])]
            if len(imeis) != it.cantidad or len(set(imeis)) != len(imeis) or any(x not in original["imeis"] or x in ya for x in imeis):
                raise HTTPException(
                    status_code=400,
                    detail=f"Elegí qué IMEI de «{original['nombre_producto']}» se devuelven (uno por unidad).",
                )
        monto_calculado += precio_pagado_unitario(sale, original) * it.cantidad
        elegidos.append({
            "indice": it.indice,
            "producto_id": original["producto_id"],
            "variante_nombre": original.get("variante_nombre"),
            "nombre_producto": original["nombre_producto"],
            "cantidad": it.cantidad,
            "vuelve_stock": it.vuelve_stock,
            "imeis": imeis,
            "precio_costo": original.get("precio_costo"),
        })
    if not elegidos:
        raise HTTPException(status_code=400, detail="Elegí al menos un producto para devolver")

    monto_calculado = round(monto_calculado, 2)
    ya_devuelto = sale.get("total_devuelto", 0) or 0
    maximo = round(sale.get("total", 0) - ya_devuelto, 2)
    monto = monto_calculado if datos.monto is None else round(datos.monto, 2)
    # Lo devuelto de cada producto (para los reportes por producto)
    for it in elegidos:
        original = items_venta[it["indice"]]
        parte = precio_pagado_unitario(sale, original) * it["cantidad"]
        it["monto"] = round(parte * (monto / monto_calculado), 2) if monto_calculado > 0 else 0
    if monto < 0 or monto > maximo + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"El monto a devolver tiene que estar entre $0 y {maximo:,.2f} (lo que queda de la venta).".replace(",", "X").replace(".", ",").replace("X", "."),
        )

    ahora = datetime.utcnow()
    numero = await get_next_number(db, "devoluciones", "D-")
    devolucion = {
        "numero": numero,
        "fecha": ahora,
        "items": elegidos,
        "monto": monto,
        "metodo": datos.metodo,
        "motivo": (datos.motivo or "").strip() or None,
        "usuario_id": current_user["user_id"],
        "usuario_nombre": (await db.usuarios.find_one({"_id": ObjectId(current_user["user_id"])}, {"nombre": 1}) or {}).get("nombre", ""),
        "caja_id": str(caja["_id"]),
        "sucursal": sucursal,
    }
    # Solo si nadie registró otra devolución de esta venta mientras tanto
    cantidad_previa = len(sale.get("devoluciones", []))
    guardada = await db.ventas.update_one(
        {"_id": oid, "estado": "completada", f"devoluciones.{cantidad_previa}": {"$exists": False}},
        {"$push": {"devoluciones": devolucion}, "$set": {"total_devuelto": round(ya_devuelto + monto, 2)}},
    )
    if guardada.modified_count != 1:
        raise HTTPException(status_code=409, detail="La venta cambió mientras se registraba la devolución. Actualizá y volvé a intentar.")

    numero_venta = sale.get("numero_venta", "")
    for it in elegidos:
        if not it["vuelve_stock"]:
            continue
        await db.stock_movimientos.insert_one({
            "producto_id": it["producto_id"],
            "variante_nombre": it["variante_nombre"],
            "tipo": "entrada",
            "cantidad": it["cantidad"],
            "sucursal": sucursal,
            "motivo": "devolucion_venta",
            "referencia_id": sale_id,
            "notas": f"Devolución {numero} de la venta {numero_venta}",
            "usuario_id": current_user["user_id"],
            "fecha": ahora,
        })
        await aplicar_delta(db, it["producto_id"], it["variante_nombre"], sucursal, it["cantidad"])

    if monto > 0:
        await db.cajas.update_one({"_id": caja["_id"]}, {"$push": {"movimientos": {
            "tipo": "egreso",
            "monto": monto,
            "motivo": f"Devolución {numero} — venta {numero_venta}",
            "metodo_pago": datos.metodo,
            "concepto": "devolucion_venta",
            "referencia_id": sale_id,
            "notas": devolucion["motivo"],
            "usuario_id": current_user["user_id"],
            "fecha": ahora,
        }}})

    detalle = ", ".join(f"{i['cantidad']} × {i['nombre_producto']}{'' if i['vuelve_stock'] else ' (no vuelve al stock)'}" for i in elegidos)
    await registrar_auditoria(
        db=db, usuario_id=current_user["user_id"], usuario_nombre=devolucion["usuario_nombre"],
        rol=current_user["role"], accion="devolucion", modulo="ventas",
        descripcion=f"Devolución {numero} de la venta {numero_venta}: {detalle}. Devuelto: {monto} ({datos.metodo})",
    )
    return {"message": "Devolución registrada", "numero": numero, "monto": monto, "devolucion": devolucion}
