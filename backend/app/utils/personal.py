"""Personal que se registra en ventas y reparaciones: quién vendió o tomó
la orden y qué técnico la reparó. Se elige de la lista de usuarios."""
from bson import ObjectId
from fastapi import HTTPException

ROLES_VENDEDOR = ("vendedor", "cajero", "administrador")
ROLES_TECNICO = ("tecnico", "administrador")


async def persona(db, user_id, roles, que: str) -> dict:
    """Valida el usuario elegido y devuelve {id, nombre}."""
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail=f"Elegí el {que}")
    u = await db.usuarios.find_one({"_id": ObjectId(user_id), "activo": True}, {"nombre": 1, "rol": 1})
    if not u:
        raise HTTPException(status_code=400, detail=f"El {que} elegido no está activo en el sistema")
    if u["rol"] not in roles:
        raise HTTPException(status_code=400, detail=f"{u['nombre']} no puede figurar como {que}")
    return {"id": str(u["_id"]), "nombre": u["nombre"]}
