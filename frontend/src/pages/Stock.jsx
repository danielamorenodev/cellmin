import { useState, useEffect } from "react";
import InputNumero from "../components/ui/InputNumero";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { stockService } from "../services/stock.service";
import { productosService } from "../services/productos.service";
import toast from "react-hot-toast";
import {
  SUCURSALES,
  formatDateTime,
  nombreSucursal,
  MOTIVOS_STOCK,
  stockEn,
} from "../utils/helpers";
import { useSucursales } from "../hooks/useSucursales";
import Paginacion from "../components/ui/Paginacion";
import ThOrdenable from "../components/ui/ThOrdenable";
import { useTabla } from "../hooks/useTabla";
import { useAuth } from "../context/AuthContext";

function MovimientoModal({ onClose, onSave, productoInicial = null, sucursalInicial = "" }) {
  const [productos, setProductos] = useState([]);
  const { opciones: sucursalesOpc, unica: sucursalUnica } = useSucursales();
  const [form, setForm] = useState({
    sucursal: sucursalUnica || sucursalInicial || "",
    producto_id: productoInicial?.id || "",
    variante_nombre: "",
    tipo: "entrada",
    cantidad: 1,
    motivo: "ajuste_manual",
    notas: "",
  });
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    productosService.getAll().then((lista) => {
      setProductos(lista);
      if (productoInicial) {
        setProductoSeleccionado(lista.find((p) => p.id === productoInicial.id));
      }
    });
  }, []);

  const handleProductoChange = (id) => {
    const p = productos.find((p) => p.id === id);
    setProductoSeleccionado(p);
    setForm({ ...form, producto_id: id, variante_nombre: "" });
  };

  const varianteSel = productoSeleccionado?.variantes?.find(
    (v) => v.nombre === form.variante_nombre,
  );
  const itemStock = productoSeleccionado?.tiene_variantes
    ? varianteSel
    : productoSeleccionado;
  const stockDisponible = itemStock ? stockEn(itemStock, form.sucursal) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sucursal) {
      toast.error("Elegí la sucursal del movimiento");
      return;
    }
    const cantidad = parseInt(form.cantidad);
    if (form.tipo === "salida" && cantidad > stockDisponible) {
      toast.error(
        `Stock insuficiente en ${nombreSucursal(form.sucursal)}: hay ${stockDisponible}`,
      );
      return;
    }
    setLoading(true);
    try {
      await stockService.crearMovimiento({
        ...form,
        cantidad: parseInt(form.cantidad),
        variante_nombre: form.variante_nombre || null,
      });
      toast.success("Movimiento registrado");
      onSave();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Error al registrar movimiento",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Nuevo Movimiento de Stock
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sucursal *
            </label>
            {sucursalUnica ? (
              <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-xl text-sm text-gray-700">
                {nombreSucursal(sucursalUnica)}
              </div>
            ) : (
              <select
                required
                value={form.sucursal}
                onChange={(e) => setForm({ ...form, sucursal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar sucursal</option>
                {sucursalesOpc.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto *
            </label>
            <select
              required
              value={form.producto_id}
              onChange={(e) => handleProductoChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar producto</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          {productoSeleccionado?.tiene_variantes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variante *
              </label>
              <select
                required
                value={form.variante_nombre}
                onChange={(e) =>
                  setForm({ ...form, variante_nombre: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar variante</option>
                {productoSeleccionado.variantes.map((v) => (
                  <option key={v.nombre} value={v.nombre}>
                    {v.nombre} (Stock: {stockEn(v, form.sucursal)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {itemStock && form.sucursal && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
              Stock actual en {nombreSucursal(form.sucursal)}:{" "}
              <span className="font-semibold text-gray-800">
                {stockDisponible}
              </span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="entrada">Entrada (suma al stock)</option>
                <option value="salida">Salida (resta al stock)</option>
                <option value="ajuste">Ajuste (establece el stock)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad *
              </label>
              <InputNumero
                value={form.cantidad}
                onChange={(v) => setForm({ ...form, cantidad: v })}
                decimales={0}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo *
            </label>
            <select
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ajuste_manual">Ajuste manual</option>
              <option value="devolucion">Devolución</option>
              <option value="perdida">Pérdida / Rotura</option>
              <option value="inventario">Conteo de inventario</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              {loading ? "Guardando..." : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Inventario → Movimientos: historial de entradas y salidas de stock y
// ajustes manuales (rotura, pérdida, conteo)
export default function Stock() {
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const [productoMovimiento, setProductoMovimiento] = useState(null);
  const sucursal = "";
  const [filtrosMovimientos, setFiltrosMovimientos] = useState({
    busqueda: "",
    sucursal: "",
    tipo: "",
    motivo: "",
    fecha_desde: "",
    fecha_hasta: "",
  });

  const fetchData = async () => {
    try {
      const [prods, movs] = await Promise.all([
        stockService.getProductos(),
        stockService.getMovimientos(),
      ]);
      setProductos(prods);
      setMovimientos(movs);
    } catch {
      toast.error("Error al cargar los movimientos");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const movimientosFiltrados = movimientos.filter((m) => {
    const producto = productos.find((p) => p.id === m.producto_id);
    if (
      filtrosMovimientos.busqueda &&
      !producto?.nombre
        .toLowerCase()
        .includes(filtrosMovimientos.busqueda.toLowerCase()) &&
      !m.variante_nombre
        ?.toLowerCase()
        .includes(filtrosMovimientos.busqueda.toLowerCase())
    )
      return false;
    if (
      filtrosMovimientos.sucursal &&
      (m.sucursal || "sucursal_1") !== filtrosMovimientos.sucursal
    )
      return false;
    if (filtrosMovimientos.tipo && m.tipo !== filtrosMovimientos.tipo)
      return false;
    if (filtrosMovimientos.motivo && m.motivo !== filtrosMovimientos.motivo)
      return false;
    if (filtrosMovimientos.fecha_desde) {
      const desde = new Date(filtrosMovimientos.fecha_desde);
      if (new Date(m.fecha) < desde) return false;
    }
    if (filtrosMovimientos.fecha_hasta) {
      const hasta = new Date(filtrosMovimientos.fecha_hasta);
      hasta.setHours(23, 59, 59);
      if (new Date(m.fecha) > hasta) return false;
    }
    return true;
  });

  const tablaMov = useTabla(movimientosFiltrados, {
    porPagina: 20,
    ordenInicial: { campo: "fecha", dir: "desc" },
    accessors: {
      producto: (m) =>
        productos.find((p) => p.id === m.producto_id)?.nombre || "",
      fecha: (m) => (m.fecha ? new Date(m.fecha).getTime() : null),
      sucursal: (m) => nombreSucursal(m.sucursal || "sucursal_1"),
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Movimientos de stock</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ingresos, ventas, remitos entre sucursales y ajustes, con quién y cuándo.
          </p>
        </div>
        {user?.rol !== "cajero" && user?.rol !== "vendedor" && (
          <button
            onClick={() => {
              setProductoMovimiento(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
          >
            <Plus size={18} />
            Ajuste de stock
          </button>
        )}
      </div>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                placeholder="Buscar por producto..."
                value={filtrosMovimientos.busqueda}
                onChange={(e) =>
                  setFiltrosMovimientos({
                    ...filtrosMovimientos,
                    busqueda: e.target.value,
                  })
                }
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filtrosMovimientos.sucursal}
              onChange={(e) =>
                setFiltrosMovimientos({
                  ...filtrosMovimientos,
                  sucursal: e.target.value,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las sucursales</option>
              {SUCURSALES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={filtrosMovimientos.tipo}
              onChange={(e) =>
                setFiltrosMovimientos({
                  ...filtrosMovimientos,
                  tipo: e.target.value,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los tipos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
            <select
              value={filtrosMovimientos.motivo}
              onChange={(e) =>
                setFiltrosMovimientos({
                  ...filtrosMovimientos,
                  motivo: e.target.value,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los motivos</option>
              {Object.entries(MOTIVOS_STOCK).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filtrosMovimientos.fecha_desde}
              onChange={(e) =>
                setFiltrosMovimientos({
                  ...filtrosMovimientos,
                  fecha_desde: e.target.value,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filtrosMovimientos.fecha_hasta}
              onChange={(e) =>
                setFiltrosMovimientos({
                  ...filtrosMovimientos,
                  fecha_hasta: e.target.value,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <ThOrdenable campo="tipo" tabla={tablaMov} className="px-6 py-3">Tipo</ThOrdenable>
                  <ThOrdenable campo="producto" tabla={tablaMov} className="px-6 py-3">Producto</ThOrdenable>
                  <ThOrdenable campo="sucursal" tabla={tablaMov} className="px-6 py-3">Sucursal</ThOrdenable>
                  <ThOrdenable campo="cantidad" tabla={tablaMov} className="px-6 py-3">Cantidad</ThOrdenable>
                  <ThOrdenable campo="motivo" tabla={tablaMov} className="px-6 py-3">Motivo</ThOrdenable>
                  <ThOrdenable campo="fecha" tabla={tablaMov} className="px-6 py-3">Fecha</ThOrdenable>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tablaMov.filas.map((m, i) => {
                  const producto = productos.find(
                    (p) => p.id === m.producto_id,
                  );
                  const motivoLabel =
                    MOTIVOS_STOCK[m.motivo] || m.motivo;
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-[background-color]">
                      <td className="col-centro px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                            m.tipo === "entrada"
                              ? "bg-green-100 text-green-700"
                              : m.tipo === "salida"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {m.tipo === "entrada" ? (
                            <ArrowUpCircle size={12} />
                          ) : m.tipo === "salida" ? (
                            <ArrowDownCircle size={12} />
                          ) : (
                            <RefreshCw size={12} />
                          )}
                          {m.tipo === "entrada"
                            ? "Entrada"
                            : m.tipo === "salida"
                              ? "Salida"
                              : "Ajuste"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className="font-medium">
                          {producto?.nombre || "Producto eliminado"}
                        </span>
                        {m.variante_nombre && (
                          <span className="text-gray-500">
                            {" "}
                            — {m.variante_nombre}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {nombreSucursal(m.sucursal || "sucursal_1")}
                      </td>
                      <td className="col-num px-6 py-4 text-sm font-medium text-gray-800 ">
                        {m.cantidad}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {motivoLabel}
                      </td>
                      <td className="col-centro px-6 py-4 text-sm text-gray-500">
                        {m.fecha ? formatDateTime(m.fecha) : "-"}
                      </td>
                    </tr>
                  );
                })}
                {movimientos.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      No hay movimientos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {movimientos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No hay movimientos registrados
              </div>
            ) : (
              tablaMov.filas.map((m, i) => {
                const producto = productos.find((p) => p.id === m.producto_id);
                const motivoLabel =
                  MOTIVOS_STOCK[m.motivo] || m.motivo;
                return (
                  <div
                    key={i}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          m.tipo === "entrada"
                            ? "bg-green-100 text-green-700"
                            : m.tipo === "salida"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {m.tipo === "entrada" ? (
                          <ArrowUpCircle size={12} />
                        ) : m.tipo === "salida" ? (
                          <ArrowDownCircle size={12} />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {m.tipo === "entrada"
                          ? "Entrada"
                          : m.tipo === "salida"
                            ? "Salida"
                            : "Ajuste"}
                      </span>
                      <span className="text-sm font-bold text-gray-800">
                        x{m.cantidad}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">
                      {producto?.nombre || "Producto eliminado"}
                      {m.variante_nombre && (
                        <span className="text-gray-500 font-normal">
                          {" "}
                          — {m.variante_nombre}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {nombreSucursal(m.sucursal || "sucursal_1")} · {motivoLabel}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {m.fecha ? formatDateTime(m.fecha) : "-"}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <Paginacion
            total={tablaMov.total}
            porPagina={tablaMov.porPagina}
            paginaActual={tablaMov.pagina}
            onChange={tablaMov.setPagina}
          />

      {showModal && (
        <MovimientoModal
          productoInicial={productoMovimiento}
          sucursalInicial={sucursal}
          onClose={() => {
            setShowModal(false);
            setProductoMovimiento(null);
          }}
          onSave={() => {
            setShowModal(false);
            setProductoMovimiento(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
