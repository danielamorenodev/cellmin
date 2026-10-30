from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.repair import RepairCreate, RepairUpdate, Pago
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from bson import ObjectId
from datetime import datetime, timedelta
from app.utils.logger import registrar_auditoria
from app.utils.cajas import caja_propia, puede_sucursal
from app.utils.stock import validar_sucursal
from app.utils.tarjetas import datos_tarjeta, texto_tarjeta
from app.utils.pagos import (
    METODOS_VALIDOS,
    USD,
    cotizacion_para_cobro,
    movimiento_vuelto,
    redondear,
)

router = APIRouter()

async def get_next_number(db) -> str:
    counter = await db.contadores.find_one_and_update(
        {"_id": "reparaciones"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"OR-{str(counter['seq']).zfill(4)}"

def format_repair(r, user=None):
    r["id"] = str(r["_id"])
    del r["_id"]
    if user is not None:
        ocultar_bloqueo(r, user)
    return r


# El código de desbloqueo del equipo es un dato sensible (Ley 25.326):
# solo lo ven el técnico y el administrador, y se borra al entregar el equipo.
ROLES_VEN_BLOQUEO = ("tecnico", "administrador")


def ocultar_bloqueo(r, user):
    equipo = r.get("equipo") or {}
    if equipo.get("bloqueo_valor") and user.get("role") not in ROLES_VEN_BLOQUEO:
        equipo["bloqueo_valor"] = None
        equipo["bloqueo_oculto"] = True
    return r


# Orden de los estados de una reparación: se avanza o se retrocede de a un paso
FLUJO_ESTADOS = ["en_diagnostico", "ingresada", "en_reparacion", "lista", "entregada"]
NOMBRE_ESTADO = {
    "en_diagnostico": "En diagnóstico", "ingresada": "Ingresada", "en_reparacion": "En reparación",
    "lista": "Lista para entregar", "entregada": "Entregada", "cancelada": "Cancelada",
}


def validar_cambio_estado(actual: str, nuevo: str):
    if actual in ("entregada", "cancelada"):
        raise HTTPException(status_code=400, detail=f"La orden ya está {NOMBRE_ESTADO[actual].lower()} y no puede cambiar de estado.")
    if nuevo not in FLUJO_ESTADOS:
        raise HTTPException(status_code=400, detail="Estado inválido")
    if abs(FLUJO_ESTADOS.index(nuevo) - FLUJO_ESTADOS.index(actual)) != 1:
        siguiente = FLUJO_ESTADOS[FLUJO_ESTADOS.index(actual) + 1]
        raise HTTPException(
            status_code=400,
            detail=f"No se pueden saltear estados: de «{NOMBRE_ESTADO[actual]}» se pasa a «{NOMBRE_ESTADO[siguiente]}».",
        )



async def planear_cobro(db, metodo: str, monto: float, saldo: float, tarjeta_id=None, cuotas=None) -> dict:
    """Cómo se registra un cobro (seña o saldo) de una reparación.
    En medios comunes el monto es en pesos. Con "usd" el monto es en dólares:
    se convierte con la cotización del servidor, lo que supere el saldo se
    devuelve como vuelto en pesos."""
    if metodo != USD:
        if monto > saldo + 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"El monto supera el saldo pendiente ($ {saldo:,.2f})".replace(",", "X").replace(".", ",").replace("X", "."),
            )
        # Con tarjeta: el recargo de las cuotas se cobra aparte del saldo
        tarjeta = await datos_tarjeta(db, metodo, tarjeta_id, cuotas, monto)
        return {
            "monto": monto,
            "monto_caja": redondear(monto + tarjeta.get("recargo", 0)),
            "vuelto": 0.0,
            "extra": tarjeta,
        }
    cotizacion = await cotizacion_para_cobro(db)
    usd = redondear(monto)
    pesos = redondear(usd * cotizacion)
    cubierto = min(pesos, saldo)
    vuelto = redondear(pesos - cubierto) if pesos > saldo + 0.01 else 0.0
    return {
        "monto": redondear(cubierto),
        "monto_caja": pesos,
        "vuelto": vuelto,
        "extra": {"usd": usd, "cotizacion": cotizacion, "vuelto": vuelto},
    }


def movimientos_de_cobro(plan: dict, metodo: str, numero: str, repair_id: str, nota: str, usuario_id: str) -> list:
    """Movimientos de caja de un cobro: el ingreso y, si hubo, el vuelto."""
    ingreso = {
        "tipo": "ingreso",
        "monto": plan["monto_caja"],
        "motivo": f"Reparación {numero} — {metodo}" + (f" ({texto_tarjeta({**plan['extra'], 'metodo': metodo})})" if plan["extra"].get("tarjeta") else ""),
        "metodo_pago": metodo,
        "concepto": "reparacion",
        "referencia_id": repair_id,
        "notas": nota,
        "usuario_id": usuario_id,
        "fecha": datetime.utcnow(),
    }
    if plan["extra"].get("tarjeta"):
        ingreso.update({k: plan["extra"][k] for k in ("tarjeta", "cuotas", "recargo")})
    if metodo == USD:
        ingreso["monto_usd"] = plan["extra"]["usd"]
        ingreso["cotizacion"] = plan["extra"]["cotizacion"]
    movimientos = [ingreso]
    if plan["vuelto"] > 0:
        movimientos.append(movimiento_vuelto(plan["vuelto"], f"reparación {numero}", repair_id, usuario_id))
    return movimientos


def validar_bloqueo(equipo: dict) -> dict:
    """Normaliza y valida el bloqueo de pantalla del equipo."""
    tipo = equipo.get("bloqueo_tipo") or "ninguno"
    valor = (equipo.get("bloqueo_valor") or "").strip()

    if tipo == "ninguno":
        valor = None
    elif tipo == "patron":
        puntos = valor.split("-") if valor else []
        if (
            len(puntos) < 4
            or any(p not in "123456789" or len(p) != 1 for p in puntos)
            or len(set(puntos)) != len(puntos)
        ):
            raise HTTPException(
                status_code=400,
                detail="El patrón debe unir al menos 4 puntos distintos",
            )
    elif tipo == "pin":
        if not valor.isdigit() or not (4 <= len(valor) <= 16):
            raise HTTPException(status_code=400, detail="El PIN debe tener entre 4 y 16 números")
    elif tipo == "password":
        if not valor or len(valor) > 64:
            raise HTTPException(status_code=400, detail="Ingresá la contraseña del equipo (máximo 64 caracteres)")
    else:
        raise HTTPException(status_code=400, detail="Tipo de bloqueo inválido")

    equipo["bloqueo_tipo"] = tipo
    equipo["bloqueo_valor"] = valor
    return equipo


async def caja_abierta_del_usuario(db, current_user):
    """La caja que abrió el usuario: solo en ella puede registrar cobros."""
    return await caja_propia(db, current_user)


@router.get("/")
async def get_repairs(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:read")
    db = get_db()
    repairs = await db.reparaciones.find().sort("fecha_ingreso", -1).to_list(500)
    return [format_repair(r, current_user) for r in repairs]

@router.get("/pendientes")
async def get_pending_repairs(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:read")
    db = get_db()
    repairs = await db.reparaciones.find({
        "estado": {"$in": ["en_diagnostico", "ingresada", "en_reparacion", "lista"]}
    }).sort("fecha_ingreso", -1).to_list(500)
    return [format_repair(r, current_user) for r in repairs]

@router.get("/{repair_id}")
async def get_repair(repair_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:read")
    db = get_db()
    if not ObjectId.is_valid(repair_id):
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    repair = await db.reparaciones.find_one({"_id": ObjectId(repair_id)})
    if not repair:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    return format_repair(repair, current_user)

@router.post("/")
async def create_repair(repair: RepairCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:create")
    db = get_db()

    data = repair.dict()
    sena = data.pop("sena", None)
    data["equipo"] = validar_bloqueo(data["equipo"])
    # La orden queda en la sucursal de la caja del usuario (si tiene una abierta)
    mi_caja = await caja_propia(db, current_user)
    if mi_caja:
        data["sucursal"] = mi_caja["sucursal"]
    else:
        validar_sucursal(data["sucursal"])
        if not puede_sucursal(current_user, data["sucursal"]):
            raise HTTPException(status_code=403, detail="No tenés acceso a esa sucursal")
    precio_total = sum(t["precio"] for t in data["tipos_reparacion"])

    # Validar la seña ANTES de crear nada
    caja = None
    if sena:
        check_permission(current_user["role"], "reparaciones:pago")
        if precio_total <= 0:
            raise HTTPException(
                status_code=400,
                detail="No se puede cobrar una seña mientras la orden está en diagnóstico. Definí las reparaciones primero.",
            )
        if sena["metodo"] not in METODOS_VALIDOS:
            raise HTTPException(status_code=400, detail="Medio de pago inválido")
        if sena["monto"] <= 0:
            raise HTTPException(status_code=400, detail="La seña debe ser mayor a 0")
        if sena["metodo"] != USD and sena["monto"] > precio_total:
            raise HTTPException(status_code=400, detail="La seña no puede superar el total de la reparación")
        caja = await caja_abierta_del_usuario(db, current_user)
        if not caja:
            raise HTTPException(status_code=400, detail="Debe haber una caja abierta para cobrar la seña")
        plan_sena = await planear_cobro(db, sena["metodo"], sena["monto"], precio_total,
                                        sena.get("tarjeta_id"), sena.get("cuotas"))

    numero = await get_next_number(db)
    pagos = []
    total_pagado = 0
    if sena:
        total_pagado = plan_sena["monto"]
        pagos.append({
            "monto": plan_sena["monto"],
            "tipo": "total" if plan_sena["monto"] >= precio_total else "seña",
            "metodo": sena["metodo"],
            **plan_sena["extra"],
            "usuario_id": current_user["user_id"],
            "fecha": datetime.utcnow(),
        })

    new_repair = {
        **data,
        "numero_orden": numero,
        "precio_total": precio_total,
        "pagos": pagos,
        "total_pagado": total_pagado,
        "saldo_pendiente": precio_total - total_pagado,
        "tecnico_id": None,
        "usuario_id": current_user["user_id"],
        "fecha_ingreso": datetime.utcnow(),
        "fecha_entrega": None,
        "fecha_vencimiento_garantia": None
    }
    result = await db.reparaciones.insert_one(new_repair)
    new_repair["_id"] = result.inserted_id

    if sena:
        await db.cajas.update_one(
            {"_id": caja["_id"]},
            {"$push": {"movimientos": {"$each": movimientos_de_cobro(
                plan_sena, sena["metodo"], numero, str(result.inserted_id),
                f"Seña de reparación {numero}", current_user["user_id"],
            )}}},
        )

    await registrar_auditoria(
        db=db,
        usuario_id=current_user["user_id"],
        usuario_nombre="",
        rol=current_user["role"],
        accion="crear",
        modulo="reparaciones",
        descripcion=f"Orden de reparación creada: {numero}"
    )

    return format_repair(new_repair)

@router.put("/{repair_id}")
async def update_repair(repair_id: str, repair: RepairUpdate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:update_estado")
    db = get_db()
    update_data = {k: v for k, v in repair.dict().items() if v is not None}

    if not ObjectId.is_valid(repair_id):
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    repair_doc = await db.reparaciones.find_one({"_id": ObjectId(repair_id)})
    if not repair_doc:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    if repair_doc.get("estado") in ("entregada", "cancelada"):
        raise HTTPException(status_code=400, detail=f"La orden ya está {NOMBRE_ESTADO[repair_doc['estado']].lower()} y no se puede modificar.")

    total_pagado = repair_doc.get("total_pagado", 0)
    precio_total = repair_doc.get("precio_total", 0)

    # Si se actualizan los tipos recalcular precio
    if "tipos_reparacion" in update_data:
        precio_total = sum(t["precio"] for t in update_data["tipos_reparacion"])
        if precio_total < total_pagado - 0.01:
            raise HTTPException(status_code=400, detail="El nuevo presupuesto no puede ser menor a lo que el cliente ya pagó.")
        update_data["precio_total"] = precio_total
        update_data["saldo_pendiente"] = precio_total - total_pagado

    nuevo_estado = update_data.get("estado")
    if nuevo_estado and nuevo_estado != repair_doc.get("estado"):
        validar_cambio_estado(repair_doc.get("estado", "en_diagnostico"), nuevo_estado)

        # Para pasar a ingresada hacen falta tipos de reparación (presupuesto)
        if nuevo_estado == "ingresada" and not (update_data.get("tipos_reparacion") or repair_doc.get("tipos_reparacion")):
            raise HTTPException(status_code=400, detail="Debe seleccionar al menos un tipo de reparación antes de cambiar el estado")

        # Para entregar: permiso, cobro total, garantía y borrado del código de desbloqueo
        if nuevo_estado == "entregada":
            check_permission(current_user["role"], "reparaciones:entregar")
            saldo = precio_total - total_pagado
            if saldo > 0.01:
                monto = f"{saldo:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                raise HTTPException(status_code=400, detail=f"No se puede entregar el equipo con saldo pendiente ($ {monto}). Registrá el cobro primero.")
            now = datetime.utcnow()
            update_data["fecha_entrega"] = now
            garantia_dias = update_data.get("garantia_dias", repair_doc.get("garantia_dias", 90))
            update_data["fecha_vencimiento_garantia"] = now + timedelta(days=garantia_dias)
            if (repair_doc.get("equipo") or {}).get("bloqueo_valor"):
                update_data["equipo.bloqueo_valor"] = None
                update_data["equipo.bloqueo_eliminado"] = True
    elif "estado" in update_data:
        del update_data["estado"]

    await db.reparaciones.update_one({"_id": ObjectId(repair_id)}, {"$set": update_data})
    updated = await db.reparaciones.find_one({"_id": ObjectId(repair_id)})

    await registrar_auditoria(
    db=db,
    usuario_id=current_user["user_id"],
    usuario_nombre="",
    rol=current_user["role"],
    accion="actualizar",
    modulo="reparaciones",
    descripcion=f"Reparación actualizada: {repair_id}"
    )

    return format_repair(updated, current_user)

@router.post("/{repair_id}/pago")
async def add_payment(repair_id: str, pago: Pago, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:pago")
    db = get_db()

    # Verificar caja abierta
    caja = await caja_propia(db, current_user)
    if not caja:
        raise HTTPException(status_code=400, detail="Para registrar el cobro necesitás tener tu caja abierta")

    if not ObjectId.is_valid(repair_id):
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    repair = await db.reparaciones.find_one({"_id": ObjectId(repair_id)})
    if not repair:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    if repair.get("estado") == "cancelada":
        raise HTTPException(status_code=400, detail="La orden está cancelada")
    if pago.metodo not in METODOS_VALIDOS:
        raise HTTPException(status_code=400, detail="Medio de pago inválido")
    if pago.monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    saldo_actual = repair.get("precio_total", 0) - repair.get("total_pagado", 0)
    plan = await planear_cobro(db, pago.metodo, pago.monto, saldo_actual, pago.tarjeta_id, pago.cuotas)

    nuevo_pago = {
        "monto": plan["monto"],
        "tipo": pago.tipo,
        "metodo": pago.metodo,
        **plan["extra"],
        "usuario_id": current_user["user_id"],
        "fecha": datetime.utcnow()
    }
    total_pagado = repair.get("total_pagado", 0) + plan["monto"]
    saldo = repair.get("precio_total", 0) - total_pagado

    await db.reparaciones.update_one(
        {"_id": ObjectId(repair_id)},
        {
            "$push": {"pagos": nuevo_pago},
            "$set": {
                "total_pagado": total_pagado,
                "saldo_pendiente": saldo
            }
        }
    )

    # Registrar en caja (ingreso y, si hubo vuelto en pesos, su egreso)
    await db.cajas.update_one(
        {"_id": caja["_id"]},
        {"$push": {"movimientos": {"$each": movimientos_de_cobro(
            plan, pago.metodo, repair.get("numero_orden", ""), repair_id,
            f"Cobro de reparación {repair.get('numero_orden', '')}", current_user["user_id"],
        )}}},
    )

    return {"message": "Pago registrado", "total_pagado": total_pagado, "saldo_pendiente": saldo, "vuelto": plan["vuelto"]}

@router.get("/cliente/{cliente_id}")
async def get_repairs_by_client(cliente_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:read")
    db = get_db()
    repairs = await db.reparaciones.find(
        {"cliente_id": cliente_id}
    ).sort("fecha_ingreso", -1).to_list(100)
    return [format_repair(r, current_user) for r in repairs]

@router.put("/{repair_id}/cancelar")
async def cancel_repair(repair_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:update_estado")
    db = get_db()
    if not ObjectId.is_valid(repair_id):
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    repair = await db.reparaciones.find_one({"_id": ObjectId(repair_id)})
    if not repair:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")
    if repair["estado"] == "entregada":
        raise HTTPException(status_code=400, detail="No se puede cancelar una reparación ya entregada")
    if repair["estado"] == "cancelada":
        raise HTTPException(status_code=400, detail="La orden ya está cancelada")

    # Si hay pagos cobrados se devuelven: egreso de caja por cada pago, con su mismo medio de pago
    pagos = repair.get("pagos", [])
    total_devuelto = 0
    if pagos:
        caja = await caja_abierta_del_usuario(db, current_user)
        if not caja:
            raise HTTPException(
                status_code=400,
                detail="Esta orden tiene pagos cobrados. Para cancelarla hace falta una caja abierta, donde se registra la devolución.",
            )
        egresos = []
        for p in pagos:
            # Se devuelve por el mismo medio con el que se cobró. Lo cobrado en
            # dólares se descuenta del esperado en dólares; si hubo vuelto en
            # pesos, se revierte.
            # Con tarjeta se devuelve también el recargo de las cuotas
            monto_egreso = redondear(p["monto"] + (p.get("recargo") or 0))
            if p["metodo"] == USD and p.get("usd") is not None:
                monto_egreso = redondear(p["usd"] * p["cotizacion"])
            egreso = {
                "tipo": "egreso",
                "monto": monto_egreso,
                "motivo": f"Devolución orden {repair.get('numero_orden', '')} — {p['metodo']}",
                "metodo_pago": p["metodo"],
                "concepto": "devolucion_reparacion",
                "referencia_id": repair_id,
                "notas": f"Cancelación de la orden {repair.get('numero_orden', '')}",
                "usuario_id": current_user["user_id"],
                "fecha": datetime.utcnow(),
            }
            if p["metodo"] == USD and p.get("usd") is not None:
                egreso["monto_usd"] = p["usd"]
            egresos.append(egreso)
            if p.get("vuelto", 0) > 0:
                egresos.append({
                    "tipo": "ingreso",
                    "monto": p["vuelto"],
                    "motivo": f"Devolución orden {repair.get('numero_orden', '')} — vuelto devuelto",
                    "metodo_pago": "efectivo",
                    "concepto": "devolucion_reparacion",
                    "referencia_id": repair_id,
                    "notas": f"Se revierte el vuelto en pesos de la orden {repair.get('numero_orden', '')}",
                    "usuario_id": current_user["user_id"],
                    "fecha": datetime.utcnow(),
                })
            total_devuelto += p["monto"]
        await db.cajas.update_one({"_id": caja["_id"]}, {"$push": {"movimientos": {"$each": egresos}}})

    await db.reparaciones.update_one(
        {"_id": ObjectId(repair_id)},
        {"$set": {
            "estado": "cancelada",
            "saldo_pendiente": 0,
            "total_devuelto": total_devuelto,
            "fecha_cancelacion": datetime.utcnow(),
        }}
    )
    return {"message": "Reparación cancelada", "total_devuelto": total_devuelto}
