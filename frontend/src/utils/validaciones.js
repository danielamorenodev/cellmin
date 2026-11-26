import { imeiValido } from "./helpers";

// Las mismas reglas que controla el servidor (backend/app/utils/validaciones.py).
// Cada función devuelve el mensaje de error o "" si está bien (vacío = bien:
// los campos son opcionales).
const numeros = (v) => String(v || "").replace(/\D/g, "");

export function errorDni(v) {
  if (!v?.trim()) return "";
  if (!/^[\d\s.-]+$/.test(v.trim())) return "El DNI solo puede tener números";
  const n = numeros(v).length;
  return n < 7 || n > 8 ? "El DNI tiene que tener 7 u 8 números" : "";
}

export function errorTelefono(v) {
  if (!v?.trim()) return "";
  if (!/^\+?[\d\s().-]+$/.test(v.trim()))
    return "El teléfono solo puede tener números (y +, espacios, guiones o paréntesis)";
  const n = numeros(v).length;
  return n < 8 || n > 15 ? "El teléfono tiene que tener entre 8 y 15 números, con el código de área" : "";
}

export function cuitValido(n) {
  if (!/^\d{11}$/.test(n)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const resto = pesos.reduce((s, p, i) => s + p * Number(n[i]), 0) % 11;
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return dv === Number(n[10]);
}

export function errorCuit(v) {
  if (!v?.trim()) return "";
  if (!/^[\d\s.-]+$/.test(v.trim())) return "El CUIT solo puede tener números y guiones";
  const n = numeros(v);
  if (n.length !== 11) return "El CUIT tiene que tener 11 números (ej.: 20-12345678-3)";
  return cuitValido(n) ? "" : "El CUIT no es válido: revisá los números";
}

export function errorImei(v) {
  if (!v?.trim()) return "";
  if (!/^[\d\s-]+$/.test(v.trim())) return "El IMEI solo puede tener números";
  const n = numeros(v);
  if (n.length !== 15) return `El IMEI tiene que tener 15 números (tiene ${n.length})`;
  return imeiValido(n) ? "" : "El IMEI no es válido: revisá los números (se ve marcando *#06#)";
}

// Primer error de una lista de [valor, validador]
export const primerError = (...pares) => pares.map(([v, f]) => f(v)).find(Boolean) || "";

// Fechas "AAAA-MM-DD" (se comparan como texto): "hasta" antes que "desde"
export const rangoInvertido = (desde, hasta) => !!desde && !!hasta && hasta < desde;
