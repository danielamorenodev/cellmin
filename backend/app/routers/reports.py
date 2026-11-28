from app.utils.stock import SUCURSALES, stock_en, minimo_en, bajo_minimo
from fastapi import APIRouter, Depends
from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from fastapi import HTTPException
from app.utils.cajas import inicio_dia_local, dia_local, rango_periodo


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
    docs = await db.clientes.find({"_id": {"$in": validos}}, {"nombre": 1, "apellido": 1, "telefono": 1}).to_list(None)
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
async def detalle_dashboard(tipo: str, filtro: str = None, current_user: dict = Depends(get_current_user)):
    """Lo que hay detrás de cada número del Inicio."""
    check_permission(current_user["role"], "dashboard:read")
    db = get_db()
    if tipo == "reparaciones":
        reps = await db.reparaciones.find({"estado": {"$in": ESTADOS_ACTIVOS}}).to_list(None)
        clientes = await _nombres_clientes(db, [r.get("cliente_id") for r in reps])
        filas = [fila_reparacion(r, clientes) for r in reps]
        # Recortes de la misma lista: listas para entregar, atrasadas o las del técnico conectado
        if filtro == "listas":
            filas = [f for f in filas if f["estado"] == "lista"]
        elif filtro == "atrasadas":
            filas = [f for f in filas if f["dias_atraso"] > 0]
        elif filtro == "mias":
            ids = {str(r["_id"]) for r in reps if r.get("tecnico_id") == current_user["user_id"]}
            filas = [f for f in filas if f["id"] in ids and f["estado"] in EN_CURSO]
        return sorted(filas, key=lambda f: (-f["dias_atraso"], -(f["dias_en_taller"] or 0)))
    if tipo == "ventas":
        check_permission(current_user["role"], "ventas:read")
        ventas = await db.ventas.find({"estado": "completada", "fecha": {"$gte": inicio_dia_local()}}).sort("fecha", -1).to_list(None)
        return [{"id": str(v["_id"]), "numero_venta": v.get("numero_venta"), "fecha": v["fecha"],
                 "sucursal": v.get("sucursal"), "vendedor": v.get("vendedor_nombre"),
                 "metodo_pago": v.get("metodo_pago"), "total": v.get("total", 0),
                 "articulos": sum(i.get("cantidad", 0) for i in v.get("items", []))} for v in ventas]
    if tipo == "stock":
        check_permission(current_user["role"], "stock:read")
        productos = await db.productos.find({"activo": True}).to_list(None)
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
    reps = await db.reparaciones.find(filtro).sort("fecha_ingreso", -1).to_list(None)
    clientes = await _nombres_clientes(db, [r.get("cliente_id") for r in reps])
    return [fila_reparacion(r, clientes) for r in reps]

async def devoluciones_en(db, desde, hasta=None):
    """Devoluciones hechas entre esas fechas (de ventas de cualquier fecha).
    Restan en el día en que se devolvió, no en el de la venta."""
    rango = {"$gte": desde, **({"$lte": hasta} if hasta else {})}
    resultado = []
    async for v in db.ventas.find({"devoluciones.fecha": rango}, {"devoluciones": 1, "sucursal": 1, "vendedor_nombre": 1}):
        for d in v.get("devoluciones", []):
            if d["fecha"] >= desde and (hasta is None or d["fecha"] <= hasta):
                resultado.append({**d, "sucursal": d.get("sucursal") or v.get("sucursal", "sucursal_1"),
                                  "vendedor_venta": v.get("vendedor_nombre") or "Sin registrar"})
    return resultado


@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "dashboard:read")
    db = get_db()
    hoy = inicio_dia_local()
    ventas_hoy = await db.ventas.find({
        "estado": "completada",
        "fecha": {"$gte": hoy}
    }).to_list(None)
    total_hoy = round(sum(v["total"] for v in ventas_hoy) - sum(d["monto"] for d in await devoluciones_en(db, hoy)), 2)
    activas = await db.reparaciones.find(
        {"estado": {"$in": ESTADOS_ACTIVOS}}, {"estado": 1, "fecha_estimada_entrega": 1, "tecnico_id": 1}
    ).to_list(None)
    reparaciones_activas = len(activas)
    reparaciones_atrasadas = sum(1 for r in activas if dias_atraso(r) > 0)
    reparaciones_listas = sum(1 for r in activas if r.get("estado") == "lista")
    mias = sum(1 for r in activas if r.get("tecnico_id") == current_user["user_id"] and r.get("estado") in EN_CURSO)
    semana = datetime.utcnow() - timedelta(days=7)
    ingresos_semana = await db.compras.count_documents({"fecha": {"$gte": semana}, "estado": {"$ne": "cancelada"}})
    remitos_semana = await db.remitos.count_documents({"fecha": {"$gte": semana}})
    productos_activos = await db.productos.find({"activo": True}).to_list(None)
    stock_bajo = len(_faltantes(productos_activos))
    total_clientes = await db.clientes.count_documents({"activo": True})
    return {
        "ventas_hoy": len(ventas_hoy),
        "total_ventas_hoy": total_hoy,
        "reparaciones_activas": reparaciones_activas,
        "reparaciones_atrasadas": reparaciones_atrasadas,
        "reparaciones_listas": reparaciones_listas,
        "reparaciones_mias": mias,
        "ingresos_semana": ingresos_semana,
        "remitos_semana": remitos_semana,
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
    fecha_desde, fecha_hasta = rango_periodo(periodo, desde, hasta)
    ventas = await db.ventas.find({"fecha": {"$gte": fecha_desde, "$lte": fecha_hasta}}).to_list(None)

    ventas_completadas = [v for v in ventas if v["estado"] == "completada"]
    ventas_canceladas = [v for v in ventas if v["estado"] == "cancelada"]

    devoluciones = await devoluciones_en(db, fecha_desde, fecha_hasta)
    total_devoluciones = round(sum(d["monto"] for d in devoluciones), 2)
    total = round(sum(v["total"] for v in ventas_completadas) - total_devoluciones, 2)
    total_descuentos = sum(v.get("descuento", 0) for v in ventas_completadas)

    # Los gráficos cuentan solo lo vendido (las canceladas no suman) y el día
    # es el de acá: una venta de las 22 h no cae en el día siguiente
    por_dia, por_metodo, por_sucursal, por_vendedor = {}, {}, {}, {}
    for v in ventas_completadas:
        dia = dia_local(v["fecha"])
        por_dia[dia] = por_dia.get(dia, 0) + v["total"]
        metodo = v.get("metodo_pago", "efectivo")
        if "+" in metodo:
            metodo = "mixto"
        metodo = metodo.split(" (")[0]  # "credito (Visa 3 cuotas)" -> "credito"
        por_metodo[metodo] = por_metodo.get(metodo, 0) + v["total"]
        suc = v.get("sucursal", "sucursal_1")
        por_sucursal[suc] = por_sucursal.get(suc, 0) + v["total"]
        nombre = v.get("vendedor_nombre") or "Sin registrar"
        fila = por_vendedor.setdefault(nombre, {"vendedor": nombre, "cantidad": 0, "total": 0})
        fila["cantidad"] += 1
        fila["total"] += v["total"]
    # Las devoluciones restan el día que se hicieron, por el medio con que se devolvió
    for d in devoluciones:
        dia = dia_local(d["fecha"])
        por_dia[dia] = por_dia.get(dia, 0) - d["monto"]
        por_metodo[d["metodo"]] = por_metodo.get(d["metodo"], 0) - d["monto"]
        por_sucursal[d["sucursal"]] = por_sucursal.get(d["sucursal"], 0) - d["monto"]
        # Al vendedor de la venta original: así la suma por vendedor da el total
        fila = por_vendedor.setdefault(d["vendedor_venta"], {"vendedor": d["vendedor_venta"], "cantidad": 0, "total": 0})
        fila["total"] -= d["monto"]

    return {
        "por_vendedor": sorted(por_vendedor.values(), key=lambda f: -f["total"]),
        "periodo": periodo,
        "desde": fecha_desde,
        "hasta": fecha_hasta,
        "cantidad_ventas": len(ventas_completadas),
        "cantidad_canceladas": len(ventas_canceladas),
        "cantidad_devoluciones": len(devoluciones),
        "total_devoluciones": total_devoluciones,
        "total": total,
        "total_descuentos": total_descuentos,
        "por_dia": [{"fecha": k, "total": v} for k, v in sorted(por_dia.items())],
        "por_metodo": [{"metodo": k, "total": v} for k, v in por_metodo.items()],
        "por_sucursal": [{"sucursal": k, "total": v} for k, v in por_sucursal.items()],
    }


@router.get("/productos-vendidos")
async def get_productos_vendidos(
    periodo: str = "mes",
    desde: str = None,
    hasta: str = None,
    current_user: dict = Depends(get_current_user),
):
    """Todos los productos con lo que se vendió de cada uno en el período
    (también los que no se vendieron, con 0). Solo ventas completadas."""
    check_permission(current_user["role"], "*")
    db = get_db()
    fecha_desde, fecha_hasta = rango_periodo(periodo, desde, hasta)
    pipeline = [
        {"$match": {"estado": "completada", "fecha": {"$gte": fecha_desde, "$lte": fecha_hasta}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": {"producto": "$items.producto_id", "variante": "$items.variante_nombre"},
            "nombre": {"$first": "$items.nombre_producto"},
            "cantidad": {"$sum": "$items.cantidad"},
            "total": {"$sum": "$items.subtotal"},
            "ventas": {"$addToSet": "$_id"},
        }},
    ]
    vendidos = {}
    async for g in db.ventas.aggregate(pipeline):
        pid = g["_id"]["producto"]
        fila = vendidos.setdefault(pid, {"nombre": g["nombre"], "cantidad": 0, "total": 0.0, "ventas": set(), "variantes": []})
        fila["cantidad"] += g["cantidad"]
        fila["total"] += g["total"] or 0
        fila["ventas"].update(str(v) for v in g["ventas"])
        if g["_id"].get("variante"):
            fila["variantes"].append({"nombre": g["_id"]["variante"], "cantidad": g["cantidad"]})

    # Las devoluciones del período restan unidades y monto
    for d in await devoluciones_en(db, fecha_desde, fecha_hasta):
        for i in d["items"]:
            fila = vendidos.setdefault(i["producto_id"], {"nombre": i["nombre_producto"], "cantidad": 0, "total": 0.0, "ventas": set(), "variantes": []})
            fila["cantidad"] -= i["cantidad"]
            fila["total"] -= i.get("monto", 0)
            fila.setdefault("devueltas", 0)
            fila["devueltas"] = fila.get("devueltas", 0) + i["cantidad"]
            if i.get("variante_nombre"):
                var = next((x for x in fila["variantes"] if x["nombre"] == i["variante_nombre"]), None)
                if var:
                    var["cantidad"] -= i["cantidad"]
                else:
                    fila["variantes"].append({"nombre": i["variante_nombre"], "cantidad": -i["cantidad"]})

    categorias = {str(c["_id"]): c["nombre"] async for c in db.categorias.find({}, {"nombre": 1})}
    resultado = []
    vistos = set()
    async for p in db.productos.find({}, {"nombre": 1, "categoria_id": 1, "activo": 1, "stock_actual": 1, "variantes": 1, "tiene_variantes": 1}):
        pid = str(p["_id"])
        v = vendidos.get(pid)
        # Los inactivos aparecen solo si se vendieron en el período
        if not v and not p.get("activo", True):
            continue
        vistos.add(pid)
        stock_total = (sum(x.get("stock_actual", 0) for x in p.get("variantes") or [])
                       if p.get("tiene_variantes") else p.get("stock_actual", 0))
        resultado.append({
            "id": pid,
            "nombre": p["nombre"],
            "categoria": categorias.get(p.get("categoria_id") or "", ""),
            "activo": p.get("activo", True),
            "stock": stock_total,
            "cantidad_total": v["cantidad"] if v else 0,
            "total_vendido": round(v["total"], 2) if v else 0,
            "cantidad_ventas": len(v["ventas"]) if v else 0,
            "devueltas": v.get("devueltas", 0) if v else 0,
            "variantes": sorted(v["variantes"], key=lambda x: -x["cantidad"]) if v else [],
        })
    # Vendidos que ya no existen (producto borrado): igual cuentan
    for pid, v in vendidos.items():
        if pid not in vistos:
            resultado.append({
                "id": pid, "nombre": v["nombre"], "categoria": "", "activo": False, "stock": None,
                "cantidad_total": v["cantidad"], "total_vendido": round(v["total"], 2),
                "cantidad_ventas": len(v["ventas"]), "devueltas": v.get("devueltas", 0),
                "variantes": sorted(v["variantes"], key=lambda x: -x["cantidad"]),
            })
    resultado.sort(key=lambda r: (-r["cantidad_total"], r["nombre"].lower()))
    return {
        "desde": fecha_desde.isoformat(),
        "hasta": fecha_hasta.isoformat(),
        "productos": resultado,
    }

@router.get("/rentabilidad")
async def get_rentabilidad(
    periodo: str = "mes",
    desde: str = None,
    hasta: str = None,
    current_user: dict = Depends(get_current_user)
):
    check_permission(current_user["role"], "*")
    db = get_db()
    fecha_desde, fecha_hasta = rango_periodo(periodo, desde, hasta)
    ventas = await db.ventas.find({
        "estado": "completada",
        "fecha": {"$gte": fecha_desde, "$lte": fecha_hasta}
    }).to_list(None)

    # Costo: el que tenía el producto al venderse (las ventas lo guardan desde
    # nov. 2026); para las anteriores, el costo actual del producto
    ids = {i["producto_id"] for v in ventas for i in v.get("items", []) if ObjectId.is_valid(i.get("producto_id", ""))}
    productos = {str(p["_id"]): p async for p in db.productos.find(
        {"_id": {"$in": [ObjectId(x) for x in ids]}}, {"precio_costo": 1, "variantes": 1})}

    def costo_actual(item):
        p = productos.get(item["producto_id"])
        if not p:
            return 0
        if item.get("variante_nombre"):
            var = next((x for x in p.get("variantes") or [] if x["nombre"] == item["variante_nombre"]), None)
            return (var or {}).get("precio_costo") or 0
        return p.get("precio_costo") or 0

    devoluciones = await devoluciones_en(db, fecha_desde, fecha_hasta)
    for d in devoluciones:
        for i in d["items"]:
            if ObjectId.is_valid(i.get("producto_id", "")) and i["producto_id"] not in productos:
                p = await db.productos.find_one({"_id": ObjectId(i["producto_id"])}, {"precio_costo": 1, "variantes": 1})
                if p:
                    productos[i["producto_id"]] = p
    total_ingresos = sum(v["total"] for v in ventas) - sum(d["monto"] for d in devoluciones)
    total_costo = 0
    for v in ventas:
        for item in v.get("items", []):
            costo = item.get("precio_costo")
            total_costo += (costo if costo is not None else costo_actual(item)) * item["cantidad"]
    # Lo devuelto que vuelve al stock deja de ser costo; lo que vino fallado se pierde
    for d in devoluciones:
        for item in d["items"]:
            if item.get("vuelve_stock"):
                costo = item.get("precio_costo")
                total_costo -= (costo if costo is not None else costo_actual(item)) * item["cantidad"]
    total_ingresos = round(total_ingresos, 2)
    total_costo = round(total_costo, 2)
    ganancia = round(total_ingresos - total_costo, 2)
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

    reparaciones = await db.reparaciones.find({}).to_list(None)
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
    productos = await db.productos.find({"activo": True}).to_list(None)
    return _faltantes(productos)
