from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.models.stock import StockMovement
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from bson import ObjectId
from datetime import datetime
from app.utils.stock import completar, stock_en, minimo_en, validar_sucursal, aplicar_delta, descontar_stock, bajo_minimo, SUCURSALES

router = APIRouter()

@router.get("/")
async def get_stock(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "stock:read")
    db = get_db()
    movements = await db.stock_movimientos.find().sort("fecha", -1).to_list(500)
    return [{**m, "_id": str(m["_id"])} for m in movements]

@router.get("/productos")
async def get_stock_productos(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "stock:read")
    db = get_db()
    products = await db.productos.find({"activo": True}).to_list(1000)
    result = []
    for p in products:
        p = completar(dict(p))
        variantes = [completar(dict(v)) for v in p.get("variantes", [])]
        tiene = p.get("tiene_variantes", False)
        alerta_por = {
            s: (
                any(bajo_minimo(v["stock_sucursal"][s], v["stock_minimo_sucursal"][s]) for v in variantes)
                if tiene
                else bajo_minimo(p["stock_sucursal"][s], p["stock_minimo_sucursal"][s])
            )
            for s in SUCURSALES
        }
        result.append({
            "id": str(p["_id"]),
            "nombre": p["nombre"],
            "categoria_id": p.get("categoria_id"),
            "tiene_variantes": tiene,
            "variantes": variantes,
            "stock_actual": p["stock_actual"],
            "stock_minimo": p["stock_minimo"],
            "stock_sucursal": p["stock_sucursal"],
            "stock_minimo_sucursal": p["stock_minimo_sucursal"],
            "alerta_sucursal": alerta_por,
            "alerta": any(alerta_por.values()),
        })
    return result

@router.post("/movimiento")
async def create_movement(movement: StockMovement, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "stock:create")
    db = get_db()

    # 0. La sucursal es obligatoria y el usuario tiene que tener acceso a ella
    validar_sucursal(movement.sucursal)
    if current_user["role"] != "administrador" and movement.sucursal not in current_user.get("sucursales", []):
        raise HTTPException(status_code=403, detail="No tenés acceso a esa sucursal")

    # 1. Validar el tipo y la cantidad (el ajuste sí puede ser 0)
    if movement.tipo not in ("entrada", "salida", "ajuste"):
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido")
    if movement.tipo == "ajuste":
        if movement.cantidad < 0:
            raise HTTPException(status_code=400, detail="El stock no puede ser negativo")
    elif movement.cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")

    # 2. Buscar el producto y su stock actual
    producto = await db.productos.find_one({"_id": ObjectId(movement.producto_id)})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if movement.variante_nombre:
        variante = next(
            (v for v in producto.get("variantes", []) if v["nombre"] == movement.variante_nombre),
            None,
        )
        if not variante:
            raise HTTPException(status_code=404, detail="Variante no encontrada")
        stock_actual = stock_en(variante, movement.sucursal)
    else:
        stock_actual = stock_en(producto, movement.sucursal)

    # 3. Calcular el stock nuevo (una salida no puede dejarlo negativo)
    if movement.tipo == "entrada":
        nuevo_stock = stock_actual + movement.cantidad
    elif movement.tipo == "salida":
        if movement.cantidad > stock_actual:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente. Disponible: {stock_actual}, a restar: {movement.cantidad}",
            )
        nuevo_stock = stock_actual - movement.cantidad
    else:  # ajuste: la cantidad es el stock final
        nuevo_stock = movement.cantidad

    # 4. Actualizar el stock de esa sucursal (y el total). Si hay que restar,
    #    el descuento es atómico y condicional: si mientras tanto una venta se
    #    llevó stock, no se deja negativo.
    delta = nuevo_stock - stock_actual
    if delta < 0:
        alcanzo = await descontar_stock(
            db, movement.producto_id, movement.variante_nombre, movement.sucursal, -delta
        )
        if not alcanzo:
            raise HTTPException(
                status_code=409,
                detail="El stock cambió mientras se registraba el movimiento. Revisá el stock actual y volvé a intentar.",
            )
    else:
        await aplicar_delta(db, movement.producto_id, movement.variante_nombre, movement.sucursal, delta)

    # 5. Recién ahora registrar el movimiento en el historial
    await db.stock_movimientos.insert_one({
        **movement.dict(),
        "usuario_id": current_user["user_id"],
        "fecha": datetime.utcnow(),
    })

    return {"message": "Movimiento registrado correctamente"}