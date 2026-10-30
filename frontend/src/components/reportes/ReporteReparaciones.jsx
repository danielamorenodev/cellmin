import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, Wrench, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import {
  ESTADOS_REP,
  SUCURSALES,
  formatCurrency,
  formatDateTime,
  formatFechaISO,
  fechaLocalISO,
  nombreSucursal,
} from "../../utils/helpers";

// Rango de fechas (AAAA-MM-DD) según el período elegido arriba en Reportes
function rango(periodo, desde, hasta) {
  if (desde && hasta) return [desde, hasta];
  const hoy = new Date();
  const fin = fechaLocalISO(hoy);
  if (periodo === "dia") return [fin, fin];
  if (periodo === "semana") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 7);
    return [fechaLocalISO(d), fin];
  }
  if (periodo === "año") return [`${hoy.getFullYear()}-01-01`, fin];
  return [fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), fin];
}

const promedio = (nums) => {
  const v = nums.filter((n) => n !== null && n !== undefined);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

const TERMINADAS = ["lista", "entregada"];

// Agrupa las órdenes por un campo (técnico, sucursal, quién atendió)
function agrupar(filas, campo, etiqueta) {
  const grupos = {};
  for (const f of filas) {
    const k = f[campo] || "Sin registrar";
    (grupos[k] ||= []).push(f);
  }
  return Object.entries(grupos)
    .map(([k, l]) => ({
      clave: k,
      nombre: etiqueta ? etiqueta(k) : k,
      ordenes: l.length,
      terminadas: l.filter((f) => TERMINADAS.includes(f.estado)).length,
      promedio: promedio(l.filter((f) => TERMINADAS.includes(f.estado)).map((f) => f.dias_en_taller)),
      atrasadas: l.filter((f) => f.dias_atraso > 0).length,
      tarde: l.filter((f) => TERMINADAS.includes(f.estado) && f.dias_diferencia > 0).length,
      facturado: l.filter((f) => f.estado !== "cancelada").reduce((a, f) => a + (f.precio_total || 0), 0),
    }))
    .sort((a, b) => b.ordenes - a.ordenes);
}

function Tarjeta({ titulo, valor, detalle, icono: Icono, color }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icono size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-800">{valor}</p>
        <p className="text-sm text-gray-600">{titulo}</p>
        {detalle && <p className="text-xs text-gray-500">{detalle}</p>}
      </div>
    </div>
  );
}

function TablaGrupo({ titulo, filas, onElegir, elegido }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
      <h3 className="px-4 pt-4 pb-2 font-semibold text-gray-700">{titulo}</h3>
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 bg-gray-50">
          <tr>
            <th className="text-left font-medium px-4 py-2">Nombre</th>
            <th className="text-right font-medium px-3 py-2">Órdenes</th>
            <th className="text-right font-medium px-3 py-2">Terminadas</th>
            <th className="text-right font-medium px-3 py-2" title="Días desde el ingreso hasta que quedó lista">
              Prom. días
            </th>
            <th className="text-right font-medium px-3 py-2">Atrasadas hoy</th>
            <th className="text-right font-medium px-4 py-2" title="Terminadas después de la fecha estimada">
              Fuera de término
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filas.map((f) => (
            <tr
              key={f.clave}
              onClick={onElegir ? () => onElegir(f.clave) : undefined}
              className={`${onElegir ? "cursor-pointer hover:bg-blue-50" : ""} ${elegido === f.clave ? "bg-blue-50" : ""}`}
            >
              <td className="px-4 py-2 text-gray-800">{f.nombre}</td>
              <td className="px-3 py-2 text-right">{f.ordenes}</td>
              <td className="px-3 py-2 text-right">{f.terminadas}</td>
              <td className="px-3 py-2 text-right">{f.promedio ?? "—"}</td>
              <td className={`px-3 py-2 text-right ${f.atrasadas ? "text-red-600 font-semibold" : ""}`}>{f.atrasadas}</td>
              <td className={`px-4 py-2 text-right ${f.tarde ? "text-orange-600 font-semibold" : ""}`}>{f.tarde}</td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-4 text-center text-gray-400">Sin órdenes en el período</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Reportes → Reparaciones: demoras, atrasos e historial por técnico,
// quién atendió, sucursal y cliente
export default function ReporteReparaciones({ periodo, desde: desdeP, hasta: hastaP }) {
  const [desde, hasta] = rango(periodo, desdeP, hastaP);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState({ tecnico: "", vendedor: "", sucursal: "", estado: "", cliente: "", atrasadas: false });

  useEffect(() => {
    let vigente = true;
    api
      .get(`/reports/reparaciones/detalle?desde=${desde}&hasta=${hasta}`)
      .then((r) => vigente && setFilas(r.data))
      .catch(() => toast.error("Error al cargar el reporte de reparaciones"))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [desde, hasta]);

  const terminadas = filas.filter((f) => TERMINADAS.includes(f.estado));
  const porTecnico = useMemo(() => agrupar(filas, "tecnico"), [filas]);
  const porSucursal = useMemo(() => agrupar(filas, "sucursal", nombreSucursal), [filas]);
  const porVendedor = useMemo(() => agrupar(filas, "vendedor"), [filas]);

  const t = filtro.cliente.trim().toLowerCase();
  const historial = filas.filter(
    (f) =>
      (!filtro.tecnico || (f.tecnico || "Sin registrar") === filtro.tecnico) &&
      (!filtro.vendedor || (f.vendedor || "Sin registrar") === filtro.vendedor) &&
      (!filtro.sucursal || f.sucursal === filtro.sucursal) &&
      (!filtro.estado || f.estado === filtro.estado) &&
      (!filtro.atrasadas || f.dias_atraso > 0 || f.dias_diferencia > 0) &&
      (!t || f.cliente.toLowerCase().includes(t) || (f.telefono || "").includes(t) || f.equipo.toLowerCase().includes(t)),
  );

  const campo =
    "px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (cargando) return <div className="text-center py-8 text-gray-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Órdenes que ingresaron entre el {formatFechaISO(desde)} y el {formatFechaISO(hasta)}.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta titulo="Órdenes ingresadas" valor={filas.length} icono={Wrench} color="bg-orange-500" />
        <Tarjeta
          titulo="Terminadas"
          valor={terminadas.length}
          detalle={`Promedio: ${promedio(terminadas.map((f) => f.dias_en_taller)) ?? "—"} días en el local`}
          icono={CheckCircle2}
          color="bg-green-500"
        />
        <Tarjeta
          titulo="Atrasadas hoy"
          valor={filas.filter((f) => f.dias_atraso > 0).length}
          detalle="Pasó la fecha estimada y no están listas"
          icono={AlertTriangle}
          color="bg-red-500"
        />
        <Tarjeta
          titulo="Terminadas fuera de término"
          valor={terminadas.filter((f) => f.dias_diferencia > 0).length}
          detalle="Quedaron listas después de lo prometido"
          icono={Clock}
          color="bg-amber-500"
        />
      </div>

      <TablaGrupo
        titulo="Por técnico (tocá una fila para ver su historial)"
        filas={porTecnico}
        elegido={filtro.tecnico}
        onElegir={(k) => setFiltro({ ...filtro, tecnico: filtro.tecnico === k ? "" : k })}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <TablaGrupo titulo="Por sucursal de ingreso" filas={porSucursal} />
        <TablaGrupo
          titulo="Por quién atendió"
          filas={porVendedor}
          elegido={filtro.vendedor}
          onElegir={(k) => setFiltro({ ...filtro, vendedor: filtro.vendedor === k ? "" : k })}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">Historial de reparaciones</h3>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={filtro.cliente}
                onChange={(e) => setFiltro({ ...filtro, cliente: e.target.value })}
                placeholder="Cliente, teléfono o equipo..."
                className={`${campo} w-full pl-9`}
              />
            </div>
            <select value={filtro.tecnico} onChange={(e) => setFiltro({ ...filtro, tecnico: e.target.value })} className={campo} aria-label="Técnico">
              <option value="">Todos los técnicos</option>
              {porTecnico.map((g) => (
                <option key={g.clave} value={g.clave}>{g.nombre}</option>
              ))}
            </select>
            <select value={filtro.vendedor} onChange={(e) => setFiltro({ ...filtro, vendedor: e.target.value })} className={campo} aria-label="Atendió">
              <option value="">Atendió: todos</option>
              {porVendedor.map((g) => (
                <option key={g.clave} value={g.clave}>{g.nombre}</option>
              ))}
            </select>
            <select value={filtro.sucursal} onChange={(e) => setFiltro({ ...filtro, sucursal: e.target.value })} className={campo} aria-label="Sucursal">
              <option value="">Todas las sucursales</option>
              {SUCURSALES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select value={filtro.estado} onChange={(e) => setFiltro({ ...filtro, estado: e.target.value })} className={campo} aria-label="Estado">
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS_REP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700 px-2">
              <input
                type="checkbox"
                checked={filtro.atrasadas}
                onChange={(e) => setFiltro({ ...filtro, atrasadas: e.target.checked })}
                className="w-4 h-4 text-blue-600"
              />
              Con atraso
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 bg-gray-50">
              <tr>
                <th className="text-left font-medium px-4 py-2">Orden</th>
                <th className="text-left font-medium px-3 py-2">Ingreso</th>
                <th className="text-left font-medium px-3 py-2">Cliente</th>
                <th className="text-left font-medium px-3 py-2">Equipo</th>
                <th className="text-left font-medium px-3 py-2">Técnico</th>
                <th className="text-left font-medium px-3 py-2">Atendió</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                <th className="text-left font-medium px-3 py-2">Entrega estimada</th>
                <th className="text-right font-medium px-3 py-2">Días</th>
                <th className="text-right font-medium px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historial.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2">
                    <a href={`/reparaciones/${f.id}`} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                      {f.numero_orden}
                    </a>
                    <span className="block text-xs text-gray-500">{nombreSucursal(f.sucursal)}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDateTime(f.fecha_ingreso).split(",")[0]}</td>
                  <td className="px-3 py-2 text-gray-800">{f.cliente || "-"}</td>
                  <td className="px-3 py-2 text-gray-700">{f.equipo}</td>
                  <td className="px-3 py-2 text-gray-700">{f.tecnico || "—"}</td>
                  <td className="px-3 py-2 text-gray-700">{f.vendedor || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${ESTADOS_REP[f.estado]?.color || ""}`}>
                      {ESTADOS_REP[f.estado]?.label || f.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatFechaISO(f.fecha_estimada_entrega) || "—"}
                    {f.dias_atraso > 0 && (
                      <span className="block text-xs font-medium text-red-600">Atrasada {f.dias_atraso} d</span>
                    )}
                    {f.dias_atraso === 0 && f.dias_diferencia > 0 && (
                      <span className="block text-xs font-medium text-orange-600">Terminó {f.dias_diferencia} d tarde</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right" title="Días en el local">{f.dias_en_taller ?? "—"}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{formatCurrency(f.precio_total || 0)}</td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-400">No hay órdenes con esos filtros</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
