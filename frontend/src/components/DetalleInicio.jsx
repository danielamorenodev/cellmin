import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import api from "../services/api";
import {
  ESTADOS_REP,
  formatCurrency,
  formatDateTime,
  formatFechaISO,
  nombreSucursal,
  parsearMetodoPago,
} from "../utils/helpers";

const TITULOS = {
  reparaciones: "Reparaciones activas",
  ventas: "Ventas de hoy",
  stock: "Productos con stock bajo",
};
const DESTINO = { reparaciones: "/reparaciones", ventas: "/ventas", stock: "/productos" };

// Lo que hay detrás de cada número del Inicio: se abre debajo de las tarjetas
export default function DetalleInicio({ tipo, onClose }) {
  const [filas, setFilas] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let vigente = true;
    api
      .get(`/reports/dashboard/detalle/${tipo}`)
      .then((r) => vigente && setFilas(r.data))
      .catch(() => vigente && setFilas([]));
    return () => {
      vigente = false;
    };
  }, [tipo]);

  const th = "text-left font-medium px-3 py-2 whitespace-nowrap";
  const td = "px-3 py-2";

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">
          {TITULOS[tipo]} {filas && <span className="text-gray-400 font-normal">({filas.length})</span>}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(DESTINO[tipo])}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            Ir a la sección <ArrowRight size={14} />
          </button>
          <button onClick={onClose} aria-label="Cerrar detalle" className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
      </div>
      {!filas ? (
        <p className="px-5 py-6 text-sm text-gray-500">Cargando...</p>
      ) : filas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">No hay nada para mostrar.</p>
      ) : (
        <div className="overflow-x-auto max-h-[28rem]">
          <table className="w-full text-sm">
            {tipo === "reparaciones" && (
              <>
                <thead className="text-xs text-gray-500 bg-gray-50 sticky top-0">
                  <tr>
                    <th className={th}>Orden</th>
                    <th className={th}>Cliente</th>
                    <th className={th}>Equipo</th>
                    <th className={th}>Estado</th>
                    <th className={th}>Técnico a cargo</th>
                    <th className={`${th} text-right`}>Días en el local</th>
                    <th className={th}>Entrega estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => navigate(`/reparaciones/${f.id}`)}
                      className={`cursor-pointer hover:bg-gray-50 ${f.dias_atraso > 0 ? "bg-red-50/40" : ""}`}
                    >
                      <td className={td}>
                        <span className="font-medium text-blue-600">{f.numero_orden}</span>
                        <span className="block text-xs text-gray-500">{nombreSucursal(f.sucursal)}</span>
                      </td>
                      <td className={td}>{f.cliente || "-"}</td>
                      <td className={td}>{f.equipo}</td>
                      <td className={td}>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${ESTADOS_REP[f.estado]?.color || ""}`}>
                          {ESTADOS_REP[f.estado]?.label || f.estado}
                        </span>
                      </td>
                      <td className={td}>{f.tecnico || <span className="text-gray-400">Sin asignar</span>}</td>
                      <td className={`${td} text-right`}>{f.dias_en_taller ?? "-"}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {formatFechaISO(f.fecha_estimada_entrega) || "-"}
                        {f.dias_atraso > 0 && (
                          <span className="block text-xs font-semibold text-red-600">
                            Atrasada {f.dias_atraso} {f.dias_atraso === 1 ? "día" : "días"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tipo === "ventas" && (
              <>
                <thead className="text-xs text-gray-500 bg-gray-50 sticky top-0">
                  <tr>
                    <th className={th}>Venta</th>
                    <th className={th}>Hora</th>
                    <th className={th}>Sucursal</th>
                    <th className={th}>Vendió</th>
                    <th className={th}>Medio de pago</th>
                    <th className={`${th} text-right`}>Artículos</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map((f) => (
                    <tr key={f.id} onClick={() => navigate(`/ventas/${f.id}`)} className="cursor-pointer hover:bg-gray-50">
                      <td className={`${td} font-medium text-blue-600`}>{f.numero_venta}</td>
                      <td className={td}>{formatDateTime(f.fecha).split(", ")[1] || formatDateTime(f.fecha)}</td>
                      <td className={td}>{nombreSucursal(f.sucursal)}</td>
                      <td className={td}>{f.vendedor || "-"}</td>
                      <td className={td}>{parsearMetodoPago(f.metodo_pago).partes.map((p) => p.metodo).join(" + ")}</td>
                      <td className={`${td} text-right`}>{f.articulos}</td>
                      <td className={`${td} text-right font-medium`}>{formatCurrency(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tipo === "stock" && (
              <>
                <thead className="text-xs text-gray-500 bg-gray-50 sticky top-0">
                  <tr>
                    <th className={th}>Producto</th>
                    <th className={th}>Sucursal</th>
                    <th className={`${th} text-right`}>Stock</th>
                    <th className={`${th} text-right`}>Mínimo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map((f, i) => (
                    <tr key={i}>
                      <td className={td}>
                        {f.nombre}
                        {f.variante && <span className="text-gray-500"> — {f.variante}</span>}
                      </td>
                      <td className={td}>{nombreSucursal(f.sucursal)}</td>
                      <td className={`${td} text-right font-semibold text-red-600`}>{f.stock_actual}</td>
                      <td className={`${td} text-right text-gray-500`}>{f.stock_minimo}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
