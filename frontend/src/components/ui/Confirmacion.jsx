import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { registrarConfirmacion } from "../../utils/confirmar";

// Ventana de confirmación común a todo el sistema (se monta una sola vez en App)
export default function Confirmacion() {
  const [pedido, setPedido] = useState(null);
  const botonCancelar = useRef(null);
  const botonConfirmar = useRef(null);

  useEffect(() => registrarConfirmacion(setPedido), []);

  useEffect(() => {
    if (!pedido) return;
    // En una acción peligrosa queda seleccionado "No": un Enter por error no confirma
    (pedido.peligro ? botonCancelar : botonConfirmar).current?.focus();
    const tecla = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        responder(false);
      }
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  });

  if (!pedido) return null;

  function responder(si) {
    pedido.resolve(si);
    setPedido(null);
  }

  const Icono = pedido.peligro ? AlertTriangle : HelpCircle;
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmacion-titulo"
      aria-describedby="confirmacion-mensaje"
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 space-y-5">
        <div className="flex gap-4">
          <div
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              pedido.peligro ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            }`}
          >
            <Icono size={20} />
          </div>
          <div className="space-y-1.5 min-w-0">
            <h2 id="confirmacion-titulo" className="text-base font-semibold text-gray-800">
              {pedido.titulo || "¿Estás seguro?"}
            </h2>
            <p id="confirmacion-mensaje" className="text-sm text-gray-700">
              {pedido.mensaje}
            </p>
            {pedido.detalle && <p className="text-sm text-gray-500">{pedido.detalle}</p>}
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            ref={botonCancelar}
            type="button"
            onClick={() => responder(false)}
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pedido.textoCancelar || "No, volver"}
          </button>
          <button
            ref={botonConfirmar}
            type="button"
            onClick={() => responder(true)}
            className={`flex-1 py-2 text-white rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              pedido.peligro
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
            }`}
          >
            {pedido.textoConfirmar || "Sí, confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
