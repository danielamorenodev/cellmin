import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { CircleDollarSign, AlertTriangle, Save, RefreshCw, Globe } from "lucide-react";
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
  // InfoDolar (dólar blue en Córdoba): consulta en el momento y modo automático
  const [externa, setExterna] = useState(null); // { compra, venta } o { error }
  const [consultando, setConsultando] = useState(false);
  const [auto, setAuto] = useState(null);

  const cargarHistorial = () =>
    cotizacionService
      .getHistorial()
      .then(setHistorial)
      .catch(() => {});

  useEffect(() => {
    cargarHistorial();
    cotizacionService.getAutomatica().then(setAuto).catch(() => {});
  }, []);

  const consultar = async () => {
    setConsultando(true);
    try {
      setExterna(await cotizacionService.consultarInfodolar());
    } catch (error) {
      setExterna({ error: error.response?.data?.detail || "No se pudo consultar InfoDolar" });
    } finally {
      setConsultando(false);
    }
  };

  const usar = async (cual) => {
    try {
      const r = await cotizacionService.usarInfodolar(cual);
      await refrescarCotizacion();
      await cargarHistorial();
      toast.success(
        r.sin_cambios
          ? "El valor de InfoDolar es el mismo que ya estaba cargado."
          : `Dólar actualizado con el blue de Córdoba (${cual}): ${formatCurrency(r.venta)}`,
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo usar el valor de InfoDolar");
    }
  };

  const cambiarAuto = async (activa, cual) => {
    try {
      setAuto(await cotizacionService.setAutomatica(activa, cual));
      toast.success(
        activa
          ? `Actualización automática activada (valor de ${cual})`
          : "Actualización automática desactivada: el valor se carga a mano",
      );
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo cambiar la configuración");
    }
  };

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
          Traé el dólar blue de Córdoba desde InfoDolar o cargalo a mano. Al
          guardarlo, los precios en USD y los cobros en dólares usan este valor.
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
              {cotizacion.fuente && (
                <p className="text-xs text-gray-500 mt-1">{cotizacion.fuente}</p>
              )}
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
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

      {/* InfoDolar: blue de Córdoba */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Globe size={18} className="text-blue-600" /> Dólar blue en Córdoba (InfoDolar)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              El sistema consulta la página de InfoDolar para Córdoba. Si no responde, se sigue usando
              el valor cargado y se puede cargar a mano.
            </p>
          </div>
          <button
            type="button"
            onClick={consultar}
            disabled={consultando}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-50 disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw size={16} className={consultando ? "animate-spin" : ""} />
            {consultando ? "Consultando..." : "Consultar ahora"}
          </button>
        </div>

        {externa?.error && (
          <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
            <AlertTriangle size={16} className="shrink-0" /> {externa.error}
          </p>
        )}
        {externa && !externa.error && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["compra", "Compra", "Lo que pagan las casas de cambio por cada dólar"],
              ["venta", "Venta", "Lo que cobran las casas de cambio por cada dólar"],
            ].map(([k, t, ayuda]) => (
              <div key={k} className="rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase">{t}</p>
                  <p className="text-2xl font-bold text-gray-800">{formatCurrency(externa[k])}</p>
                  <p className="text-xs text-gray-500">{ayuda}</p>
                </div>
                <button
                  type="button"
                  onClick={() => usar(k)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap"
                >
                  Usar este valor
                </button>
              </div>
            ))}
          </div>
        )}

        {auto && (
          <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={auto.activa}
                onChange={(e) => cambiarAuto(e.target.checked, auto.usar)}
                className="w-4 h-4 text-blue-600"
              />
              Actualizar sola cada 30 minutos (lunes a sábado, de 9 a 21 h) con el valor de
            </label>
            <select
              value={auto.usar}
              onChange={(e) => cambiarAuto(auto.activa, e.target.value)}
              aria-label="Valor que se usa"
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="venta">venta</option>
              <option value="compra">compra</option>
            </select>
          </div>
        )}
        {auto?.activa && auto.ultimo_intento && (
          <p className={`text-xs ${auto.ultimo_error ? "text-red-600" : "text-gray-500"}`}>
            Última consulta automática: {formatDateTime(auto.ultimo_intento)}
            {auto.ultimo_error ? ` · ${auto.ultimo_error}` : " · sin problemas"}
          </p>
        )}
        <p className="text-xs text-gray-400">
          Si un valor traído se aleja más de un 25 % del actual, no se aplica solo: hay que revisarlo y cargarlo a mano.
        </p>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <CircleDollarSign size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Historial de cambios</h2>
        </div>
        {historial.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-10">
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
                  Origen
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
                  <td className="px-6 py-3 text-xs text-gray-500">{h.fuente}</td>
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
