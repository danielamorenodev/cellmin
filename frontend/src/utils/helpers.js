export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
};

export const formatUSD = (amount) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "code",
  }).format(amount);
};

export const formatDate = (date) => {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
};

export const formatDateTime = (date) => {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

export const ROLES = {
  ADMINISTRADOR: "administrador",
  CAJERO: "cajero",
  VENDEDOR: "vendedor",
  DEPOSITO: "deposito",
};

export const ESTADOS_REPARACION = {
  ingresada: { label: "Ingresada", color: "bg-blue-100 text-blue-800" },
  en_reparacion: {
    label: "En Reparación",
    color: "bg-yellow-100 text-yellow-800",
  },
  lista: { label: "Lista para Entregar", color: "bg-green-100 text-green-800" },
  entregada: { label: "Entregada", color: "bg-gray-100 text-gray-800" },
};

export const ESTADOS_REP = {
  en_diagnostico: {
    label: "En diagnóstico",
    color: "bg-gray-100 text-gray-700",
  },
  ingresada: { label: "Ingresada", color: "bg-blue-100 text-blue-700" },
  en_reparacion: {
    label: "En reparación",
    color: "bg-yellow-100 text-yellow-700",
  },
  lista: { label: "Lista para entregar", color: "bg-green-100 text-green-700" },
  entregada: { label: "Entregada", color: "bg-gray-100 text-gray-700" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

export const METODOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "usd", label: "Dólares (US$)" },
];

// ---- Fecha estimada de entrega de reparaciones ("AAAA-MM-DD") ----
const dosDigitos = (n) => String(n).padStart(2, "0");
export const fechaLocalISO = (d = new Date()) =>
  `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
export const sumarDias = (dias, d = new Date()) => {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return fechaLocalISO(r);
};
// "2026-11-03" -> "03/11/2026"
export const formatFechaISO = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const ESTADOS_EN_CURSO = ["en_diagnostico", "ingresada", "en_reparacion"];
// Días de atraso de una orden que todavía no está lista (0 = en término)
export const diasAtraso = (r) => {
  if (!r?.fecha_estimada_entrega || !ESTADOS_EN_CURSO.includes(r.estado)) return 0;
  const [a, m, d] = r.fecha_estimada_entrega.split("-").map(Number);
  const estimada = new Date(a, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hoy - estimada) / 86400000));
};

// Motivos de los movimientos de stock, como se muestran en pantalla
export const MOTIVOS_STOCK = {
  ajuste_manual: "Ajuste manual",
  devolucion: "Devolución",
  perdida: "Pérdida / Rotura",
  inventario: "Conteo de inventario",
  compra: "Ingreso de mercadería",
  cancelacion_compra: "Anulación de ingreso",
  venta: "Venta",
  cancelacion_venta: "Cancelación de venta",
  remito_salida: "Remito: envío a otra sucursal",
  remito_entrada: "Remito: recibido de otra sucursal",
};

export const SUCURSALES = [
  { value: "sucursal_1", label: "Sucursal 1" },
  { value: "sucursal_2", label: "Sucursal 2" },
];

export const nombreSucursal = (valor) =>
  SUCURSALES.find((s) => s.value === valor)?.label || valor || "-";

// Stock / mínimo de un producto o variante en una sucursal.
// Con sucursal vacía devuelve el total de todas las sucursales.
export const stockEn = (item, sucursal) => {
  if (!item) return 0;
  if (!sucursal) return item.stock_actual ?? 0;
  return item.stock_sucursal?.[sucursal] ?? 0;
};
export const minimoEn = (item, sucursal) => {
  if (!item) return 0;
  if (!sucursal) return item.stock_minimo ?? 0;
  return item.stock_minimo_sucursal?.[sucursal] ?? 0;
};

// Alerta de reposición: el stock llegó al mínimo o está por debajo.
// Un mínimo de 0 significa "sin mínimo configurado" y no genera alerta.
export const bajoMinimo = (item, sucursal) => {
  const minimo = minimoEn(item, sucursal);
  return minimo > 0 && stockEn(item, sucursal) <= minimo;
};

// IMEI de un celular: 15 números, el último es un dígito verificador (Luhn).
// El lector o la caja pueden traer espacios o guiones: se dejan solo los números.
export const normalizarImei = (texto) => String(texto ?? "").replace(/\D/g, "");
export const imeiValido = (imei) => {
  if (!/^\d{15}$/.test(imei || "")) return false;
  let suma = 0;
  [...imei].reverse().forEach((c, i) => {
    let d = Number(c);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  });
  return suma % 10 === 0;
};

// ¿La categoría es de celulares?
export const esCategoriaCelulares = (categorias, id) =>
  /celular/i.test(categorias.find((c) => c.id === id)?.nombre || "");

// Ids elegidos en un filtro de varias opciones (guardados como "a,b,c")
export const idsFiltro = (value) => (value ? value.split(",") : []);

export const formatInputMoneda = (valor) => {
  // Permitir solo números, punto y coma
  const limpio = valor.replace(/[^\d.,]/g, "");

  // Separar parte entera y decimal
  const partes = limpio.replace(",", ".").split(".");
  const entera = partes[0].replace(/\./g, "");
  const decimal = partes.length > 1 ? partes[1].slice(0, 2) : null;

  // Formatear parte entera con puntos de miles
  const enteraFormateada = entera
    ? new Intl.NumberFormat("es-AR").format(parseInt(entera))
    : "";

  return decimal !== null ? `${enteraFormateada},${decimal}` : enteraFormateada;
};

export const parsearMoneda = (valor) => {
  if (!valor) return 0;
  // Quitar puntos de miles y reemplazar coma decimal por punto
  const limpio = valor.replace(/\./g, "").replace(",", ".");
  return parseFloat(limpio) || 0;
};

// Interpreta el texto guardado en venta.metodo_pago.
// Pago simple: "efectivo"
// Pago mixto:  "efectivo: $ 10.000,00 + transferencia: $ 10.000,00"
export const parsearMetodoPago = (texto) => {
  if (!texto) return { esMixto: false, partes: [] };
  const partes = texto.split(" + ").map((parte) => {
    const [metodo, ...resto] = parte.split(": ");
    // "credito (Visa 3 cuotas)": medio y, entre paréntesis, la tarjeta
    const [, clave, detalle] = metodo.trim().match(/^([^(]+?)\s*(?:\((.*)\))?$/) || [null, metodo.trim()];
    const info = METODOS_PAGO.find((m) => m.value === clave);
    const nombre = info ? info.label : clave;
    return {
      metodo: detalle ? `${nombre} (${detalle})` : nombre,
      monto: resto.length ? resto.join(": ") : null,
    };
  });
  return { esMixto: partes.length > 1, partes };
};


// Cómo se pagó una venta, para mostrar en pantalla y en el ticket.
// Las ventas con dólares guardan los US$ recibidos y el vuelto en pesos.
export const describirPago = (venta) => {
  const etiqueta = (valor) =>
    METODOS_PAGO.find((m) => m.value === valor)?.label || valor;
  const hayUSD = (venta.pagos || []).some((p) => p.metodo === "usd");
  if (!hayUSD) {
    return { texto: venta.metodo_pago, partes: null, vuelto: 0 };
  }
  const partes = venta.pagos.map((p) => ({
    metodo: etiqueta(p.metodo),
    monto:
      p.metodo === "usd"
        ? `${formatUSD(p.usd)} (= ${formatCurrency(p.monto)})`
        : formatCurrency(p.monto),
  }));
  return {
    texto: partes.map((p) => `${p.metodo}: ${p.monto}`).join(" + "),
    partes,
    vuelto: venta.vuelto || 0,
  };
};

// Tarjeta de un pago: "Visa 3 cuotas" / "Visa"
export const textoTarjeta = (pago) =>
  !pago?.tarjeta
    ? ""
    : pago.metodo === "credito" && (pago.cuotas || 1) > 1
      ? `${pago.tarjeta} ${pago.cuotas} cuotas`
      : pago.tarjeta;

// Medio de pago de un cobro de reparación; si fue en dólares, cuántos, y si
// fue con tarjeta, cuál
export const etiquetaPago = (pago) =>
  pago.metodo === "usd" && pago.usd != null
    ? `Dólares (${formatUSD(pago.usd)})`
    : pago.tarjeta
      ? `${METODOS_PAGO.find((m) => m.value === pago.metodo)?.label || pago.metodo} (${textoTarjeta(pago)})`
      : pago.metodo;

// Recargo de un pago con tarjeta de crédito en cuotas, sobre "base" pesos
export const recargoTarjeta = (pago, tarjetas, base) => {
  if (pago?.metodo !== "credito" || !pago.tarjeta_id) return { pct: 0, monto: 0 };
  const t = tarjetas.find((x) => x.id === pago.tarjeta_id);
  const plan = t?.planes.find((p) => p.cuotas === Number(pago.cuotas || 1));
  const pct = plan?.recargo || 0;
  return { pct, monto: Math.round(base * pct) / 100 };
};

// Efectivo y dólares van una sola vez por cobro; tarjetas y transferencias
// se pueden repetir (por ejemplo, dos tarjetas distintas)
export const MEDIOS_UNICOS = ["efectivo", "usd"];
