import { useEffect } from "react";

const CLASES = ["col-num", "col-centro", "col-acc"];

// Copia la alineación de cada columna (clase en las celdas td) a su
// encabezado (th), para que título y datos queden siempre alineados igual.
function sincronizar(tabla) {
  const filaTitulos = tabla.querySelector("thead tr:last-child");
  if (!filaTitulos) return;
  const fila = Array.from(tabla.querySelectorAll("tbody > tr")).find(
    (tr) => tr.children.length > 0 && !tr.querySelector("td[colspan]")
  );
  if (!fila) return;
  const celdas = Array.from(fila.children);
  let col = 0;
  Array.from(filaTitulos.children).forEach((th) => {
    const td = celdas[col];
    col += th.colSpan || 1;
    CLASES.forEach((c) => {
      const debe = !!td && td.classList.contains(c);
      if (th.classList.contains(c) !== debe) th.classList.toggle(c, debe);
    });
  });
}

export default function AlineacionTablas() {
  useEffect(() => {
    let pendiente = false;
    const correr = () => {
      pendiente = false;
      document.querySelectorAll("table").forEach(sincronizar);
    };
    const programar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(correr);
    };
    programar();
    const obs = new MutationObserver(programar);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return null;
}
