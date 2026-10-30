from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from app.utils.marcas import registrar_marca_modelo, _igual

router = APIRouter()


class Nombre(BaseModel):
    nombre: str


class MarcaUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None


def _formato(m):
    return {"id": str(m["_id"]), "nombre": m["nombre"],
            "modelos": sorted(m.get("modelos", []), key=str.lower), "activo": m.get("activo", True)}


async def _marca(db, marca_id):
    if not ObjectId.is_valid(marca_id):
        raise HTTPException(status_code=404, detail="Marca no encontrada")
    m = await db.marcas.find_one({"_id": ObjectId(marca_id)})
    if not m:
        raise HTTPException(status_code=404, detail="Marca no encontrada")
    return m


@router.get("/")
async def listar(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:read")
    db = get_db()
    return [_formato(m) for m in await db.marcas.find().sort("nombre", 1).to_list(500)]


@router.post("/")
async def crear(datos: Nombre, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:create")
    db = get_db()
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Escribí el nombre de la marca")
    if await db.marcas.find_one({"nombre": _igual(nombre)}):
        raise HTTPException(status_code=400, detail=f"La marca «{nombre}» ya existe")
    mid = await registrar_marca_modelo(db, nombre)
    return _formato(await db.marcas.find_one({"_id": mid}))


@router.post("/{marca_id}/modelos")
async def agregar_modelo(marca_id: str, datos: Nombre, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "reparaciones:create")
    db = get_db()
    m = await _marca(db, marca_id)
    modelo = datos.nombre.strip()
    if not modelo:
        raise HTTPException(status_code=400, detail="Escribí el nombre del modelo")
    if any(x.lower() == modelo.lower() for x in m.get("modelos", [])):
        raise HTTPException(status_code=400, detail=f"El modelo «{modelo}» ya existe en {m['nombre']}")
    await db.marcas.update_one({"_id": m["_id"]}, {"$push": {"modelos": modelo}})
    return _formato(await db.marcas.find_one({"_id": m["_id"]}))


@router.delete("/{marca_id}/modelos/{modelo}")
async def quitar_modelo(marca_id: str, modelo: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    m = await _marca(db, marca_id)
    await db.marcas.update_one({"_id": m["_id"]}, {"$pull": {"modelos": modelo}})
    return _formato(await db.marcas.find_one({"_id": m["_id"]}))


@router.put("/{marca_id}")
async def modificar(marca_id: str, datos: MarcaUpdate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    m = await _marca(db, marca_id)
    cambios = datos.model_dump(exclude_none=True)
    if "nombre" in cambios:
        cambios["nombre"] = cambios["nombre"].strip()
        if await db.marcas.find_one({"nombre": _igual(cambios["nombre"]), "_id": {"$ne": m["_id"]}}):
            raise HTTPException(status_code=400, detail=f"La marca «{cambios['nombre']}» ya existe")
    if cambios:
        await db.marcas.update_one({"_id": m["_id"]}, {"$set": cambios})
    return _formato(await db.marcas.find_one({"_id": m["_id"]}))
