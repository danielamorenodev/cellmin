from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
import re
from app.database import get_db
from app.models.tarjeta import TarjetaCreate, TarjetaUpdate
from app.utils.auth import get_current_user
from app.utils.permissions import check_permission
from app.utils.tarjetas import formato_tarjeta
from app.utils.logger import registrar_auditoria

router = APIRouter()


def _validar_planes(planes):
    vistos = set()
    for p in planes:
        if p["cuotas"] in vistos:
            raise HTTPException(status_code=400, detail=f"El plan de {p['cuotas']} cuotas está repetido")
        vistos.add(p["cuotas"])
    if 1 not in vistos:
        planes.append({"cuotas": 1, "recargo": 0})
    return sorted(planes, key=lambda p: p["cuotas"])


@router.get("/")
async def listar(current_user: dict = Depends(get_current_user)):
    db = get_db()
    filtro = {} if current_user["role"] == "administrador" else {"activo": True}
    return [formato_tarjeta(t) for t in await db.tarjetas.find(filtro).sort("nombre", 1).to_list(100)]


async def _nombre_libre(db, nombre: str, excluir=None):
    q = {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}}
    if excluir:
        q["_id"] = {"$ne": excluir}
    if await db.tarjetas.find_one(q):
        raise HTTPException(status_code=400, detail=f"Ya existe la tarjeta «{nombre}»")


@router.post("/")
async def crear(datos: TarjetaCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Indicá el nombre de la tarjeta")
    if not (datos.debito or datos.credito):
        raise HTTPException(status_code=400, detail="La tarjeta tiene que ser de débito, de crédito o de ambos")
    await _nombre_libre(db, nombre)
    doc = {
        "nombre": nombre,
        "debito": datos.debito,
        "credito": datos.credito,
        "planes": _validar_planes([p.model_dump() for p in datos.planes]),
        "activo": True,
    }
    res = await db.tarjetas.insert_one(doc)
    doc["_id"] = res.inserted_id
    await registrar_auditoria(db=db, usuario_id=current_user["user_id"], rol=current_user["role"],
                              accion="crear", modulo="tarjetas", descripcion=f"Tarjeta {nombre}", dato_nuevo=doc)
    return formato_tarjeta(doc)


@router.put("/{tarjeta_id}")
async def modificar(tarjeta_id: str, datos: TarjetaUpdate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    if not ObjectId.is_valid(tarjeta_id):
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    oid = ObjectId(tarjeta_id)
    anterior = await db.tarjetas.find_one({"_id": oid})
    if not anterior:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    cambios = {k: v for k, v in datos.model_dump(exclude_none=True).items()}
    if "nombre" in cambios:
        cambios["nombre"] = cambios["nombre"].strip()
        await _nombre_libre(db, cambios["nombre"], oid)
    if "planes" in cambios:
        cambios["planes"] = _validar_planes(cambios["planes"])
    debito = cambios.get("debito", anterior.get("debito", True))
    credito = cambios.get("credito", anterior.get("credito", True))
    if not (debito or credito):
        raise HTTPException(status_code=400, detail="La tarjeta tiene que ser de débito, de crédito o de ambos")
    await db.tarjetas.update_one({"_id": oid}, {"$set": cambios})
    nueva = await db.tarjetas.find_one({"_id": oid})
    await registrar_auditoria(db=db, usuario_id=current_user["user_id"], rol=current_user["role"],
                              accion="modificar", modulo="tarjetas", descripcion=f"Tarjeta {nueva['nombre']}",
                              dato_anterior=anterior, dato_nuevo=nueva)
    return formato_tarjeta(nueva)
