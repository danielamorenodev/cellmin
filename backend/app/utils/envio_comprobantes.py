"""Envío de la orden de reparación o el ticket de venta al email del cliente."""
from bson import ObjectId
from fastapi import HTTPException

from app.utils import comprobantes
from app.utils.email import email_configurado, enviar_y_registrar, validar_email


async def buscar_cliente(db, cliente_id):
    if cliente_id and ObjectId.is_valid(cliente_id):
        return await db.clientes.find_one({"_id": ObjectId(cliente_id)})
    return None


async def preparar_destino(db, cliente_id, email_dado) -> tuple[str, dict | None]:
    """Valida ANTES de registrar la operación: que el envío esté configurado y
    que haya un email válido (el escrito o el del cliente)."""
    if not email_configurado():
        raise HTTPException(status_code=400, detail="El envío por email no está configurado en el servidor")
    cliente = await buscar_cliente(db, cliente_id)
    destino = (email_dado or "").strip() or (cliente or {}).get("email")
    if not destino:
        raise HTTPException(
            status_code=400,
            detail="El cliente no tiene email. Escribí a qué email enviarlo." if cliente
            else "Escribí a qué email enviarlo.",
        )
    return validar_email(destino), cliente


async def _recordar_email(db, cliente, destino):
    """Si el cliente no tenía email, se le guarda el que se usó."""
    if cliente and not cliente.get("email"):
        await db.clientes.update_one({"_id": cliente["_id"]}, {"$set": {"email": destino}})


async def enviar_orden(db, reparacion: dict, destino: str, cliente, usuario_id: str) -> dict:
    asunto, html, texto = comprobantes.orden_reparacion(reparacion, cliente)
    resultado = await enviar_y_registrar(db, "reparaciones", reparacion["_id"], destino, asunto, html, texto, usuario_id)
    if resultado["enviado"]:
        await _recordar_email(db, cliente, destino)
    return resultado


async def enviar_ticket(db, venta: dict, destino: str, cliente, usuario_id: str) -> dict:
    asunto, html, texto = comprobantes.ticket_venta(venta, cliente)
    resultado = await enviar_y_registrar(db, "ventas", venta["_id"], destino, asunto, html, texto, usuario_id)
    if resultado["enviado"]:
        await _recordar_email(db, cliente, destino)
    return resultado
