import re
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.product import ProductCreate, ProductUpdate
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from bson import ObjectId
from datetime import datetime
from app.utils.stock import completar, mapa, SUCURSALES
from app.utils.logger import registrar_auditoria

router = APIRouter()

def _con_stock(p):
    """Producto con el stock por sucursal completo (también los datos viejos)."""
    p = completar(dict(p))
    p["variantes"] = [completar(dict(v)) for v in p.get("variantes", [])]
    return p


def _validar_mapas(item, etiqueta):
    for campo in ("stock_sucursal", "stock_minimo_sucursal"):
        for suc, valor in (item.get(campo) or {}).items():
            if suc not in SUCURSALES:
                raise HTTPException(status_code=400, detail="Sucursal inválida")
            if valor < 0:
                raise HTTPException(status_code=400, detail=f"{etiqueta}: el stock no puede ser negativo")


def format_product(p):
    p = _con_stock(p)
    return {
        "id": str(p["_id"]),
        "nombre": p["nombre"],
        "descripcion": p.get("descripcion"),
        "categoria_id": p.get("categoria_id"),
        "codigo_barras": p.get("codigo_barras"),
        "unidad_medida": p.get("unidad_medida"),
        "tiene_variantes": p.get("tiene_variantes", False),
        "pide_imei": p.get("pide_imei", False),
        "variantes": p.get("variantes", []),
        "precio_costo": p.get("precio_costo"),
        "precio_venta": p.get("precio_venta"),
        "stock_actual": p.get("stock_actual", 0),
        "stock_minimo": p.get("stock_minimo", 0),
        "stock_sucursal": p["stock_sucursal"],
        "stock_minimo_sucursal": p["stock_minimo_sucursal"],
        "activo": p.get("activo", True),
        "fecha_creacion": p.get("fecha_creacion")
    }

@router.get("/")
async def get_products(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user["role"] in ["administrador", "deposito"]:
        products = await db.productos.find().to_list(1000)
    else:
        products = await db.productos.find({"activo": True}).to_list(1000)
    return [format_product(p) for p in products]

@router.get("/{product_id}")
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    product = await db.productos.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return format_product(product)

@router.post("/")
async def create_product(product: ProductCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "productos:create")
    db = get_db()
    existing = await db.productos.find_one({"nombre": {"$regex": f"^{re.escape(product.nombre.strip())}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un producto con el nombre '{product.nombre}'")
    datos = product.dict()
    _validar_mapas(datos, "Producto")
    for v in datos["variantes"]:
        _validar_mapas(v, f"Variante '{v['nombre']}'")
    if datos["tiene_variantes"]:
        datos["stock_sucursal"] = mapa()
        datos["stock_minimo_sucursal"] = mapa()
    datos = completar(datos)
    datos["variantes"] = [completar(v) for v in datos["variantes"]]
    new_product = {
        **datos,
        "fecha_creacion": datetime.utcnow()
    }
    result = await db.productos.insert_one(new_product)
    new_product["_id"] = result.inserted_id
    return format_product(new_product)

@router.put("/{product_id}")
async def update_product(product_id: str, product: ProductUpdate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "productos:update")
    db = get_db()
    if product.nombre:
        existing = await db.productos.find_one({
            "nombre": {"$regex": f"^{re.escape(product.nombre.strip())}$", "$options": "i"},
            "_id": {"$ne": ObjectId(product_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Ya existe un producto con el nombre '{product.nombre}'")
    update_data = {k: v for k, v in product.dict().items() if v is not None}
    actual = await db.productos.find_one({"_id": ObjectId(product_id)})
    if not actual:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    actual = _con_stock(actual)

    # El stock se modifica solo con movimientos, compras y ventas. Desde acá
    # se editan los mínimos; las variantes nuevas entran con su stock inicial.
    if "stock_minimo_sucursal" in update_data:
        _validar_mapas(update_data, "Producto")
        update_data["stock_minimo_sucursal"] = mapa(update_data["stock_minimo_sucursal"])
        update_data["stock_minimo"] = sum(update_data["stock_minimo_sucursal"].values())
    elif "stock_minimo" in update_data:
        update_data.pop("stock_minimo")  # el total se calcula con los mínimos de cada sucursal
    if "variantes" in update_data:
        previas = {v["nombre"]: v for v in actual.get("variantes", [])}
        nuevas = []
        for v in update_data["variantes"]:
            _validar_mapas(v, f"Variante '{v['nombre']}'")
            previa = previas.get(v["nombre"])
            if previa:
                v["stock_sucursal"] = previa["stock_sucursal"]
                v["stock_actual"] = previa["stock_actual"]
            nuevas.append(completar(v))
        update_data["variantes"] = nuevas
    await db.productos.update_one({"_id": ObjectId(product_id)}, {"$set": update_data})
    updated = await db.productos.find_one({"_id": ObjectId(product_id)})
    await _registrar_cambios_de_precio(actual, updated, current_user)
    return format_product(updated)


def _precios(p):
    """{"" o nombre de variante: (costo, venta)} para comparar antes y después."""
    if p.get("tiene_variantes"):
        return {v["nombre"]: (v.get("precio_costo"), v.get("precio_venta")) for v in p.get("variantes", [])}
    return {"": (p.get("precio_costo"), p.get("precio_venta"))}


async def _registrar_cambios_de_precio(antes, despues, user):
    previos, nuevos = _precios(antes), _precios(despues)
    for clave, (costo, venta) in nuevos.items():
        if clave not in previos or previos[clave] == (costo, venta):
            continue
        c0, v0 = previos[clave]
        nombre = despues.get("nombre", "") + (f" ({clave})" if clave else "")
        await registrar_auditoria(
            usuario_id=user["user_id"],
            rol=user["role"],
            accion="cambio_precio",
            modulo="productos",
            descripcion=f"Cambio de precio: {nombre}. Costo {c0} -> {costo}. Venta {v0} -> {venta}",
        )

@router.delete("/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    producto = await db.productos.find_one({"_id": ObjectId(product_id)})
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    nuevo_estado = not producto.get("activo", True)
    await db.productos.update_one({"_id": ObjectId(product_id)}, {"$set": {"activo": nuevo_estado}})
    return {"message": f"Producto {'activado' if nuevo_estado else 'desactivado'} correctamente"}

@router.delete("/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    await db.productos.update_one({"_id": ObjectId(product_id)}, {"$set": {"activo": False}})
    return {"message": "Producto eliminado correctamente"}