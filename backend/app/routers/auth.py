from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from app.database import get_db
from app.utils.auth import verify_password, create_access_token, get_current_user, hash_password
from pydantic import BaseModel
from bson import ObjectId
from app.utils.logger import registrar_auditoria, guardar_evento
import re

router = APIRouter()


def filtro_email(email: str) -> dict:
    """El email se compara sin distinguir mayúsculas ni espacios."""
    return {"$regex": f"^{re.escape((email or '').strip())}$", "$options": "i"}

@router.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user = await db.usuarios.find_one({"email": filtro_email(form_data.username), "activo": True})
    if not user or not verify_password(form_data.password, user["password"]):
        # Se registra el intento (email y dirección), nunca la contraseña
        existe = await db.usuarios.find_one({"email": filtro_email(form_data.username)}, {"nombre": 1, "activo": 1})
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


# ---------- Recuperación de contraseña ----------
# Cualquier usuario puede pedirla desde el login con su email. El link NO va a
# su email sino al único email de la empresa (RECUPERACION_EMAIL), que dice qué
# usuario lo pidió. Vale 30 minutos y una sola vez; en la base se guarda solo
# el hash del código, así que una copia de la base no sirve para usarlo.
import hashlib
import html as html_util
import secrets
from datetime import datetime, timedelta

from app.config import settings
from app.utils import email as email_util

VALIDEZ_LINK = timedelta(minutes=30)
MAXIMO_POR_HORA = 3  # pedidos por usuario (y 10 por dirección IP)
RESPUESTA_GENERICA = (
    "Si el email corresponde a un usuario activo, enviamos un link al email de la empresa "
    "para crear una contraseña nueva. Vale 30 minutos."
)


def _hash(codigo: str) -> str:
    return hashlib.sha256(codigo.encode()).hexdigest()


def _email_empresa() -> str:
    return (settings.recuperacion_email or settings.smtp_usuario or "").strip()


def recuperacion_disponible() -> bool:
    return email_util.email_configurado() and bool(_email_empresa())


def _url_sistema(request: Request) -> str | None:
    if settings.url_sistema.strip():
        return settings.url_sistema.strip().rstrip("/")
    # Solo un origen conocido: si no, alguien podría hacer que el link apunte a otro sitio
    origen = (request.headers.get("origin") or "").rstrip("/")
    return origen if origen in settings.origenes_permitidos else None


class PedidoRecuperacion(BaseModel):
    email: str


class NuevaClave(BaseModel):
    codigo: str
    nueva: str


@router.get("/recuperar/estado")
async def estado_recuperacion():
    return {"disponible": recuperacion_disponible()}


@router.post("/recuperar")
async def pedir_recuperacion(datos: PedidoRecuperacion, request: Request):
    if not recuperacion_disponible():
        raise HTTPException(
            status_code=503,
            detail="La recuperación por email todavía no está configurada. "
                   "Pedile al administrador que te asigne una contraseña nueva.",
        )
    base = _url_sistema(request)
    if not base:
        raise HTTPException(status_code=503, detail="Falta configurar URL_SISTEMA en el servidor.")
    db = get_db()
    ip = request.client.host if request.client else None
    hace_una_hora = datetime.utcnow() - timedelta(hours=1)
    if ip and await db.recuperaciones.count_documents({"ip": ip, "fecha": {"$gte": hace_una_hora}}) >= 10:
        raise HTTPException(status_code=429, detail="Demasiados pedidos. Probá de nuevo en una hora.")

    user = await db.usuarios.find_one({"email": filtro_email(datos.email), "activo": True})
    if not user:
        await guardar_evento(db, "ingreso_fallido", "autenticacion", "recuperar_clave",
                             f"Pedido de recuperación con {datos.email[:120]}: no es un usuario activo", ip=ip)
        await db.recuperaciones.insert_one({"usuario_id": None, "ip": ip, "fecha": datetime.utcnow(), "usado": True})
        return {"message": RESPUESTA_GENERICA}
    uid = str(user["_id"])
    if await db.recuperaciones.count_documents({"usuario_id": uid, "fecha": {"$gte": hace_una_hora}}) >= MAXIMO_POR_HORA:
        return {"message": RESPUESTA_GENERICA}

    codigo = secrets.token_urlsafe(32)
    ahora = datetime.utcnow()
    # Un pedido nuevo deja sin efecto los anteriores
    await db.recuperaciones.update_many({"usuario_id": uid, "usado": False}, {"$set": {"usado": True}})
    await db.recuperaciones.insert_one({
        "usuario_id": uid, "hash": _hash(codigo), "fecha": ahora,
        "vence": ahora + VALIDEZ_LINK, "usado": False, "ip": ip,
    })
    link = f"{base}/recuperar?codigo={codigo}"
    nombre = html_util.escape(user["nombre"])
    correo = html_util.escape(user["email"])
    rol = html_util.escape(user.get("rol", ""))
    asunto = f"Cellmin: recuperar la contraseña de {user['nombre']}"
    texto = (
        f"{user['nombre']} ({user['email']}, {user.get('rol', '')}) pidió crear una contraseña nueva en Cellmin.\n\n"
        f"Para hacerlo, abrí este link (vale 30 minutos y una sola vez):\n{link}\n\n"
        "Si nadie lo pidió, ignorá este email: la contraseña actual sigue funcionando."
    )
    html = (
        f"<p><strong>{nombre}</strong> ({correo}, {rol}) pidió crear una contraseña nueva en Cellmin.</p>"
        f'<p><a href="{html_util.escape(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;'
        f'color:#fff;border-radius:8px;text-decoration:none">Crear contraseña nueva</a></p>'
        "<p>El link vale 30 minutos y se puede usar una sola vez.</p>"
        "<p style=\"color:#666\">Si nadie lo pidió, ignorá este email: la contraseña actual sigue funcionando.</p>"
    )
    try:
        await email_util.enviar_email(_email_empresa(), asunto, html, texto)
    except email_util.ErrorEmail as e:
        from app.utils.logger import log_errores
        log_errores.error(f"Recuperación de contraseña de {user['email']}: {e}")
        raise HTTPException(status_code=502, detail="No se pudo enviar el email. Probá más tarde o avisale al administrador.")
    await registrar_auditoria(
        db=db, usuario_id=uid, usuario_nombre=user["nombre"], rol=user.get("rol", ""),
        accion="pedir_recuperacion", modulo="usuarios",
        descripcion=f"{user['nombre']} pidió recuperar su contraseña (link enviado al email de la empresa)",
    )
    return {"message": RESPUESTA_GENERICA}


async def _pedido_vigente(db, codigo: str):
    pedido = await db.recuperaciones.find_one({"hash": _hash(codigo or ""), "usado": False})
    if not pedido or pedido["vence"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El link no es válido o ya venció. Pedí uno nuevo desde el ingreso.")
    user = await db.usuarios.find_one({"_id": ObjectId(pedido["usuario_id"]), "activo": True})
    if not user:
        raise HTTPException(status_code=400, detail="El link no es válido o ya venció. Pedí uno nuevo desde el ingreso.")
    return pedido, user


@router.get("/recuperar/{codigo}")
async def ver_recuperacion(codigo: str):
    """Para mostrar en la pantalla de qué usuario se cambia la contraseña."""
    _, user = await _pedido_vigente(get_db(), codigo)
    return {"nombre": user["nombre"], "email": user["email"]}


@router.post("/recuperar/confirmar")
async def confirmar_recuperacion(datos: NuevaClave, request: Request):
    db = get_db()
    pedido, user = await _pedido_vigente(db, datos.codigo)
    if len(datos.nueva) < MINIMO_CLAVE:
        raise HTTPException(status_code=400, detail=f"La contraseña tiene que tener al menos {MINIMO_CLAVE} caracteres")
    # Se marca usado antes de cambiar la clave: el mismo link no sirve dos veces
    marcado = await db.recuperaciones.update_one({"_id": pedido["_id"], "usado": False}, {"$set": {"usado": True}})
    if marcado.modified_count != 1:
        raise HTTPException(status_code=400, detail="El link ya se usó. Pedí uno nuevo desde el ingreso.")
    await db.usuarios.update_one({"_id": user["_id"]}, {"$set": {"password": hash_password(datos.nueva)}})
    await registrar_auditoria(
        db=db, usuario_id=str(user["_id"]), usuario_nombre=user["nombre"], rol=user.get("rol", ""),
        accion="recuperar_clave", modulo="usuarios",
        descripcion=f"{user['nombre']} creó una contraseña nueva con el link de recuperación",
    )
    return {"message": "Contraseña actualizada. Ya podés ingresar con la nueva."}
