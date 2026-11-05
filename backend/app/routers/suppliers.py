import re
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.supplier import SupplierCreate, SupplierUpdate, MovimientoCuenta
from app.utils.cuenta_proveedor import (
    registrar_movimiento, anular_movimiento, formato_movimiento, redondear,
)
from app.utils.logger import registrar_auditoria
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from bson import ObjectId
from datetime import datetime

router = APIRouter()


def _oid(supplier_id: str) -> ObjectId:
    if not ObjectId.is_valid(supplier_id):
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return ObjectId(supplier_id)

def format_supplier(s):
    return {
        "id": str(s["_id"]),
        "nombre": s["nombre"],
        "cuit": s.get("cuit"),
        "telefono": s.get("telefono"),
        "email": s.get("email"),
        "direccion": s.get("direccion"),
        "contacto": s.get("contacto"),
        # Lo que se le debe al proveedor (negativo: saldo a favor)
        "saldo_deuda": redondear(s.get("saldo_deuda", 0)),
        "activo": s.get("activo", True),
        "fecha_creacion": s.get("fecha_creacion")
    }

@router.get("/")
async def get_suppliers(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user["role"] in ["administrador", "deposito"]:
        suppliers = await db.proveedores.find().to_list(200)
    else:
        suppliers = await db.proveedores.find({"activo": True}).to_list(200)
    return [format_supplier(s) for s in suppliers]

@router.get("/{supplier_id}")
async def get_supplier(supplier_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    supplier = await db.proveedores.find_one({"_id": _oid(supplier_id)})
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return format_supplier(supplier)

@router.post("/")
async def create_supplier(supplier: SupplierCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "proveedores:create")
    db = get_db()
    existing = await db.proveedores.find_one({
        "nombre": {"$regex": f"^{re.escape(supplier.nombre.strip())}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un proveedor con el nombre '{supplier.nombre}'")
    new_supplier = {
        **supplier.model_dump(),
        "saldo_deuda": 0.0,
        "activo": True,
        "fecha_creacion": datetime.utcnow()
    }
    result = await db.proveedores.insert_one(new_supplier)
    new_supplier["_id"] = result.inserted_id
    return format_supplier(new_supplier)

@router.put("/{supplier_id}")
async def update_supplier(supplier_id: str, supplier: SupplierUpdate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "proveedores:update")
    db = get_db()
    _id = _oid(supplier_id)
    if not await db.proveedores.find_one({"_id": _id}):
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if supplier.nombre:
        existing = await db.proveedores.find_one({
            "nombre": {"$regex": f"^{re.escape(supplier.nombre.strip())}$", "$options": "i"},
            "_id": {"$ne": ObjectId(supplier_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Ya existe un proveedor con el nombre '{supplier.nombre}'")
    # Solo lo enviado; un dato opcional enviado vacío se borra
    update_data = supplier.model_dump(exclude_unset=True)
    for obligatorio in ("nombre", "activo"):
        if update_data.get(obligatorio) is None:
            update_data.pop(obligatorio, None)
    if update_data:
        await db.proveedores.update_one({"_id": _id}, {"$set": update_data})
    updated = await db.proveedores.find_one({"_id": _id})
    return format_supplier(updated)

@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    proveedor = await db.proveedores.find_one({"_id": _oid(supplier_id)})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    nuevo_estado = not proveedor.get("activo", True)
    await db.proveedores.update_one({"_id": proveedor["_id"]}, {"$set": {"activo": nuevo_estado}})
    return {"message": f"Proveedor {'activado' if nuevo_estado else 'desactivado'} correctamente"}


# ── Cuenta corriente: cuánto se le debe al proveedor ─────────────────────

@router.get("/{supplier_id}/cuenta")
async def get_cuenta(supplier_id: str, current_user: dict = Depends(get_current_user)):
    """Saldo adeudado y movimientos (deudas y pagos), del más nuevo al más viejo."""
    check_permission(current_user["role"], "proveedores:read")
    db = get_db()
    proveedor = await db.proveedores.find_one({"_id": _oid(supplier_id)})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    movs = await db.proveedor_movimientos.find({"proveedor_id": supplier_id}).sort("fecha", -1).to_list(1000)
    return {
        "proveedor": format_supplier(proveedor),
        "saldo_deuda": redondear(proveedor.get("saldo_deuda", 0)),
        "movimientos": [formato_movimiento(m) for m in movs],
    }


@router.post("/{supplier_id}/cuenta")
async def agregar_movimiento(supplier_id: str, datos: MovimientoCuenta, current_user: dict = Depends(get_current_user)):
    """Registra una deuda (se le debe) o un pago al proveedor."""
    check_permission(current_user["role"], "proveedores:update")
    db = get_db()
    proveedor = await db.proveedores.find_one({"_id": _oid(supplier_id)})
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if datos.tipo == "deuda" and not (datos.concepto or "").strip():
        raise HTTPException(status_code=400, detail="Indicá el concepto de la deuda (por ejemplo, la factura)")
    mov = await registrar_movimiento(db, supplier_id, datos.tipo, datos.monto, current_user,
                                     concepto=datos.concepto, metodo=datos.metodo)
    actualizado = await db.proveedores.find_one({"_id": proveedor["_id"]})
    await registrar_auditoria(
        db=db, usuario_id=current_user["user_id"], usuario_nombre="", rol=current_user["role"],
        accion="deuda_proveedor" if datos.tipo == "deuda" else "pago_proveedor", modulo="proveedores",
        descripcion=(f"{'Deuda' if datos.tipo == 'deuda' else 'Pago'} {proveedor['nombre']}: $ {mov['monto']:,.2f}"
                     + (f" — {mov['concepto']}" if mov.get("concepto") else "")),
    )
    return {"movimiento": formato_movimiento(mov), "saldo_deuda": redondear(actualizado.get("saldo_deuda", 0))}


@router.delete("/{supplier_id}/cuenta/{mov_id}")
async def anular(supplier_id: str, mov_id: str, current_user: dict = Depends(get_current_user)):
    """Anula un movimiento cargado por error (solo el administrador)."""
    check_permission(current_user["role"], "*")
    db = get_db()
    if not ObjectId.is_valid(mov_id):
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    mov = await db.proveedor_movimientos.find_one({"_id": ObjectId(mov_id), "proveedor_id": supplier_id})
    if not mov:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    if mov.get("compra_id"):
        raise HTTPException(status_code=400, detail="Esta deuda viene de un ingreso de mercadería: se anula cancelando la compra.")
    if not await anular_movimiento(db, mov):
        raise HTTPException(status_code=400, detail="El movimiento ya está anulado")
    proveedor = await db.proveedores.find_one({"_id": _oid(supplier_id)})
    await registrar_auditoria(
        db=db, usuario_id=current_user["user_id"], usuario_nombre="", rol=current_user["role"],
        accion="anular", modulo="proveedores",
        descripcion=f"Anulado {mov['tipo']} de $ {mov['monto']:,.2f} de {(proveedor or {}).get('nombre', '')}",
    )
    return {"message": "Movimiento anulado", "saldo_deuda": redondear((proveedor or {}).get("saldo_deuda", 0))}
