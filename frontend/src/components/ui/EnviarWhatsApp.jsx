import { useState } from "react";
import { MessageCircle, X, Printer } from "lucide-react";
import { telefonoWhatsApp, telefonoValido, linkWhatsApp } from "../../utils/whatsapp";

// Ventana para mandar un ticket o una orden por WhatsApp: el número del
// cliente (ya en el formato de WhatsApp, se puede corregir) y el mensaje
// armado (se puede editar). "Abrir WhatsApp" abre la app con el chat del
// cliente y el mensaje escrito: solo falta tocar enviar.
// Con "copiaTecnico", además se imprime la copia del técnico de la orden:
// - "obligatoria": se imprime siempre (al crear la orden).
// - "opcional": casilla marcada que se puede destildar (al reenviar).
// - "impresa": ya se imprimió (al crear la orden); solo se avisa.
export default function EnviarWhatsApp({ titulo, telefono, mensaje, copiaTecnico, onImprimirTecnico, onClose }) {
  // Lo que se escribe queda tal cual; el número para WhatsApp se calcula aparte
  const [entrada, setEntrada] = useState(telefono || "");
  const numero = telefonoWhatsApp(entrada);
  const [texto, setTexto] = useState(mensaje);
  const [imprimir, setImprimir] = useState(copiaTecnico === "opcional");
  const listo = telefonoValido(numero);

  const abrir = () => {
    window.open(linkWhatsApp(numero, texto), "_blank", "noopener");
    if (copiaTecnico === "obligatoria" || imprimir) onImprimirTecnico?.();
    onClose();
  };

  const campo =
    "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <MessageCircle size={18} className="text-green-600" /> {titulo}
          </h2>
          <button data-cerrar onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="wa-numero" className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp del cliente
            </label>
            <input
              id="wa-numero"
              inputMode="tel"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="Ej.: 351 555 1234"
              className={campo}
            />
            <p className={`text-[11px] mt-1 ${listo || !numero ? "text-gray-500" : "text-red-600"}`}>
              {!numero
                ? "El cliente no tiene teléfono cargado: escribilo con código de área."
                : listo
                  ? `Se abre el chat con +${numero}.`
                  : "Falta el código de área (por ejemplo 351) o el número está incompleto."}
            </p>
          </div>
          <div>
            <label htmlFor="wa-mensaje" className="block text-sm font-medium text-gray-700 mb-1">
              Mensaje
            </label>
            <textarea
              id="wa-mensaje"
              rows={10}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className={`${campo} font-mono text-xs leading-relaxed`}
            />
          </div>
          {(copiaTecnico === "obligatoria" || copiaTecnico === "impresa") && (
            <p className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <Printer size={14} />
              {copiaTecnico === "impresa" ? "La copia del técnico ya se mandó a imprimir." : "Se imprime la copia del técnico."}
            </p>
          )}
          {copiaTecnico === "opcional" && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={imprimir}
                onChange={(e) => setImprimir(e.target.checked)}
                className="w-4 h-4"
              />
              <Printer size={15} className="text-gray-500" /> Imprimir la copia del técnico
            </label>
          )}
          <div className="flex gap-3">
            <button data-cerrar
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!listo || !texto.trim()}
              onClick={abrir}
              className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700 disabled:bg-green-300 flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} /> Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
