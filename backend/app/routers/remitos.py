"""Remitos internos: envío de mercadería entre sucursales.
Se descuenta de la sucursal de origen y se suma en la de destino en el
mismo momento, y queda un comprobante numerado (R-0001)."""
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.remito import RemitoCreate
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from app.utils.stock import validar_sucursal, descontar_varios, aplicar_delta, NOMBRES
from app.utils.idempotencia import reclamar_clave, guardar_resultado, liberar_clave
from app.utils.logger import registrar_auditoria

router = APIRouter()


def _formato(r: dict) -> dict:
    return {**r, "_id": str(r["_id"]), "id": str(r["_id"])}


@router.get("/")
async def listar(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "stock:read")
    db = get_db()
    return [_formato(r) for r in await db.remitos.find().sort("fecha", -1).to_list(500)]


@router.get("/{remito_id}")
async def obtener(remito_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "stock:read")
    db = get_db()
    if not ObjectId.is_valid(remito_id):
        raise HTTPException(status_code=404, detail="Remito no encontrado")
    r = await db.remitos.find_one({"_id": ObjectId(remito_id)})
    if not r:
        raise HTTPException(status_code=404, detail="Remito no encontrado")
    return _formato(r)


@router.post("/")
async def crear(datos: RemitoCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "stock:create")
    db = get_db()
    validar_sucursal(datos.origen)
    validar_sucursal(datos.destino)
    if datos.origen == datos.destino:
        raise HTTPException(status_code=400, detail="La sucursal de origen y la de destino tienen que ser distintas")
    if not datos.items:
        raise HTTPException(status_code=400, detail="Agregá al menos un producto al remito")

    # Juntar líneas repetidas del mismo artículo y validar cada producto
    pedidos = {}
    for it in datos.items:
        clave = (it.producto_id, it.variante_nombre or None)
        pedidos[clave] = pedidos.get(clave, 0) + it.cantidad
    items = []
    for (pid, variante), cantidad in pedidos.items():
        if not ObjectId.is_valid(pid):
            raise HTTPException(status_code=400, detail="Producto inválido")
        p = await db.productos.find_one({"_id": ObjectId(pid)})
        if not p:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        if p.get("tiene_variantes") and not variante:
            raise HTTPException(status_code=400, detail=f"Elegí la variante de «{p['nombre']}»")
        if variante and not any(v.get("nombre") == variante for v in p.get("variantes", [])):
            raise HTTPException(status_code=400, detail=f"«{p['nombre']}» no tiene la variante «{variante}»")
        items.append({
            "producto_id": pid,
            "variante_nombre": variante,
            "nombre_producto": p["nombre"] + (f" — {variante}" if variante else ""),
            "cantidad": cantidad,
        })

    previa = await reclamar_clave(db, datos.clave_idempotencia, "remito")
    if previa:
        return previa["resultado"]
    try:
        # Todo o nada: si a algún artículo no le alcanza el stock en origen, no se mueve nada
        faltante = await descontar_varios(
            db, [(i["producto_id"], i["variante_nombre"], i["cantidad"]) for i in items], datos.origen
        )
        if faltante:
            nombre = next(i["nombre_producto"] for i in items
                          if i["producto_id"] == faltante[0] and i["variante_nombre"] == faltante[1])
            raise HTTPException(
                status_code=409,
                detail=f"No alcanza el stock de «{nombre}» en {NOMBRES[datos.origen]} para enviar {faltante[2]}.",
            )
        for i in items:
            await aplicar_delta(db, i["producto_id"], i["variante_nombre"], datos.destino, i["cantidad"])

        contador = await db.contadores.find_one_and_update(
            {"_id": "remitos"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
        )
        numero = f"R-{str(contador['seq']).zfill(4)}"
        ahora = datetime.utcnow()
        usuario = await db.usuarios.find_one({"_id": ObjectId(current_user["user_id"])}, {"nombre": 1})
        doc = {
            "numero": numero,
            "origen": datos.origen,
            "destino": datos.destino,
            "items": items,
            "notas": (datos.notas or "").strip() or None,
            "usuario_id": current_user["user_id"],
            "usuario_nombre": (usuario or {}).get("nombre", ""),
            "fecha": ahora,
        }
        res = await db.remitos.insert_one(doc)
        rid = str(res.inserted_id)
        movimientos = []
        for i in items:
            base = {"producto_id": i["producto_id"], "variante_nombre": i["variante_nombre"],
                    "cantidad": i["cantidad"], "referencia_id": rid, "notas": f"Remito {numero}",
                    "usuario_id": current_user["user_id"], "fecha": ahora}
            movimientos.append({**base, "tipo": "salida", "sucursal": datos.origen, "motivo": "remito_salida"})
            movimientos.append({**base, "tipo": "entrada", "sucursal": datos.destino, "motivo": "remito_entrada"})
        await db.stock_movimientos.insert_many(movimientos)
    except Exception:
        await liberar_clave(db, datos.clave_idempotencia, "remito")
        raise

    await registrar_auditoria(
        db=db, usuario_id=current_user["user_id"], rol=current_user["role"], accion="crear", modulo="remitos",
        descripcion=f"Remito {numero}: {NOMBRES[datos.origen]} → {NOMBRES[datos.destino]}, "
                    + ", ".join(f"{i['cantidad']} × {i['nombre_producto']}" for i in items),
    )
    respuesta = {"message": "Remito registrado", "id": rid, "numero": numero}
    await guardar_resultado(db, datos.clave_idempotencia, "remito", respuesta)
    return respuesta
