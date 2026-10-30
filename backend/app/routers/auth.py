from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from app.database import get_db
from app.utils.auth import verify_password, create_access_token, get_current_user, hash_password
from pydantic import BaseModel
from bson import ObjectId
from app.utils.logger import registrar_auditoria, guardar_evento

router = APIRouter()

@router.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user = await db.usuarios.find_one({"email": form_data.username, "activo": True})
    if not user or not verify_password(form_data.password, user["password"]):
        # Se registra el intento (email y dirección), nunca la contraseña
        existe = await db.usuarios.find_one({"email": form_data.username}, {"nombre": 1, "activo": 1})
        motivo = (
            "contraseña incorrecta" if existe and existe.get("activo", True)
            else "usuario desactivado" if existe
            else "email no registrado"
        )
        await guardar_evento(
            db, "ingreso_fallido", "autenticacion", "login_fallido",
            f"Intento de ingreso con {form_data.username[:120]}: {motivo}",
            usuario_id=str(existe["_id"]) if existe else "",
            usuario_nombre=(existe or {}).get("nombre", ""),
            ip=request.client.host if request.client else None,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos"
        )
    sucursales = user.get("sucursales", [user.get("sucursal", "sucursal_1")])
    token = create_access_token({
        "sub": str(user["_id"]),
        "role": user["rol"],
        "nombre": user["nombre"],
        "sucursales": sucursales,
    })

    await registrar_auditoria(
    db=db,
    usuario_id=str(user["_id"]),
    usuario_nombre=user["nombre"],
    rol=user["rol"],
    accion="login",
    modulo="autenticacion",
    descripcion=f"Inicio de sesión exitoso"
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "id": str(user["_id"]),
        "rol": user["rol"],
        "nombre": user["nombre"],
        "sucursales": sucursales,
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.usuarios.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "id": str(user["_id"]),
        "nombre": user["nombre"],
        "email": user["email"],
        "rol": user["rol"],
        "sucursales": user.get("sucursales", [user.get("sucursal", "sucursal_1")]),
    }

class CambioClave(BaseModel):
    actual: str
    nueva: str


MINIMO_CLAVE = 8


@router.put("/password")
async def cambiar_mi_clave(datos: CambioClave, current_user: dict = Depends(get_current_user)):
    """Cada usuario cambia su propia contraseña (tiene que saber la actual)."""
    db = get_db()
    user = await db.usuarios.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not verify_password(datos.actual, user["password"]):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if len(datos.nueva) < MINIMO_CLAVE:
        raise HTTPException(status_code=400, detail=f"La contraseña nueva tiene que tener al menos {MINIMO_CLAVE} caracteres")
    if datos.nueva == datos.actual:
        raise HTTPException(status_code=400, detail="La contraseña nueva tiene que ser distinta de la actual")
    await db.usuarios.update_one({"_id": user["_id"]}, {"$set": {"password": hash_password(datos.nueva)}})
    await registrar_auditoria(
        db=db, usuario_id=current_user["user_id"], usuario_nombre=user["nombre"], rol=current_user["role"],
        accion="cambiar_clave", modulo="usuarios", descripcion=f"{user['nombre']} cambió su contraseña",
    )
    return {"message": "Contraseña actualizada"}
