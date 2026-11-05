import { useState } from "react";
import { Mail, X } from "lucide-react";
import toast from "react-hot-toast";
import { mensajeError } from "../../utils/helpers";

// Casilla "Enviar por email" con el email a usar (precargado con el del cliente).
// Si el email se cambia, se envía a ese; si el cliente no tenía, se le guarda.
export function CampoEnviarEmail({ activo, onActivo, email, onEmail, emailCliente, hayCliente = true, que = "el comprobante" }) {
  return (
    <div className="rounded-xl border border-gray-200 px-3 py-2.5 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => onActivo(e.target.checked)}
          className="w-4 h-4 text-blue-600"
        />
        <Mail size={15} className="text-gray-500" />
        Enviar {que} por email al cliente
      </label>
      {activo && (
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder={emailCliente || "email@ejemplo.com"}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            {!hayCliente
              ? "Sin cliente elegido: se envía a este email."
              : emailCliente
                ? "Precargado con el email del cliente. Podés cambiarlo."
                : "El cliente no tiene email: el que escribas se le guarda."}
          </p>
        </div>
      )}
    </div>
  );
}

// Modal para enviar (o reenviar) una orden o ticket ya registrado
export function EnviarEmailModal({ titulo, emailInicial, onEnviar, onClose }) {
  const [email, setEmail] = useState(emailInicial || "");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await onEnviar(email.trim());
      toast.success(`Enviado por email a ${r?.destino || email}`);
      onClose();
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo enviar el email"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <form onSubmit={enviar} className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Mail size={18} /> {titulo}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="envio-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email del cliente
            </label>
            <input
              id="envio-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={enviando} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-400">
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
