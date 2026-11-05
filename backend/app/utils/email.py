"""Envío de emails (órdenes de reparación y tickets de venta) por SMTP.

Se configura en el .env (SMTP_HOST, SMTP_PORT, SMTP_USUARIO, SMTP_CLAVE,
SMTP_REMITENTE, SMTP_SEGURIDAD). Sin SMTP_HOST el envío queda desactivado y
la opción no aparece en pantalla.
"""
import asyncio
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr

from fastapi import HTTPException
from pydantic import TypeAdapter, EmailStr, ValidationError

from app.config import settings

# En las pruebas automáticas se reemplaza _enviar_smtp y los mensajes quedan acá
ENVIADOS: list = []
TIEMPO_MAXIMO = 15  # segundos para conectar con el servidor de correo

_validador = TypeAdapter(EmailStr)


class ErrorEmail(Exception):
    pass


def email_configurado() -> bool:
    return bool(settings.smtp_host.strip())


def validar_email(destino: str | None) -> str:
    destino = (destino or "").strip()
    if not destino:
        raise HTTPException(status_code=400, detail="Falta el email del cliente")
    try:
        return str(_validador.validate_python(destino)).lower()
    except ValidationError:
        raise HTTPException(status_code=400, detail=f"El email «{destino}» no es válido")


def _remitente() -> str:
    remitente = settings.smtp_remitente.strip() or settings.smtp_usuario.strip()
    nombre, direccion = parseaddr(remitente)
    return formataddr((nombre or "Cellmin", direccion or remitente))


def _enviar_smtp(mensaje: EmailMessage):
    seguridad = (settings.smtp_seguridad or "starttls").lower()
    contexto = ssl.create_default_context()
    if seguridad == "ssl":
        servidor = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=TIEMPO_MAXIMO, context=contexto)
    else:
        servidor = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=TIEMPO_MAXIMO)
    with servidor:
        if seguridad == "starttls":
            servidor.starttls(context=contexto)
        if settings.smtp_usuario:
            servidor.login(settings.smtp_usuario, settings.smtp_clave)
        servidor.send_message(mensaje)


async def enviar_email(destino: str, asunto: str, html: str, texto: str):
    """Envía el email. Lanza ErrorEmail con un mensaje claro si no se pudo."""
    if not email_configurado():
        raise ErrorEmail("El envío de emails no está configurado en el servidor")
    mensaje = EmailMessage()
    mensaje["Subject"] = asunto
    mensaje["From"] = _remitente()
    mensaje["To"] = destino
    mensaje["Message-ID"] = make_msgid(domain="cellmin")
    mensaje.set_content(texto)
    mensaje.add_alternative(html, subtype="html")
    try:
        await asyncio.to_thread(_enviar_smtp, mensaje)
    except smtplib.SMTPAuthenticationError:
        raise ErrorEmail("El servidor de correo rechazó el usuario o la clave (revisar SMTP_USUARIO y SMTP_CLAVE)")
    except smtplib.SMTPRecipientsRefused:
        raise ErrorEmail(f"El servidor de correo rechazó la dirección {destino}")
    except (OSError, smtplib.SMTPException) as e:
        raise ErrorEmail(f"No se pudo enviar el email: {type(e).__name__}: {str(e)[:150]}")
    ENVIADOS.append({"destino": destino, "asunto": asunto, "html": html, "texto": texto})


async def enviar_y_registrar(db, coleccion: str, doc_id, destino: str, asunto: str, html: str,
                             texto: str, usuario_id: str) -> dict:
    """Envía y anota el intento en el documento (orden o venta). Nunca lanza:
    devuelve {"enviado": bool, "destino", "error"}."""
    error = None
    try:
        await enviar_email(destino, asunto, html, texto)
    except ErrorEmail as e:
        error = str(e)
        from app.utils.logger import log_errores
        log_errores.error(f"Email a {destino} ({asunto}): {error}")
    await db[coleccion].update_one({"_id": doc_id}, {"$push": {"emails": {
        "destino": destino, "fecha": datetime.utcnow(), "enviado": error is None,
        "error": error, "usuario_id": usuario_id,
    }}})
    return {"enviado": error is None, "destino": destino, "error": error}
