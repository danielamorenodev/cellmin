from app.utils.stock import SUCURSALES, stock_en, minimo_en, bajo_minimo
from fastapi import APIRouter, Depends
from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from fastapi import HTTPException
from app.utils.cajas import inicio_dia_local, dia_local


router = APIRouter()

ESTADOS_ACTIVOS = ["en_diagnostico", "ingresada", "en_reparacion", "lista"]
EN_CURSO = ("en_diagnostico", "ingresada", "en_reparacion")


def _dias(desde, hasta):
    """Días corridos entre dos fechas AAAA-MM-DD."""
    return (datetime.strptime(hasta, "%Y-%m-%d") - datetime.strptime(desde, "%Y-%m-%d")).days


def dias_atraso(r) -> int:
    """Días que pasaron desde la entrega estimada sin que la orden esté lista."""
    estimada = r.get("fecha_estimada_entrega")
    if not estimada or r.get("estado") not in EN_CURSO:
        return 0
    return max(0, _dias(estimada, dia_local()))


async def _nombres_clientes(db, ids):
    validos = [ObjectId(i) for i in set(ids) if i and ObjectId.is_valid(i)]
    docs = await db.clientes.find({"_id": {"$in": validos}}, {"nombre": 1, "apellido": 1, "telefono": 1}).to_list(5000)
    return {str(c["_id"]): (f"{c.get('nombre', '')} {c.get('apellido') or ''}".strip(), c.get("telefono")) for c in docs}


def fila_reparacion(r, clientes):
    """Una orden con los datos que usan el Inicio y los reportes."""
    ingreso = r.get("fecha_ingreso")
    dia_ingreso = dia_local(ingreso) if ingreso else None
    lista = r.get("fecha_lista")
    entrega = r.get("fecha_entrega")
    fin = dia_local(entrega) if entrega else (dia_local(lista) if lista else None)
    estimada = r.get("fecha_estimada_entrega")
    nombre, telefono = clientes.get(r.get("cliente_id"), ("", None))
    equipo = r.get("equipo") or {}
    return {
        "id": str(r["_id"]),
        "numero_orden": r.get("numero_orden"),
        "estado": r.get("estado"),
        "cliente": nombre,
        "telefono": telefono,
        "cliente_id": r.get("cliente_id"),
        "equipo": f"{equipo.get('marca', '')} {equipo.get('modelo', '')}".strip(),
        "sucursal": r.get("sucursal"),
        "vendedor": r.get("vendedor_nombre"),
        "tecnico": r.get("tecnico_nombre"),
        "fecha_ingreso": ingreso,
        "fecha_estimada_entrega": estimada,
        "fecha_entrega": entrega,
        # Días en el local: hasta hoy si sigue abierta, hasta que quedó lista o se entregó si no
        "dias_en_taller": _dias(dia_ingreso, fin or dia_local()) if dia_ingreso else None,
        "dias_atraso": dias_atraso(r),
        # Si ya terminó: cuántos días tarde quedó lista respecto de lo prometido (negativo = antes)
        "dias_diferencia": _dias(estimada, fin) if (estimada and fin) else None,
        "precio_total": r.get("precio_total", 0),
        "saldo_pendiente": r.get("saldo_pendiente", 0),
    }


@router.get("/dashboard/detalle/{tipo}")
async def detalle_dashboard(tipo: str, current_user: dict = Depends(get_current_user)):
    """Lo que hay detrás de cada número del Inicio."""
    check_permission(current_user["role"], "dashboard:read")
    db = get_db()
    if tipo == "reparaciones":
        reps = await db.reparaciones.find({"estado": {"$in": ESTADOS_ACTIVOS}}).to_list(2000)
        clientes = await _nombres_clientes(db, [r.get("cliente_id") for r in reps])
        filas = [fila_reparacion(r, clientes) for r in reps]
        return sorted(filas, key=lambda f: (-f["dias_atraso"], -(f["dias_en_taller"] or 0)))
    if tipo == "ventas":
        check_permission(current_user["role"], "ventas:read")
        ventas = await db.ventas.find({"estado": "completada", "fecha": {"$gte": inicio_dia_local()}}).sort("fecha", -1).to_list(1000)
        return [{"id": str(v["_id"]), "numero_venta": v.get("numero_venta"), "fecha": v["fecha"],
                 "sucursal": v.get("sucursal"), "vendedor": v.get("vendedor_nombre"),
                 "metodo_pago": v.get("metodo_pago"), "total": v.get("total", 0),
                 "articulos": sum(i.get("cantidad", 0) for i in v.get("items", []))} for v in ventas]
    if tipo == "stock":
        check_permission(current_user["role"], "stock:read")
        productos = await db.productos.find({"activo": True}).to_list(2000)
        return _faltantes(productos)
    raise HTTPException(status_code=404, detail="Detalle no disponible")


@router.get("/reparaciones/detalle")
async def reparaciones_detalle(desde: str = None, hasta: str = None, current_user: dict = Depends(get_current_user)):
    """Todas las órdenes de un período (por fecha de ingreso), con demora,
    atraso, técnico, quién atendió y sucursal: base de los reportes e
    historiales."""
    check_permission(current_user["role"], "*")
    db = get_db()
    filtro = {}
    if desde or hasta:
        filtro["fecha_ingreso"] = {}
        if desde:
            filtro["fecha_ingreso"]["$gte"] = datetime.strptime(desde, "%Y-%m-%d") + timedelta(hours=3)
        if hasta:
            filtro["fecha_ingreso"]["$lt"] = datetime.strptime(hasta, "%Y-%m-%d") + timedelta(days=1, hours=3)
    reps = await db.reparaciones.find(filtro).sort("fecha_ingreso", -1).to_list(5000)
    clientes = await _nombres_clientes(db, [r.get("cliente_id") for r in reps])
    return [fila_reparacion(r, clientes) for r in reps]

@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "dashboard:read")
    db = get_db()
    hoy = inicio_dia_local()
    ventas_hoy = await db.ventas.find({
        "estado": "completada",
        "fecha": {"$gte": hoy}
    }).to_list(1000)
    total_hoy = sum(v["total"] for v in ventas_hoy)
    activas = await db.reparaciones.find(
        {"estado": {"$in": ESTADOS_ACTIVOS}}, {"estado": 1, "fecha_estimada_entrega": 1}
    ).to_list(2000)
    reparaciones_activas = len(activas)
    reparaciones_atrasadas = sum(1 for r in activas if dias_atraso(r) > 0)
    productos_activos = await db.productos.find({"activo": True}).to_list(2000)
    stock_bajo = len(_faltantes(productos_activos))
    total_clientes = await db.clientes.count_documents({"activo": True})
    return {
        "ventas_hoy": len(ventas_hoy),
        "total_ventas_hoy": total_hoy,
        "reparaciones_activas": reparaciones_activas,
        "reparaciones_atrasadas": reparaciones_atrasadas,
        "stock_bajo": stock_bajo,
        "total_clientes": total_clientes,
    }

@router.get("/ventas")
async def get_ventas_report(
    periodo: str = "mes",
    desde: str = None,
    hasta: str = None,
    current_user: dict = Depends(get_current_user)
):
    check_permission(current_user["role"], "*")
    db = get_db()
    hoy = datetime.utcnow()

    if desde and hasta:
        fecha_desde = datetime.strptime(desde, "%Y-%m-%d")
        fecha_hasta = datetime.strptime(hasta, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    else:
        if periodo == "dia":
            fecha_desde = inicio_dia_local()
        elif periodo == "semana":
            fecha_desde = hoy - timedelta(days=7)
        elif periodo == "mes":
            fecha_desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif periodo == "año":
            fecha_desde = hoy.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            fecha_desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        fecha_hasta = hoy

    ventas = await db.ventas.find({
    "fecha": {"$gte": fecha_desde, "$lte": fecha_hasta}
    }).to_list(5000)

    ventas_completadas = [v for v in ventas if v["estado"] == "completada"]
    ventas_canceladas = [v for v in ventas if v["estado"] == "cancelada"]

    total = sum(v["total"] for v in ventas_completadas)
    total_descuentos = sum(v.get("descuento", 0) for v in ventas_completadas)

    por_dia = {}
    for v in ventas:
        dia = v["fecha"].strftime("%Y-%m-%d") if hasattr(v["fecha"], "strftime") else str(v["fecha"])[:10]
        por_dia[dia] = por_dia.get(dia, 0) + v["total"]

    por_metodo = {}
    for v in ventas:
        metodo = v.get("metodo_pago", "efectivo")
        if "+" in metodo:
            metodo = "mixto"
        metodo = metodo.split(" (")[0]  # "credito (Visa 3 cuotas)" -> "credito"
        por_metodo[metodo] = por_metodo.get(metodo, 0) + v["total"]

    por_sucursal = {}
    for v in ventas:
        suc = v.get("sucursal", "sucursal_1")
        por_sucursal[suc] = por_sucursal.get(suc, 0) + v["total"]

    por_vendedor = {}
    for v in ventas_completadas:
        nombre = v.get("vendedor_nombre") or "Sin registrar"
        fila = por_vendedor.setdefault(nombre, {"vendedor": nombre, "cantidad": 0, "total": 0})
        fila["cantidad"] += 1
        fila["total"] += v["total"]

    return {
        "por_vendedor": sorted(por_vendedor.values(), key=lambda f: -f["total"]),
        "periodo": periodo,
        "desde": fecha_desde,
        "hasta": fecha_hasta,
        "cantidad_ventas": len(ventas_completadas),
        "cantidad_canceladas": len(ventas_canceladas),
        "total": total,
        "total_descuentos": total_descuentos,
        "por_dia": [{"fecha": k, "total": v} for k, v in sorted(por_dia.items())],
        "por_metodo": [{"metodo": k, "total": v} for k, v in por_metodo.items()],
        "por_sucursal": [{"sucursal": k, "total": v} for k, v in por_sucursal.items()],
    }
    check_permission(current_user["role"], "*")
    db = get_db()
    hoy = datetime.utcnow()
    if periodo == "dia":
        desde = inicio_dia_local()
    elif periodo == "semana":
        desde = hoy - timedelta(days=7)
    elif periodo == "mes":
        desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif periodo == "año":
        desde = hoy.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    ventas = await db.ventas.find({
        "estado": "completada",
        "fecha": {"$gte": desde}
    }).to_list(5000)

    total = sum(v["total"] for v in ventas)
    total_descuentos = sum(v.get("descuento", 0) for v in ventas)

    # Agrupar por día
    por_dia = {}
    for v in ventas:
        dia = v["fecha"].strftime("%Y-%m-%d") if hasattr(v["fecha"], "strftime") else str(v["fecha"])[:10]
        por_dia[dia] = por_dia.get(dia, 0) + v["total"]

    # Agrupar por método de pago
    por_metodo = {}
    for v in ventas:
        metodo = v.get("metodo_pago", "efectivo")
        if "+" in metodo:
            metodo = "mixto"
        metodo = metodo.split(" (")[0]  # "credito (Visa 3 cuotas)" -> "credito"
        por_metodo[metodo] = por_metodo.get(metodo, 0) + v["total"]

    # Agrupar por sucursal
    por_sucursal = {}
    for v in ventas:
        suc = v.get("sucursal", "sucursal_1")
        por_sucursal[suc] = por_sucursal.get(suc, 0) + v["total"]

    return {
        "periodo": periodo,
        "desde": desde,
        "cantidad_ventas": len(ventas),
        "total": total,
        "total_descuentos": total_descuentos,
        "por_dia": [{"fecha": k, "total": v} for k, v in sorted(por_dia.items())],
        "por_metodo": [{"metodo": k, "total": v} for k, v in por_metodo.items()],
        "por_sucursal": [{"sucursal": k, "total": v} for k, v in por_sucursal.items()],
    }

@router.get("/productos-vendidos")
async def get_top_products(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    pipeline = [
        {"$match": {"estado": "completada"}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.producto_id",
            "nombre": {"$first": "$items.nombre_producto"},
            "cantidad_total": {"$sum": "$items.cantidad"},
            "total_vendido": {"$sum": "$items.subtotal"}
        }},
        {"$sort": {"cantidad_total": -1}},
        {"$limit": 10}
    ]
    result = await db.ventas.aggregate(pipeline).to_list(10)
    return result

@router.get("/rentabilidad")
async def get_rentabilidad(
    periodo: str = "mes",
    desde: str = None,
    hasta: str = None,
    current_user: dict = Depends(get_current_user)
):
    check_permission(current_user["role"], "*")
    db = get_db()
    hoy = datetime.utcnow()

    if desde and hasta:
        fecha_desde = datetime.strptime(desde, "%Y-%m-%d")
        fecha_hasta = datetime.strptime(hasta, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    else:
        if periodo == "dia":
            fecha_desde = inicio_dia_local()
        elif periodo == "semana":
            fecha_desde = hoy - timedelta(days=7)
        elif periodo == "mes":
            fecha_desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif periodo == "año":
            fecha_desde = hoy.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            fecha_desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        fecha_hasta = hoy

    ventas = await db.ventas.find({
        "estado": "completada",
        "fecha": {"$gte": fecha_desde, "$lte": fecha_hasta}
    }).to_list(5000)

    total_ingresos = sum(v["total"] for v in ventas)
    total_costo = 0
    for v in ventas:
        for item in v.get("items", []):
            producto = await db.productos.find_one({"_id": __import__('bson').ObjectId(item["producto_id"])})
            if producto:
                if item.get("variante_nombre") and producto.get("variantes"):
                    variante = next((var for var in producto["variantes"] if var["nombre"] == item["variante_nombre"]), None)
                    if variante:
                        total_costo += variante.get("precio_costo", 0) * item["cantidad"]
                else:
                    total_costo += producto.get("precio_costo", 0) * item["cantidad"]

    ganancia = total_ingresos - total_costo
    margen = (ganancia / total_ingresos * 100) if total_ingresos > 0 else 0

    return {
        "periodo": periodo,
        "total_ingresos": total_ingresos,
        "total_costo": total_costo,
        "ganancia": ganancia,
        "margen_porcentual": round(margen, 2),
    }
    check_permission(current_user["role"], "*")
    db = get_db()
    hoy = datetime.utcnow()
    if periodo == "dia":
        desde = inicio_dia_local()
    elif periodo == "semana":
        desde = hoy - timedelta(days=7)
    elif periodo == "mes":
        desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif periodo == "año":
        desde = hoy.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        desde = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    ventas = await db.ventas.find({
        "estado": "completada",
        "fecha": {"$gte": desde}
    }).to_list(5000)

    total_ingresos = sum(v["total"] for v in ventas)

    # Calcular costo de los productos vendidos
    total_costo = 0
    for v in ventas:
        for item in v.get("items", []):
            producto = await db.productos.find_one({"_id": __import__('bson').ObjectId(item["producto_id"])})
            if producto:
                if item.get("variante_nombre") and producto.get("variantes"):
                    variante = next((var for var in producto["variantes"] if var["nombre"] == item["variante_nombre"]), None)
                    if variante:
                        total_costo += variante.get("precio_costo", 0) * item["cantidad"]
                else:
                    total_costo += producto.get("precio_costo", 0) * item["cantidad"]

    ganancia = total_ingresos - total_costo
    margen = (ganancia / total_ingresos * 100) if total_ingresos > 0 else 0

    return {
        "periodo": periodo,
        "total_ingresos": total_ingresos,
        "total_costo": total_costo,
        "ganancia": ganancia,
        "margen_porcentual": round(margen, 2),
    }

@router.get("/reparaciones")
async def get_reparaciones_report(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    total = await db.reparaciones.count_documents({})
    por_estado = {}
    for estado in ["en_diagnostico", "ingresada", "en_reparacion", "lista", "entregada", "cancelada"]:
        count = await db.reparaciones.count_documents({"estado": estado})
        por_estado[estado] = count

    reparaciones = await db.reparaciones.find({}).to_list(5000)
    total_facturado = sum(r.get("precio_total", 0) for r in reparaciones if r.get("estado") == "entregada")
    total_cobrado = sum(r.get("total_pagado", 0) for r in reparaciones)
    total_pendiente = sum(r.get("saldo_pendiente", 0) for r in reparaciones if r.get("estado") not in ["entregada", "cancelada"])
    total_canceladas = await db.reparaciones.count_documents({"estado": "cancelada"})

    return {
        "total": total,
        "por_estado": por_estado,
        "total_facturado": total_facturado,
        "total_cobrado": total_cobrado,
        "total_pendiente": total_pendiente,
        "total_canceladas": total_canceladas,
    }

def _faltantes(productos):
    """Filas (producto, variante, sucursal) que llegaron al mínimo de esa sucursal o están por debajo."""
    filas = []
    for p in productos:
        unidades = p.get("variantes", []) if p.get("tiene_variantes") else [p]
        for u in unidades:
            for suc in SUCURSALES:
                actual, minimo = stock_en(u, suc), minimo_en(u, suc)
                if bajo_minimo(actual, minimo):
                    filas.append({
                        "nombre": p["nombre"],
                        "variante": u["nombre"] if p.get("tiene_variantes") else None,
                        "sucursal": suc,
                        "stock_actual": actual,
                        "stock_minimo": minimo,
                    })
    return filas


@router.get("/stock-bajo")
async def get_stock_bajo(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    productos = await db.productos.find({"activo": True}).to_list(1000)
    return _faltantes(productos)
