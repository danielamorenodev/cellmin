import { useEffect, useState } from "react";
import { X, Ban, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import toast from "react-hot-toast";
import { proveedoresService } from "../services/proveedores.service";
import { formatCurrency, formatDateTime, mensajeError, textoSaldo } from "../utils/helpers";
import InputNumero from "./ui/InputNumero";

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
];

// Cuenta corriente de un proveedor: saldo, carga de deudas y pagos, historial
export default function CuentaProveedor({ proveedor, esAdmin, onClose, onCambio }) {
  const [cuenta, setCuenta] = useState(null);
  const [tipo, setTipo] = useState("deuda");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [metodo, setMetodo] = useState("transferencia");
  const [guardando, setGuardando] = useState(false);
  const [verAnulados, setVerAnulados] = useState(false);

  const cargar = () =>
    proveedoresService
      .getCuenta(proveedor.id)
      .then(setCuenta)
      .catch((e) => toast.error(mensajeError(e, "No se pudo cargar la cuenta")));

  useEffect(() => {
    let vivo = true;
    proveedoresService
      .getCuenta(proveedor.id)
      .then((c) => vivo && setCuenta(c))
      .catch((e) => toast.error(mensajeError(e, "No se pudo cargar la cuenta")));
    return () => {
      vivo = false;
    };
  }, [proveedor.id]);

  const guardar = async (e) => {
    e.preventDefault();
    const valor = parseFloat(monto);
    if (!(valor > 0)) {
      toast.error("Ingresá un monto mayor a 0");
      return;
    }
    if (tipo === "deuda" && !concepto.trim()) {
      toast.error("Indicá el concepto (por ejemplo, el número de factura)");
      return;
    }
    setGuardando(true);
    try {
      await proveedoresService.agregarMovimiento(proveedor.id, {
        tipo,
        monto: valor,
        concepto: concepto.trim() || null,
        metodo: tipo === "pago" ? metodo : null,
      });
      toast.success(tipo === "deuda" ? "Deuda registrada" : "Pago registrado");
      setMonto("");
      setConcepto("");
      await cargar();
      onCambio?.();
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo registrar"));
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (mov) => {
    if (!confirm(`¿Anular ${mov.tipo === "deuda" ? "la deuda" : "el pago"} de ${formatCurrency(mov.monto)}?`)) return;
    try {
      await proveedoresService.anularMovimiento(proveedor.id, mov.id);
      toast.success("Movimiento anulado");
      await cargar();
      onCambio?.();
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo anular"));
    }
  };

  const saldo = cuenta?.saldo_deuda ?? proveedor.saldo_deuda ?? 0;
  const estado = textoSaldo(saldo);
  const movimientos = (cuenta?.movimientos || []).filter((m) => verAnulados || !m.anulado);
  const hayAnulados = (cuenta?.movimientos || []).some((m) => m.anulado);
  const campo =
    "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Cuenta de {proveedor.nombre}</h2>
            <p className={`text-sm font-semibold mt-0.5 ${estado.color}`}>{estado.texto}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          <form onSubmit={guardar} className="rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm" role="group">
              {[
                { v: "deuda", t: "Se le debe (deuda)" },
                { v: "pago", t: "Le pagamos (pago)" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  aria-pressed={tipo === o.v}
                  onClick={() => setTipo(o.v)}
                  className={`px-3 py-1.5 transition ${
                    tipo === o.v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Monto ($) *</label>
                <InputNumero value={monto} onChange={setMonto} min="0" step="0.01" className={campo} />
              </div>
              {tipo === "pago" && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Cómo se pagó</label>
                  <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={campo}>
                    {METODOS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={tipo === "pago" ? "" : "sm:col-span-2"}>
                <label className="block text-xs text-gray-600 mb-1">
                  {tipo === "deuda" ? "Concepto *" : "Detalle"}
                </label>
                <input
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder={tipo === "deuda" ? "Factura, remito, mercadería..." : "Opcional"}
                  className={campo}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={guardando}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-400"
              >
                {guardando ? "Guardando..." : tipo === "deuda" ? "Registrar deuda" : "Registrar pago"}
              </button>
            </div>
          </form>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Movimientos</p>
              {hayAnulados && (
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={verAnulados} onChange={(e) => setVerAnulados(e.target.checked)} />
                  Ver anulados
                </label>
              )}
            </div>
            {!cuenta ? (
              <p className="text-sm text-gray-500 text-center py-6">Cargando...</p>
            ) : movimientos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                Todavía no hay deudas ni pagos registrados.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                {movimientos.map((m) => (
                  <li key={m.id} className={`flex items-center gap-3 px-3 py-2.5 ${m.anulado ? "opacity-50" : ""}`}>
                    {m.tipo === "deuda" ? (
                      <ArrowUpCircle size={18} className="text-red-500 shrink-0" />
                    ) : (
                      <ArrowDownCircle size={18} className="text-green-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm text-gray-800 ${m.anulado ? "line-through" : ""}`}>
                        {m.tipo === "deuda" ? "Deuda" : "Pago"}
                        {m.metodo ? ` · ${METODOS.find((x) => x.value === m.metodo)?.label || m.metodo}` : ""}
                        {m.concepto ? ` — ${m.concepto}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(m.fecha)}
                        {m.usuario_nombre ? ` · ${m.usuario_nombre}` : ""}
                        {m.anulado ? " · Anulado" : ""}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold whitespace-nowrap ${m.tipo === "deuda" ? "text-red-700" : "text-green-700"}`}
                    >
                      {m.tipo === "deuda" ? "+" : "−"} {formatCurrency(m.monto)}
                    </span>
                    {esAdmin && !m.anulado && !m.compra_id && (
                      <button
                        onClick={() => anular(m)}
                        title="Anular (cargado por error)"
                        aria-label="Anular movimiento"
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Ban size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
