from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.user import UserCreate, UserUpdate, ROLES
from app.routers.auth import filtro_email
from app.utils.auth import get_current_user, hash_password
from app.utils.permissions import check_permission
from bson import ObjectId
from datetime import datetime
from app.utils.logger import registrar_auditoria

router = APIRouter()


def _oid(user_id: str) -> ObjectId:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return ObjectId(user_id)


def _validar_rol(rol):
    if rol is not None and rol not in ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido: {rol}")

def format_user(user):
    return {
        "id": str(user["_id"]),
        "nombre": user["nombre"],
        "email": user["email"],
        "rol": user["rol"],
        "sucursales": user.get("sucursales", [user.get("sucursal", "sucursal_1")]),
        "activo": user.get("activo", True),
        "fecha_creacion": user.get("fecha_creacion")
    }

@router.get("/personal")
async def personal(current_user: dict = Depends(get_current_user)):
    """Personal activo (nombre, rol y sucursales, sin email) para elegir el
    vendedor de una venta u orden y el técnico que repara."""
    db = get_db()
    users = await db.usuarios.find({"activo": True}, {"nombre": 1, "rol": 1, "sucursales": 1, "sucursal": 1}).to_list(200)
    return [
        {"id": str(u["_id"]), "nombre": u["nombre"], "rol": u["rol"],
         "sucursales": u.get("sucursales", [u.get("sucursal", "sucursal_1")])}
        for u in users
    ]


@router.get("/")
async def get_users(current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    users = await db.usuarios.find().to_list(100)
    return [format_user(u) for u in users]

@router.post("/")
async def create_user(user: UserCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    _validar_rol(user.rol)
    existing = await db.usuarios.find_one({"email": filtro_email(user.email)})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña tiene que tener al menos 8 caracteres")
    new_user = {
        "nombre": user.nombre,
        "email": user.email,
        "password": hash_password(user.password),
        "rol": user.rol,
        # Antes no se guardaban: todo usuario nuevo quedaba en la sucursal 1
        "sucursales": user.sucursales,
        "activo": True,
        "fecha_creacion": datetime.utcnow()
    }
    result = await db.usuarios.insert_one(new_user)
    new_user["_id"] = result.inserted_id

    await registrar_auditoria(
    db=db,
    usuario_id=current_user["user_id"],
    usuario_nombre="",
    rol=current_user["role"],
    accion="crear",
    modulo="usuarios",
    descripcion=f"Usuario creado: {user.email} — Rol: {user.rol}"
    )

    return format_user(new_user)

@router.put("/{user_id}")
async def update_user(user_id: str, user: UserUpdate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    update_data = {k: v for k, v in user.model_dump().items() if v is not None}
    _id = _oid(user_id)
    actual = await db.usuarios.find_one({"_id": _id})
    if not actual:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    _validar_rol(update_data.get("rol"))
    if "email" in update_data:
        repetido = await db.usuarios.find_one({"email": filtro_email(update_data["email"]), "_id": {"$ne": _id}})
        if repetido:
            raise HTTPException(status_code=400, detail="El email ya está registrado")
    # El administrador no puede quitarse a sí mismo el rol ni desactivarse
    if user_id == current_user["user_id"]:
        if update_data.get("rol", "administrador") != "administrador" or update_data.get("activo") is False:
            raise HTTPException(status_code=400, detail="No podés quitarte el rol de administrador ni desactivarte")
    if "sucursales" in update_data:
        # Se deja de usar el campo viejo "sucursal" (texto) para que no confunda
        await db.usuarios.update_one({"_id": _id}, {"$unset": {"sucursal": ""}})
    cambia_clave = "password" in update_data
    if cambia_clave:
        if len(update_data["password"]) < 8:
            raise HTTPException(status_code=400, detail="La contraseña tiene que tener al menos 8 caracteres")
        update_data["password"] = hash_password(update_data["password"])
    await db.usuarios.update_one({"_id": _id}, {"$set": update_data})
    updated = await db.usuarios.find_one({"_id": _id})

    await registrar_auditoria(
    db=db,
    usuario_id=current_user["user_id"],
    usuario_nombre="",
    rol=current_user["role"],
    accion="actualizar",
    modulo="usuarios",
    descripcion=(f"Contraseña de {updated['nombre']} cambiada por el administrador"
                 if cambia_clave and len(update_data) == 1
                 else f"Usuario actualizado: {updated['nombre']}" + (" (incluye contraseña)" if cambia_clave else ""))
    )

    return format_user(updated)

@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user["role"], "*")
    db = get_db()
    usuario = await db.usuarios.find_one({"_id": _oid(user_id)})
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="No podés desactivar tu propio usuario")
    nuevo_estado = not usuario.get("activo", True)
    await db.usuarios.update_one({"_id": usuario["_id"]}, {"$set": {"activo": nuevo_estado}})

    await registrar_auditoria(
    db=db,
    usuario_id=current_user["user_id"],
    usuario_nombre="",
    rol=current_user["role"],
    accion="activar_desactivar",
    modulo="usuarios",
    descripcion=f"Usuario {'desactivado' if not nuevo_estado else 'activado'}: {usuario['nombre']}"
    )

    return {"message": f"Usuario {'activado' if nuevo_estado else 'desactivado'} correctamente"}