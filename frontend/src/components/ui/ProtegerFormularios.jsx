import { useEffect } from "react";
import { confirmar } from "../../utils/confirmar";

// Comportamiento común de todas las ventanas (se monta una sola vez en App):
// - Escape cierra la ventana de arriba de todo, como su botón de cerrar.
// - Si en la ventana se cargó algo, cerrarla con la X o "Cancelar" (o con
//   Escape) pregunta antes de perder lo cargado.
// Los botones que cierran una ventana llevan el atributo data-cerrar.
const VENTANA = ".fixed.inset-0:not([role=alertdialog])";
const sucias = new WeakSet();

// Escribir en un buscador no cuenta como "cargar algo"
const esBuscador = (el) =>
  el.type === "search" || /^buscar/i.test(el.getAttribute?.("placeholder") || "");

function ventanaDe(el) {
  const v = el?.closest?.(VENTANA);
  return v && !el.closest("[role=alertdialog]") ? v : null;
}

function ventanaDeArriba() {
  const visibles = [...document.querySelectorAll(VENTANA)].filter(
    (v) => v.offsetParent !== null || getComputedStyle(v).position === "fixed",
  );
  const z = (v) => parseInt(getComputedStyle(v).zIndex, 10) || 0;
  // La de mayor z-index; a igual z-index, la última del documento
  return visibles.reduce((arriba, v) => (!arriba || z(v) >= z(arriba) ? v : arriba), null);
}

function botonCerrar(ventana) {
  return (
    ventana.querySelector("[data-cerrar]") ||
    ventana.querySelector('button[aria-label^="Cerrar"]') ||
    [...ventana.querySelectorAll("button")].find((b) => /^(Cerrar|Cancelar)$/.test(b.textContent.trim()))
  );
}

export default function ProtegerFormularios() {
  useEffect(() => {
    const alCambiar = (e) => {
      const v = ventanaDe(e.target);
      if (v && !esBuscador(e.target)) sucias.add(v);
    };

    const alHacerClic = (e) => {
      const boton = e.target.closest?.("[data-cerrar]");
      if (!boton) return;
      if (boton.dataset.forzar) {
        delete boton.dataset.forzar;
        return;
      }
      const v = ventanaDe(boton);
      if (!v || !sucias.has(v)) return;
      e.preventDefault();
      e.stopPropagation();
      confirmar({
        titulo: "Descartar cambios",
        mensaje: "¿Estás seguro de que querés cerrar sin guardar?",
        detalle: "Se pierde lo que cargaste en esta ventana.",
        textoConfirmar: "Sí, descartar",
        textoCancelar: "No, seguir editando",
        peligro: true,
      }).then((si) => {
        if (!si || !boton.isConnected) return;
        sucias.delete(v);
        boton.dataset.forzar = "1";
        boton.click();
      });
    };

    const alTeclear = (e) => {
      if (e.key !== "Escape") return;
      // Se decide después de que los demás atiendan la tecla (un menú o un
      // buscador que la usan para cerrarse llaman a preventDefault)
      setTimeout(() => {
        if (e.defaultPrevented || document.querySelector("[role=alertdialog]")) return;
        const v = ventanaDeArriba();
        const boton = v && botonCerrar(v);
        if (boton && !boton.disabled) boton.click();
      }, 0);
    };

    document.addEventListener("input", alCambiar, true);
    document.addEventListener("change", alCambiar, true);
    document.addEventListener("click", alHacerClic, true);
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("input", alCambiar, true);
      document.removeEventListener("change", alCambiar, true);
      document.removeEventListener("click", alHacerClic, true);
      window.removeEventListener("keydown", alTeclear);
    };
  }, []);
  return null;
}
