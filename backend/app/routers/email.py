from fastapi import APIRouter, Depends

from app.utils.auth import get_current_user
from app.utils.email import email_configurado

router = APIRouter()


@router.get("/estado")
async def estado(current_user: dict = Depends(get_current_user)):
    """Si el servidor puede enviar emails (para mostrar u ocultar la opción)."""
    return {"configurado": email_configurado()}
