import { useMemo, useState } from "react";
import { Search, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency, formatDate } from "../../utils/helpers";
import { useTabla } from "../../hooks/useTabla";
import ThOrdenable from "../ui/ThOrdenable";
import Paginacion from "../ui/Paginacion";

const sinAcentos = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Todos los productos con lo vendido en el período elegido arriba en Reportes
// (los que no se vendieron aparecen con 0). Se ordena por cualquier columna.
export default function ReporteProductos({ datos }) {
  const productos = useMemo(() => datos?.productos || [], [datos]);
  const [busqueda, setBusqueda] = useState("");
  const [soloVendidos, setSoloVendidos] = useState(false);

  const filtrados = useMemo(() => {
    const q = sinAcentos(busqueda.trim());
    return productos.filter(
      (p) =>
        (!soloVendidos || p.cantidad_total > 0) &&
        (!q || sinAcentos(p.nombre).includes(q) || sinAcentos(p.categoria).includes(q)),
    );
  }, [productos, busqueda, soloVendidos]);

  const tabla = useTabla(filtrados, {
    porPagina: 20,
    ordenInicial: { campo: "cantidad_total", dir: "desc" },
  });

  const vendidos = productos.filter((p) => p.cantidad_total > 0);
  const unidades = vendidos.reduce((s, p) => s + p.cantidad_total, 0);
  const facturado = vendidos.reduce((s, p) => s + p.total_vendido, 0);
  const top = vendidos.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          ["Productos vendidos", `${vendidos.length} de ${productos.length}`],
          ["Unidades vendidas", unidades.toLocaleString("es-AR")],
          ["Total vendido", formatCurrency(facturado)],
        ].map(([t, v]) => (
          <div key={t} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-2xl font-bold text-gray-800">{v}</p>
            <p className="text-sm text-gray-500 mt-1">{t}</p>
          </div>
        ))}
      </div>
      {datos?.desde && (
        <p className="text-sm text-gray-500">
          Ventas completadas entre el {formatDate(datos.desde)} y el {formatDate(datos.hasta)}.
        </p>
      )}

      {top.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Los 10 más vendidos del período</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, top.length * 32)}>
            <BarChart data={top} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11 }} width={150} />
              <Tooltip />
              <Bar dataKey="cantidad_total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Unidades" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="font-semibold text-gray-700 flex-1">Ventas por producto</h3>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={soloVendidos}
              onChange={(e) => setSoloVendidos(e.target.checked)}
              className="w-4 h-4 text-blue-600"
            />
            Solo los vendidos
          </label>
          <div className="relative sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto o categoría..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package size={40} className="mx-auto text-gray-300 mb-2" />
            {productos.length === 0 ? "Todavía no hay productos cargados." : "No hay productos que coincidan."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <ThOrdenable campo="nombre" tabla={tabla} align="center">Producto</ThOrdenable>
                  <ThOrdenable campo="categoria" tabla={tabla} align="center">Categoría</ThOrdenable>
                  <ThOrdenable campo="cantidad_total" tabla={tabla} align="center">Unidades vendidas</ThOrdenable>
                  <ThOrdenable campo="cantidad_ventas" tabla={tabla} align="center">Ventas</ThOrdenable>
                  <ThOrdenable campo="total_vendido" tabla={tabla} align="center">Total vendido</ThOrdenable>
                  <ThOrdenable campo="stock" tabla={tabla} align="center">Stock actual</ThOrdenable>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabla.filas.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm">
                      <span className="font-medium text-gray-800">{p.nombre}</span>
                      {!p.activo && (
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md">Inactivo</span>
                      )}
                      {p.variantes?.length > 0 && (
                        <span className="block text-xs text-gray-500">
                          {p.variantes.map((v) => `${v.nombre}: ${v.cantidad}`).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{p.categoria || "-"}</td>
                    <td className={`col-num px-6 py-3 text-sm font-semibold ${p.cantidad_total ? "text-gray-800" : "text-gray-400"}`}>
                      {p.cantidad_total}
                    </td>
                    <td className="col-num px-6 py-3 text-sm text-gray-600">{p.cantidad_ventas}</td>
                    <td className="col-num px-6 py-3 text-sm text-gray-800">{formatCurrency(p.total_vendido)}</td>
                    <td className="col-num px-6 py-3 text-sm text-gray-600">{p.stock ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Paginacion nombre={["producto", "productos"]} total={tabla.total} porPagina={tabla.porPagina} paginaActual={tabla.pagina} onChange={tabla.setPagina} />
    </div>
  );
}
