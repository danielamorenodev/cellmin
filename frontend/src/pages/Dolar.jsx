import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { CircleDollarSign, AlertTriangle, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { cotizacionService } from "../services/cotizacion.service";
import { useCotizacion, refrescarCotizacion } from "../hooks/useCotizacion";
import InputNumero from "../components/ui/InputNumero";
import { formatCurrency, formatDateTime } from "../utils/helpers";

export default function Dolar() {
  const { user } = useAuth();
  const cotizacion = useCotizacion();
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState([]);

  const cargarHistorial = () =>
    cotizacionService
      .getHistorial()
      .then(setHistorial)
      .catch(() => {});

  useEffect(() => {
    cargarHistorial();
  }, []);

  if (user && user.rol !== "administrador") {
    return <Navigate to="/dashboard" replace />;
  }

  const valorNumero = Number(valor) || 0;
  const igualAlActual =
    cotizacion.disponible && valorNumero === Number(cotizacion.venta);
  const puedeGuardar = valorNumero > 0 && !igualAlActual && !guardando;

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      await cotizacionService.guardar(valorNumero);
      await refrescarCotizacion();
      await cargarHistorial();
      setValor("");
      toast.success("Dólar actualizado. Los precios en USD ya se recalcularon.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo guardar el valor");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dólar</h1>
        <p className="text-gray-500 text-sm mt-1">
          Cargá el valor del dólar. Al guardarlo, los precios en USD y los
          cobros en dólares usan este valor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Valor vigente */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Valor actual
          </p>
          {cotizacion.disponible ? (
            <>
              <p className="text-4xl font-bold text-gray-800 mt-2 tabular">
                {formatCurrency(cotizacion.venta)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {cotizacion.fecha
                  ? `Cargado el ${formatDateTime(cotizacion.fecha)}`
                  : "Cargado"}
                {cotizacion.actualizada_por
                  ? ` por ${cotizacion.actualizada_por}`
                  : ""}
              </p>
              {cotizacion.obsoleta && (
                <p className="mt-3 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 rounded-xl px-3 py-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  Este valor no se actualizó hoy. Revisalo antes de cobrar en
                  dólares.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
              <AlertTriangle size={16} className="shrink-0" />
              Todavía no hay un valor cargado. Sin él no se muestran precios en
              USD ni se puede cobrar en dólares.
            </p>
          )}
        </div>

        {/* Cargar nuevo valor */}
        <form
          onSubmit={handleGuardar}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
              Nuevo valor (1 USD en pesos)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <InputNumero
                value={valor}
                onChange={setValor}
                decimales={2}
                placeholder="0,00"
                className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {igualAlActual && (
              <p className="text-xs text-gray-500 mt-2">
                Es el mismo valor que ya está cargado.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!puedeGuardar}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {guardando ? "Guardando..." : "Guardar valor"}
          </button>
        </form>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <CircleDollarSign size={18} className="text-gray-400" />
          <h2 className="font-semibold text-gray-800">Historial de cambios</h2>
        </div>
        {historial.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">
            Todavía no hay cambios registrados
          </p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Cargado por
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Valor anterior
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Valor nuevo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historial.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-[background-color]">
                  <td className="col-centro px-6 py-3 text-sm text-gray-600">
                    {formatDateTime(h.fecha)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {h.usuario}
                  </td>
                  <td className="col-num px-6 py-3 text-sm text-gray-500">
                    {h.anterior != null ? formatCurrency(h.anterior) : "-"}
                  </td>
                  <td className="col-num px-6 py-3 text-sm font-semibold text-gray-800">
                    {formatCurrency(h.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
