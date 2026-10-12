from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from app.utils.logger import registrar_auditoria
from bson import ObjectId
from datetime import datetime
from app.models.purchase import PurchaseCreate
from app.utils.stock import validar_sucursal, stock_en, aplicar_delta, descontar_varios


router = APIRouter()

async def get_next_number(db, collection: str, prefix: str) -> str:
    counter = await db.contadores.find_one_and_update(
        {"_id": collection},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"{prefix}{str(counter['seq']).zfill(4)}"

@router.get("/")
async def get_purchases(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "compras:read")
    db = get_db()
    purchases = await db.compras.find().sort("fecha", -1).to_list(500)
    return [{**p, "_id": str(p["_id"])} for p in purchases]

@router.get("/{purchase_id}")
async def get_purchase(purchase_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "compras:read")
    db = get_db()
    if not ObjectId.is_valid(purchase_id):
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    compra = await db.compras.find_one({"_id": ObjectId(purchase_id)})
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return {**compra, "_id": str(compra["_id"])}

@router.post("/")
async def create_purchase(purchase: PurchaseCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "compras:create")
    db = get_db()
    validar_sucursal(purchase.sucursal)
    numero = await get_next_number(db, "compras", "C-")
    new_purchase = {
        **purchase.dict(),
        "numero_compra": numero,
        "usuario_id": current_user["user_id"],
        "fecha": datetime.utcnow()
    }
    result = await db.compras.insert_one(new_purchase)
    # Actualizar stock por cada item
    for item in purchase.items:
        await db.stock_movimientos.insert_one({
            "producto_id": item.producto_id,
            "variante_nombre": item.variante_nombre,
            "tipo": "entrada",
            "cantidad": item.cantidad,
            "sucursal": purchase.sucursal,
            "motivo": "compra",
            "referencia_id": str(result.inserted_id),
            "usuario_id": current_user["user_id"],
            "fecha": datetime.utcnow()
        })
        await aplicar_delta(db, item.producto_id, item.variante_nombre, purchase.sucursal, item.cantidad)
    return {"message": "Compra registrada", "numero_compra": numero, "id": str(result.inserted_id)}

@router.put("/{purchase_id}/cancelar")
async def cancel_purchase(purchase_id: str, current_user: dict = Depends(get_current_user)):
    # Cancelar una compra revierte stock: administrador y depósito
    check_permission(current_user["role"], "compras:cancel")
    db = get_db()

    compra = await db.compras.find_one({"_id": ObjectId(purchase_id)})
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    if compra.get("estado", "completada") == "cancelada":
        raise HTTPException(status_code=400, detail="La compra ya está cancelada")

    sucursal = compra.get("sucursal", "sucursal_1")

    # Primero verificamos que haya stock suficiente para revertir todos los ítems
    for item in compra.get("items", []):
        producto = await db.productos.find_one({"_id": ObjectId(item["producto_id"])})
        if not producto:
            continue
        if item.get("variante_nombre"):
            variante = next(
                (v for v in producto.get("variantes", []) if v["nombre"] == item["variante_nombre"]),
                None,
            )
            stock_actual = stock_en(variante, sucursal) if variante else 0
        else:
            stock_actual = stock_en(producto, sucursal)
        if stock_actual < item["cantidad"]:
            raise HTTPException(
                status_code=400,
                detail=f"No hay stock suficiente en la sucursal para revertir '{item['nombre_producto']}'. Stock actual: {stock_actual}, a restar: {item['cantidad']}",
            )

    # Si todo está bien, restamos el stock (atómico y todo o nada: si una venta
    # se llevó stock mientras tanto, no queda negativo) y registramos los movimientos
    faltante = await descontar_varios(
        db,
        [(i["producto_id"], i.get("variante_nombre"), i["cantidad"]) for i in compra.get("items", [])],
        sucursal,
    )
    if faltante:
        raise HTTPException(
            status_code=409,
            detail="El stock cambió mientras se cancelaba la compra y ya no alcanza para revertirla. Revisá el stock actual.",
        )
    for item in compra.get("items", []):
        await db.stock_movimientos.insert_one({
            "producto_id": item["producto_id"],
            "variante_nombre": item.get("variante_nombre"),
            "tipo": "salida",
            "cantidad": item["cantidad"],
            "sucursal": sucursal,
            "motivo": "cancelacion_compra",
            "referencia_id": purchase_id,
            "notas": f"Cancelación de compra {compra.get('numero_compra', '')}",
            "usuario_id": current_user["user_id"],
            "fecha": datetime.utcnow(),
        })

    await db.compras.update_one(
        {"_id": ObjectId(purchase_id)},
        {"$set": {"estado": "cancelada", "fecha_cancelacion": datetime.utcnow()}},
    )

    await registrar_auditoria(
        db=db,
        usuario_id=current_user["user_id"],
        usuario_nombre="",
        rol=current_user["role"],
        accion="cancelar",
        modulo="compras",
        descripcion=f"Compra cancelada: {compra.get('numero_compra', '')}",
    )

    return {"message": "Compra cancelada y stock revertido"}