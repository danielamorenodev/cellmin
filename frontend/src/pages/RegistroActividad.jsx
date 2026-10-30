import { useEffect, useState } from "react";
import { ShieldAlert, Bug, Activity, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import Paginacion from "../components/ui/Paginacion";
import { useTabla } from "../hooks/useTabla";
import { formatDateTime, fechaLocalISO, sumarDias } from "../utils/helpers";

const TIPOS = {
  actividad: { label: "Actividad", clase: "bg-blue-50 text-blue-700", icono: Activity },
  ingreso_fallido: { label: "Ingreso fallido", clase: "bg-amber-50 text-amber-700", icono: ShieldAlert },
  error: { label: "Error del sistema", clase: "bg-red-50 text-red-700", icono: Bug },
};

const MODULOS = {
  autenticacion: "Ingreso al sistema",
  ventas: "Ventas",
  caja: "Caja",
  reparaciones: "Reparaciones",
  productos: "Productos",
  compras: "Ingresos de mercadería",
  stock: "Stock",
  remitos: "Remitos",
  usuarios: "Usuarios",
  tarjetas: "Medios de pago",
  cotizacion: "Dólar",
  sistema: "Sistema",
};

// Configuración → Registro de actividad: quién hizo qué y cuándo, los
// intentos de ingreso con contraseña incorrecta y los errores del sistema
export default function RegistroActividad() {
  const [eventos, setEventos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState({
    desde: sumarDias(-7),
    hasta: fechaLocalISO(),
    tipo: "",
    modulo: "",
    usuario: "",
    texto: "",
  });

  useEffect(() => {
    api.get("/actividad/resumen").then((r) => setResumen(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let vigente = true;
    const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    const t = setTimeout(() => {
      api
        .get(`/actividad?${params}`)
        .then((r) => vigente && setEventos(r.data))
        .catch(() => toast.error("Error al cargar el registro"))
        .finally(() => vigente && setCargando(false));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [filtros]);

  const tabla = useTabla(eventos, { porPagina: 25, ordenInicial: { campo: "fecha", dir: "desc" } });
  const campo =
    "px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const verTipo = (tipo) => setFiltros({ ...filtros, tipo, desde: sumarDias(-7), hasta: fechaLocalISO() });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Registro de actividad</h1>
        <p className="text-sm text-gray-500">
          Quién hizo qué y cuándo, los intentos de ingreso fallidos y los errores del sistema. Se guarda un año.
        </p>
      </div>

      {resumen && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => verTipo("ingreso_fallido")}
            className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:border-amber-300"
          >
            <ShieldAlert className="text-amber-600" size={22} />
            <span className="text-sm text-gray-700">
              <span className="font-semibold">{resumen.ingresos_fallidos}</span> intentos de ingreso fallidos en los
              últimos 7 días
            </span>
          </button>
          <button
            onClick={() => verTipo("error")}
            className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:border-red-300"
          >
            <Bug className="text-red-600" size={22} />
            <span className="text-sm text-gray-700">
              <span className="font-semibold">{resumen.errores}</span> errores del sistema en los últimos 7 días
            </span>
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs text-gray-600">
          Desde
          <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} className={`${campo} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-600">
          Hasta
          <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} className={`${campo} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-600">
          Tipo
          <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} className={`${campo} w-full mt-1`}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Módulo
          <select value={filtros.modulo} onChange={(e) => setFiltros({ ...filtros, modulo: e.target.value })} className={`${campo} w-full mt-1`}>
            <option value="">Todos</option>
            {(resumen?.modulos || []).map((m) => (
              <option key={m} value={m}>{MODULOS[m] || m}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Usuario
          <select value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} className={`${campo} w-full mt-1`}>
            <option value="">Todos</option>
            {(resumen?.usuarios || []).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Buscar
          <span className="relative block mt-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filtros.texto}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
              placeholder="N° de venta, email..."
              className={`${campo} w-full pl-8`}
            />
          </span>
        </label>
      </div>

      {cargando ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Fecha y hora</th>
                  <th className="text-left font-medium px-3 py-3">Tipo</th>
                  <th className="text-left font-medium px-3 py-3">Usuario</th>
                  <th className="text-left font-medium px-3 py-3">Módulo</th>
                  <th className="text-left font-medium px-4 py-3">Qué pasó</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabla.filas.map((e) => {
                  const t = TIPOS[e.tipo] || TIPOS.actividad;
                  const Icono = t.icono;
                  return (
                    <tr key={e.id} className="align-top">
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDateTime(e.fecha)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${t.clase}`}>
                          <Icono size={12} /> {t.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap">
                        {e.usuario_nombre || "—"}
                        {e.ip && <span className="block text-xs text-gray-400">{e.ip}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{MODULOS[e.modulo] || e.modulo || "—"}</td>
                      <td className="px-4 py-2 text-gray-700">{e.descripcion}</td>
                    </tr>
                  );
                })}
                {tabla.filas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No hay registros con esos filtros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Paginacion total={tabla.total} porPagina={tabla.porPagina} paginaActual={tabla.pagina} onChange={tabla.setPagina} />
        </>
      )}
    </div>
  );
}
