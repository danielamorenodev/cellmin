import { formatCurrency, formatDateTime, formatUSD, METODOS_PAGO, textoTarjeta } from "./helpers";

// Datos de cada local para el mensaje (los mismos de la orden impresa)
const LOCALES = {
  sucursal_1: "Cellmin — General Paz (25 de Mayo 1337)",
  sucursal_2: "Cellmin — Yofre Norte (Alsina 2202)",
};
const local = (s) => LOCALES[s] || LOCALES.sucursal_1;

// Pasa un teléfono argentino al formato que pide WhatsApp: 549 + código de
// área + número, sin el 0 ni el 15. Ej.: "0351 15-555-1234" → "5493515551234".
// Un número local sin código de área (7 dígitos, con o sin 15) se toma de
// Córdoba (351), donde están los dos locales. Si no se puede saber, devuelve
// solo los dígitos para que se corrija a mano.
export function telefonoWhatsApp(telefono) {
  let d = String(telefono || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  }
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 9 && d.startsWith("15")) d = d.slice(2);
  if (d.length === 7) d = `351${d}`;
  // Con el 15 son 12 dígitos: el 15 va después del código de área (2 a 4 dígitos)
  if (d.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (d.slice(largoArea, largoArea + 2) === "15") {
        d = d.slice(0, largoArea) + d.slice(largoArea + 2);
        break;
      }
    }
  }
  return d.length === 10 ? `549${d}` : d;
}

// Un número está listo para WhatsApp si tiene el formato argentino completo
// (o es un número de otro país con su código, de 11 a 15 dígitos)
export const telefonoValido = (n) => /^549\d{10}$/.test(n) || (/^\d{11,15}$/.test(n) && !n.startsWith("54"));

export const linkWhatsApp = (numero, texto) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

// Medio de pago legible: "Efectivo", "Crédito Visa 3 cuotas", "Dólares (US$) US$ 10 + Efectivo $ 500"
function textoPago(venta) {
  const pagos = venta.pagos || [];
  const nombre = (p) => {
    const base = METODOS_PAGO.find((m) => m.value === p.metodo)?.label || p.metodo;
    const tarjeta = textoTarjeta(p);
    return tarjeta ? `${base} ${tarjeta}` : base;
  };
  if (pagos.length === 0) return METODOS_PAGO.find((m) => m.value === venta.metodo_pago)?.label || venta.metodo_pago || "";
  if (pagos.length === 1 && pagos[0].metodo !== "usd") return nombre(pagos[0]);
  return pagos
    .map((p) => `${nombre(p)} ${p.metodo === "usd" && p.usd != null ? formatUSD(p.usd) : formatCurrency(p.monto)}`)
    .join(" + ");
}

const saludo = (cliente) => (cliente?.nombre ? `¡Hola ${cliente.nombre}!` : "¡Hola!");

// Mensaje con el ticket de una venta
export function mensajeTicket(venta, cliente) {
  const lineas = [
    `${saludo(cliente)} Gracias por tu compra en ${local(venta.sucursal)}.`,
    "",
    `*Ticket ${venta.numero_venta}* · ${formatDateTime(venta.fecha)}`,
  ];
  for (const it of venta.items || []) {
    lineas.push(`• ${it.nombre_producto} x${it.cantidad}: ${formatCurrency(it.subtotal)}`);
    for (const imei of it.imeis || []) lineas.push(`   IMEI ${imei}`);
  }
  if (venta.descuento > 0) lineas.push(`Descuento: −${formatCurrency(venta.descuento)}`);
  if (venta.interes > 0) lineas.push(`Recargo: ${formatCurrency(venta.interes)}`);
  lineas.push(`*Total: ${formatCurrency(venta.total)}*`);
  const pago = textoPago(venta);
  if (pago) lineas.push(`Medio de pago: ${pago}`);
  if (venta.vuelto > 0) lineas.push(`Vuelto: ${formatCurrency(venta.vuelto)}`);
  lineas.push("", "Comprobante no válido como factura.");
  return lineas.join("\n");
}

// Mensaje con la orden de reparación (copia del cliente: sin el código de
// desbloqueo ni las notas internas)
export function mensajeOrden(r, cliente) {
  const eq = r.equipo || {};
  const lineas = [
    `${saludo(cliente)} Recibimos tu equipo en ${local(r.sucursal)}.`,
    "",
    `*Orden de reparación ${r.numero_orden}*`,
    `Ingreso: ${formatDateTime(r.fecha_ingreso)}`,
    `Equipo: ${[eq.marca, eq.modelo].filter(Boolean).join(" ")}`,
  ];
  if (eq.imei) lineas.push(`IMEI: ${eq.imei}`);
  if (eq.problema_descripcion) lineas.push(`Problema: ${eq.problema_descripcion}`);
  const tipos = r.tipos_reparacion || [];
  if (tipos.length) {
    lineas.push("", "Reparaciones:");
    for (const t of tipos) lineas.push(`• ${t.nombre}: ${formatCurrency(t.precio)}`);
    lineas.push(`*Total: ${formatCurrency(r.precio_total)}*`);
    if (r.total_pagado > 0) {
      lineas.push(`Pagado: ${formatCurrency(r.total_pagado)}`);
      lineas.push(`*Saldo: ${formatCurrency(r.saldo_pendiente)}*`);
    }
  } else {
    lineas.push("", "El equipo queda en diagnóstico: te avisamos el presupuesto.");
  }
  if (r.fecha_estimada_entrega) {
    lineas.push(`Entrega estimada: ${r.fecha_estimada_entrega.split("-").reverse().join("/")}`);
  }
  if (r.garantia_dias > 0) lineas.push(`Garantía: ${r.garantia_dias} días desde la entrega.`);
  lineas.push("", "Guardá este mensaje: lo vas a necesitar para retirar tu equipo.");
  return lineas.join("\n");
}

// Aviso de que el equipo ya se puede retirar (con el saldo, si queda algo por pagar)
export function mensajeListo(r, cliente) {
  const eq = r.equipo || {};
  const equipo = [eq.marca, eq.modelo].filter(Boolean).join(" ") || "equipo";
  const lineas = [
    `${saludo(cliente)} Tu ${equipo} ya está listo para retirar en ${local(r.sucursal)}.`,
    "",
    `*Orden ${r.numero_orden}*`,
  ];
  if (r.saldo_pendiente > 0) lineas.push(`Saldo a pagar al retirar: *${formatCurrency(r.saldo_pendiente)}*`);
  else if (r.precio_total > 0) lineas.push("Ya está todo pago.");
  if (r.garantia_dias > 0) lineas.push(`Garantía: ${r.garantia_dias} días desde la entrega.`);
  lineas.push("", "Acordate de traer la orden o decirnos el número. ¡Te esperamos!");
  return lineas.join("\n");
}
