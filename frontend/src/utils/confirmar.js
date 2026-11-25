// Confirmaciones del sistema ("¿Estás seguro de que querés…?"), con la misma
// ventana en todas las pantallas. Uso:
//   if (!(await confirmar({ mensaje: "¿Estás seguro de que querés cancelar la venta?", peligro: true }))) return;
// Opciones: titulo, mensaje, detalle, textoConfirmar, textoCancelar, peligro.
let abrirVentana = null;

export function registrarConfirmacion(fn) {
  abrirVentana = fn;
  return () => {
    if (abrirVentana === fn) abrirVentana = null;
  };
}

export function confirmar(opciones) {
  const o = typeof opciones === "string" ? { mensaje: opciones } : opciones;
  // Sin la ventana montada (no debería pasar), se usa la del navegador
  if (!abrirVentana) return Promise.resolve(window.confirm(o.mensaje));
  return new Promise((resolve) => abrirVentana({ ...o, resolve }));
}
