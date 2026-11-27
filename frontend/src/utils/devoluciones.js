import toast from "react-hot-toast";
import { formatCurrency, formatDateTime } from "./helpers";

export const METODOS_DEVOLUCION = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito (a la tarjeta)" },
  { value: "credito", label: "Crédito (a la tarjeta)" },
];
export const nombreMetodo = (m) => METODOS_DEVOLUCION.find((x) => x.value === m)?.label.split(" (")[0] || m;

// Unidades ya devueltas de cada producto de la venta (por posición)
export function devueltasPorItem(venta) {
  const devueltas = (venta.items || []).map(() => 0);
  for (const d of venta.devoluciones || []) {
    for (const it of d.items || []) if (devueltas[it.indice] != null) devueltas[it.indice] += it.cantidad;
  }
  return devueltas;
}

// ¿Queda algo para devolver?
export const quedaParaDevolver = (venta) => {
  const devueltas = devueltasPorItem(venta);
  return (venta.items || []).some((it, i) => it.cantidad - devueltas[i] > 0);
};

// Datos de cada local para el comprobante (los mismos del ticket)
const LOCALES = {
  sucursal_1: ["Cellmin — General Paz", "25 de Mayo 1337"],
  sucursal_2: ["Cellmin — Yofre Norte", "Alsina 2202"],
};
const escapar = (t) =>
  String(t ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Comprobante de devolución (ticket de 80 mm, como el de la venta)
export function imprimirDevolucion(venta, devolucion, cliente) {
  const [local, direccion] = LOCALES[venta.sucursal] || LOCALES.sucursal_1;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devolución ${escapar(devolucion.numero)}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace;font-size:12px;width:80mm;padding:8px}
  .c{text-align:center}.b{font-weight:bold}.g{font-size:16px}.s{font-size:11px}.d{border-top:1px dashed #000;margin:6px 0}
  .r{display:flex;justify-content:space-between;margin:2px 0}@page{size:80mm auto;margin:0}</style></head><body>
  <div class="c"><p class="b g">CELLMIN</p><p class="s">${local}</p><p class="s">${direccion}</p></div><div class="d"></div>
  <p class="b">COMPROBANTE DE DEVOLUCIÓN ${escapar(devolucion.numero)}</p>
  <p>Fecha: ${formatDateTime(devolucion.fecha)}</p>
  <p>Venta: ${escapar(venta.numero_venta)} del ${formatDateTime(venta.fecha)}</p>
  ${cliente ? `<p>Cliente: ${escapar(cliente.nombre)} ${escapar(cliente.apellido)}</p>` : ""}
  ${devolucion.usuario_nombre ? `<p>Atendió: ${escapar(devolucion.usuario_nombre)}</p>` : ""}
  <div class="d"></div>
  ${devolucion.items
    .map(
      (i) => `<p class="b">${escapar(i.nombre_producto)}</p>
    ${(i.imeis || []).map((x) => `<p>IMEI: ${escapar(x)}</p>`).join("")}
    <div class="r"><span>${i.cantidad} unidad(es)</span><span>${formatCurrency(i.monto || 0)}</span></div>`,
    )
    .join("")}
  <div class="d"></div>
  <div class="r b g"><span>DEVUELTO:</span><span>${formatCurrency(devolucion.monto)}</span></div>
  <div class="r"><span>En:</span><span>${escapar(nombreMetodo(devolucion.metodo))}</span></div>
  ${devolucion.motivo ? `<p>Motivo: ${escapar(devolucion.motivo)}</p>` : ""}
  <div class="d"></div><div class="c s"><p>Comprobante no válido como factura</p></div></body></html>`;
  const ventana = window.open("", "_blank", "width=400,height=700");
  if (!ventana) return toast.error("El navegador bloqueó la ventana de impresión");
  ventana.document.write(html);
  ventana.document.close();
  setTimeout(() => {
    ventana.focus();
    ventana.print();
  }, 800);
}

