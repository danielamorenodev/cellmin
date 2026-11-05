"""Orden de reparación y ticket de venta en formato email (HTML y texto).

Es la copia del cliente: nunca incluye el código de desbloqueo ni las notas
internas. Todo dato que viene de la base se escapa.
"""
from datetime import datetime, timezone
from html import escape

from app.utils.cajas import ZONA_AR

SUCURSALES = {
    "sucursal_1": {"nombre": "Cellmin — General Paz", "direccion": "25 de Mayo 1337, General Paz"},
    "sucursal_2": {"nombre": "Cellmin — Yofre Norte", "direccion": "Alsina 2202, Yofre Norte"},
}

METODOS = {
    "efectivo": "Efectivo", "transferencia": "Transferencia", "debito": "Débito",
    "credito": "Crédito", "usd": "Dólares",
}


def pesos(monto) -> str:
    texto = f"{float(monto or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"$ {texto}"


def fecha_hora(valor) -> str:
    if not isinstance(valor, datetime):
        return ""
    if valor.tzinfo is None:
        valor = valor.replace(tzinfo=timezone.utc)
    return valor.astimezone(ZONA_AR).strftime("%d/%m/%Y %H:%M")


def _e(valor) -> str:
    return escape(str(valor if valor is not None else ""))


def _fila(izq, der, negrita=False):
    peso = "font-weight:bold;" if negrita else ""
    return (f'<tr><td style="padding:3px 0;{peso}">{izq}</td>'
            f'<td style="padding:3px 0;text-align:right;white-space:nowrap;{peso}">{der}</td></tr>')


def _envoltorio(titulo: str, sucursal: dict, cuerpo: str, pie: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>{_e(titulo)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:22px;font-weight:bold;letter-spacing:1px;">CELLMIN</div>
      <div style="font-size:13px;color:#4b5563;">{_e(sucursal['nombre'])}</div>
      <div style="font-size:13px;color:#4b5563;">{_e(sucursal['direccion'])}</div>
      <div style="font-size:16px;font-weight:bold;margin-top:12px;">{_e(titulo)}</div>
    </div>
    {cuerpo}
    <div style="border-top:1px dashed #9ca3af;margin:16px 0 10px;"></div>
    <div style="text-align:center;font-size:12px;color:#4b5563;">
      <div style="font-weight:bold;">Comprobante no válido como factura</div>
      {pie}
    </div>
  </div>
</body></html>"""


def _seccion(titulo: str, contenido: str) -> str:
    return (f'<div style="border-top:1px dashed #9ca3af;margin:12px 0 8px;"></div>'
            f'<div style="font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">{_e(titulo)}</div>'
            f'<table style="width:100%;border-collapse:collapse;font-size:14px;">{contenido}</table>')


def _nombre_cliente(cliente) -> str:
    return " ".join(x for x in [(cliente or {}).get("nombre"), (cliente or {}).get("apellido")] if x)


# ── Orden de reparación ─────────────────────────────────────────────────

def orden_reparacion(r: dict, cliente: dict | None) -> tuple[str, str, str]:
    """Devuelve (asunto, html, texto) de la copia del cliente."""
    sucursal = SUCURSALES.get(r.get("sucursal"), SUCURSALES["sucursal_1"])
    equipo = r.get("equipo") or {}
    numero = r.get("numero_orden", "")
    estimada = r.get("fecha_estimada_entrega")
    estimada = "/".join(reversed(estimada.split("-"))) if estimada else None

    datos = _fila("Orden", f"<b>{_e(numero)}</b>") + _fila("Ingreso", _e(fecha_hora(r.get("fecha_ingreso"))))
    if estimada:
        datos += _fila("Entrega estimada", _e(estimada))
    if r.get("vendedor_nombre"):
        datos += _fila("Atendió", _e(r["vendedor_nombre"]))

    cli = _fila("Nombre", _e(_nombre_cliente(cliente)))
    if (cliente or {}).get("telefono"):
        cli += _fila("Teléfono", _e(cliente["telefono"]))
    if (cliente or {}).get("dni"):
        cli += _fila("DNI", _e(cliente["dni"]))

    eq = _fila("Marca", _e(equipo.get("marca"))) + _fila("Modelo", _e(equipo.get("modelo")))
    if equipo.get("imei"):
        eq += _fila("IMEI", _e(equipo["imei"]))
    if equipo.get("problema_descripcion"):
        eq += f'<tr><td colspan="2" style="padding:3px 0;">Problema: {_e(equipo["problema_descripcion"])}</td></tr>'

    cuerpo = _seccion("Datos de la orden", datos) + _seccion("Cliente", cli) + _seccion("Equipo", eq)

    tipos = r.get("tipos_reparacion") or []
    if tipos:
        rep = "".join(_fila(_e(t.get("nombre")), pesos(t.get("precio"))) for t in tipos)
        rep += _fila("TOTAL", pesos(r.get("precio_total")), negrita=True)
        if (r.get("total_pagado") or 0) > 0:
            rep += _fila("Pagado", pesos(r.get("total_pagado")))
            rep += _fila("SALDO", pesos(r.get("saldo_pendiente")), negrita=True)
        cuerpo += _seccion("Reparaciones", rep)
    else:
        cuerpo += _seccion("Presupuesto", '<tr><td style="padding:3px 0;">El equipo queda en diagnóstico. Te avisamos el presupuesto.</td></tr>')

    if (r.get("garantia_dias") or 0) > 0:
        cuerpo += _seccion("Garantía", _fila(f"{int(r['garantia_dias'])} días desde la entrega", ""))

    html = _envoltorio("Orden de reparación", sucursal, cuerpo,
                       "<div>Presentá este comprobante (o este email) al retirar tu equipo.</div>")

    lineas = [
        f"CELLMIN — {sucursal['nombre']}", sucursal["direccion"], "", "ORDEN DE REPARACIÓN",
        f"Orden: {numero}", f"Ingreso: {fecha_hora(r.get('fecha_ingreso'))}",
    ]
    if estimada:
        lineas.append(f"Entrega estimada: {estimada}")
    lineas += ["", f"Cliente: {_nombre_cliente(cliente)}",
               f"Equipo: {equipo.get('marca', '')} {equipo.get('modelo', '')}"]
    if equipo.get("imei"):
        lineas.append(f"IMEI: {equipo['imei']}")
    if equipo.get("problema_descripcion"):
        lineas.append(f"Problema: {equipo['problema_descripcion']}")
    if tipos:
        lineas.append("")
        lineas += [f"- {t.get('nombre')}: {pesos(t.get('precio'))}" for t in tipos]
        lineas.append(f"TOTAL: {pesos(r.get('precio_total'))}")
        if (r.get("total_pagado") or 0) > 0:
            lineas += [f"Pagado: {pesos(r.get('total_pagado'))}", f"Saldo: {pesos(r.get('saldo_pendiente'))}"]
    lineas += ["", "Comprobante no válido como factura.", "Presentá este comprobante al retirar tu equipo."]
    return f"Orden de reparación {numero} — Cellmin", html, "\n".join(lineas)


# ── Ticket de venta ─────────────────────────────────────────────────────

def _texto_pagos(v: dict) -> str:
    pagos = v.get("pagos") or []
    if not pagos:
        return v.get("metodo_pago") or ""
    partes = []
    for p in pagos:
        nombre = METODOS.get(p.get("metodo"), p.get("metodo", ""))
        if p.get("tarjeta"):
            nombre += f" {p['tarjeta']}"
        if p.get("cuotas") and p.get("cuotas") > 1:
            nombre += f" en {p['cuotas']} cuotas"
        if p.get("metodo") == "usd" and p.get("usd") is not None:
            partes.append(f"{nombre} US$ {p['usd']:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
        elif len(pagos) > 1:
            partes.append(f"{nombre} {pesos(p.get('monto'))}")
        else:
            partes.append(nombre)
    return " + ".join(partes)


def ticket_venta(v: dict, cliente: dict | None) -> tuple[str, str, str]:
    sucursal = SUCURSALES.get(v.get("sucursal"), SUCURSALES["sucursal_1"])
    numero = v.get("numero_venta", "")
    datos = _fila("Venta", f"<b>{_e(numero)}</b>") + _fila("Fecha", _e(fecha_hora(v.get("fecha"))))
    if v.get("vendedor_nombre"):
        datos += _fila("Te atendió", _e(v["vendedor_nombre"]))
    if cliente:
        datos += _fila("Cliente", _e(_nombre_cliente(cliente)))

    items = ""
    for i in v.get("items") or []:
        detalle = f"{_e(i.get('nombre_producto'))}<br><span style=\"color:#6b7280;font-size:12px;\">{int(i.get('cantidad', 1))} x {pesos(i.get('precio_unitario'))}</span>"
        for imei in i.get("imeis") or []:
            detalle += f"<br><span style=\"color:#6b7280;font-size:12px;\">IMEI: {_e(imei)}</span>"
        items += _fila(detalle, pesos(i.get("subtotal")))

    totales = ""
    if (v.get("descuento") or 0) > 0:
        totales += _fila("Descuento", f"- {pesos(v['descuento'])}")
    if (v.get("interes") or 0) > 0:
        totales += _fila("Recargo", pesos(v["interes"]))
    totales += _fila("TOTAL", pesos(v.get("total")), negrita=True)
    totales += _fila("Medio de pago", _e(_texto_pagos(v)))
    if (v.get("vuelto") or 0) > 0:
        totales += _fila("Vuelto (en pesos)", pesos(v["vuelto"]))

    cuerpo = _seccion("Datos", datos) + _seccion("Productos", items) + _seccion("Total", totales)
    html = _envoltorio("Ticket de venta", sucursal, cuerpo, "<div>¡Gracias por tu compra!</div>")

    lineas = [f"CELLMIN — {sucursal['nombre']}", sucursal["direccion"], "", "TICKET DE VENTA",
              f"Venta: {numero}", f"Fecha: {fecha_hora(v.get('fecha'))}", ""]
    for i in v.get("items") or []:
        lineas.append(f"{i.get('nombre_producto')}  {i.get('cantidad')} x {pesos(i.get('precio_unitario'))} = {pesos(i.get('subtotal'))}")
    lineas += ["", f"TOTAL: {pesos(v.get('total'))}", f"Medio de pago: {_texto_pagos(v)}",
               "", "Comprobante no válido como factura.", "¡Gracias por tu compra!"]
    return f"Ticket de compra {numero} — Cellmin", html, "\n".join(lineas)
