import { useState, useEffect, Fragment } from "react";
import InputNumero from "../components/ui/InputNumero";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  History,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { stockService } from "../services/stock.service";
import { productosService } from "../services/productos.service";
import { categoriasService } from "../services/categorias.service";
import MenuAcciones from "../components/ui/MenuAcciones";
import toast from "react-hot-toast";
import {
  SUCURSALES,
  formatDateTime,
  minimoEn,
  bajoMinimo,
  nombreSucursal,
  stockEn,
  idsFiltro,
} from "../utils/helpers";
import FiltroCategorias from "../components/ui/FiltroCategorias";
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
              <option value="inventario">Inventario</option>
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

export default function Stock() {
  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("inventario");
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const [sucursal, setSucursal] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ categoria_id: "", stock: "" });
  const [showFiltros, setShowFiltros] = useState(false);
  const [productoMovimiento, setProductoMovimiento] = useState(null);
  const filtrosActivos = Object.values(filtros).some((v) => v !== "");
  const [expandidos, setExpandidos] = useState(() => new Set());
  const alternarExpandido = (id) =>
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
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
    } catch (error) {
      toast.error("Error al cargar stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    categoriasService.getAll().then(setCategorias).catch(() => {});
  }, []);

  // Stock del producto en la sucursal elegida (o total); suma las variantes
  const stockDelProducto = (p) =>
    p.tiene_variantes
      ? (p.variantes || []).reduce((a, v) => a + (stockEn(v, sucursal) || 0), 0)
      : stockEn(p, sucursal) || 0;

  // Se puede filtrar por una o varias categorías
  const categoriasFiltro = filtros.categoria_id
    ? new Set(idsFiltro(filtros.categoria_id))
    : null;
  const filteredProductos = productos.filter((p) => {
    if (!p.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoriasFiltro && !categoriasFiltro.has(p.categoria_id))
      return false;
    if (filtros.stock === "con_stock" && stockDelProducto(p) <= 0) return false;
    if (filtros.stock === "sin_stock" && stockDelProducto(p) > 0) return false;
    return true;
  });

  // Stock / mínimo según la sucursal elegida (vacía = total)
  const stockDe = (item) => stockEn(item, sucursal);
  const minimoDe = (item) => minimoEn(item, sucursal);
  // Con una sucursal elegida se mira esa; en "todas", si alguna llegó a su mínimo
  const esBajo = (item) =>
    sucursal
      ? bajoMinimo(item, sucursal)
      : SUCURSALES.some((o) => bajoMinimo(item, o.value));

  // Un artículo es un producto simple o cada variante de un producto
  const articulosBajos = (p) =>
    p.tiene_variantes
      ? (p.variantes || []).filter(esBajo).length
      : esBajo(p)
        ? 1
        : 0;
  const alertas = productos.filter((p) => articulosBajos(p) > 0);
  const totalArticulosBajos = productos.reduce(
    (a, p) => a + articulosBajos(p),
    0,
  );

  const stockTotal = (p) =>
    p.tiene_variantes
      ? (p.variantes || []).reduce((a, v) => a + (stockDe(v) || 0), 0)
      : stockDe(p) || 0;

  // Para un producto con variantes se suman las variantes; un producto simple
  // usa sus propios valores. "Bajo" = algún artículo está bajo su mínimo.
  const valorEn = (it, suc) =>
    it.tiene_variantes
      ? (it.variantes || []).reduce((a, v) => a + (stockEn(v, suc) || 0), 0)
      : stockEn(it, suc);
  const minimoSumado = (it, suc) =>
    it.tiene_variantes
      ? (it.variantes || []).reduce((a, v) => a + (minimoEn(v, suc) || 0), 0)
      : minimoEn(it, suc);
  const bajoEnSuc = (it, suc) =>
    it.tiene_variantes
      ? (it.variantes || []).some((v) => bajoMinimo(v, suc))
      : bajoMinimo(it, suc);

  // Con una sucursal elegida: stock y mínimo de esa sucursal.
  // En "todas": una columna de stock por sucursal (rojo si está bajo su mínimo).
  const CeldasStock = ({ item }) =>
    sucursal ? (
      <>
        <td
          className={`col-num px-6 py-4 text-sm ${bajoEnSuc(item, sucursal) ? "font-semibold text-red-600" : "font-medium text-gray-800"}`}
        >
          {valorEn(item, sucursal)}
        </td>
        <td className="col-num px-6 py-4 text-sm text-gray-500">
          {minimoSumado(item, sucursal)}
        </td>
      </>
    ) : (
      SUCURSALES.map((o) => {
        const bajo = bajoEnSuc(item, o.value);
        return (
          <td
            key={o.value}
            title={bajo ? "Stock en el mínimo o por debajo: hay que reponer" : undefined}
            className={`col-num px-6 py-4 text-sm ${bajo ? "font-semibold text-red-600" : "text-gray-800"}`}
          >
            {valorEn(item, o.value)}
          </td>
        );
      })
    );

  const puedeMover = user?.rol !== "cajero" && user?.rol !== "vendedor";
  const accionesProducto = (producto) => {
    const acciones = [];
    if (puedeMover) {
      acciones.push({
        label: "Registrar movimiento",
        icono: <ArrowLeftRight size={14} />,
        onClick: () => {
          setProductoMovimiento(producto);
          setShowModal(true);
        },
      });
      acciones.push({
        label: "Ver movimientos",
        icono: <History size={14} />,
        onClick: () => {
          setFiltrosMovimientos((f) => ({ ...f, busqueda: producto.nombre }));
          setTab("movimientos");
        },
      });
    }
    if (producto.tiene_variantes) {
      acciones.push({
        label: expandidos.has(producto.id) ? "Ocultar variantes" : "Ver variantes",
        icono: expandidos.has(producto.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />,
        onClick: () => alternarExpandido(producto.id),
      });
    }
    return acciones;
  };

  const EstadoBadge = ({ bajo, cantidad }) => (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
        bajo ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
      }`}
    >
      {bajo ? (
        <>
          <AlertTriangle size={10} /> Stock bajo
          {cantidad > 1 ? ` (${cantidad})` : ""}
        </>
      ) : (
        "OK"
      )}
    </span>
  );

  const Desglose = ({ item }) =>
    sucursal ? null : (
      <p className="text-xs text-gray-500 font-normal">
        {SUCURSALES.map((o) => `${o.label.replace("Sucursal ", "S")}: ${stockEn(item, o.value)}`).join(" · ")}
      </p>
    );

  const tablaProductos = useTabla(filteredProductos, {
    porPagina: 20,
    ordenInicial: { campo: "nombre", dir: "asc" },
    accessors: {
      stock: stockTotal,
      estado: (p) => (articulosBajos(p) > 0 ? 0 : 1),
    },
  });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stock</h1>
          <p className="text-gray-500 text-sm mt-1">
            {productos.length} productos en inventario
            {sucursal && ` · ${nombreSucursal(sucursal)}`}
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
            Nuevo Movimiento
          </button>
        )}
      </div>

      {/* Alerta stock bajo */}
      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <span className="font-semibold">
              {totalArticulosBajos}{" "}
              {totalArticulosBajos === 1 ? "artículo" : "artículos"}
            </span>{" "}
            con stock bajo o agotado
            {sucursal && ` en ${nombreSucursal(sucursal)}`}
            {alertas.length !== totalArticulosBajos &&
              ` (en ${alertas.length} productos)`}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("inventario")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "inventario"
              ? "bg-white shadow text-gray-800"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Inventario
        </button>
        {user?.rol !== "cajero" && user?.rol !== "vendedor" && (
          <button
            onClick={() => setTab("movimientos")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === "movimientos"
                ? "bg-white shadow text-gray-800"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Movimientos
          </button>
        )}
      </div>

      {tab === "inventario" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las sucursales</option>
              {SUCURSALES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowFiltros(!showFiltros)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                filtrosActivos
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Filtros{" "}
              {filtrosActivos &&
                `(${Object.values(filtros).filter((v) => v !== "").length})`}
            </button>
            {filtrosActivos && (
              <button
                type="button"
                onClick={() => setFiltros({ categoria_id: "", stock: "" })}
                className="px-4 py-2 rounded-xl text-sm text-red-600 border border-red-200 hover:bg-red-50 transition"
              >
                Limpiar
              </button>
            )}
          </div>

          {showFiltros && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Categorías
                </label>
                <FiltroCategorias
                  categorias={categorias}
                  value={filtros.categoria_id}
                  onChange={(v) => setFiltros({ ...filtros, categoria_id: v })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Stock{sucursal ? ` en ${nombreSucursal(sucursal)}` : ""}
                </label>
                <select
                  value={filtros.stock}
                  onChange={(e) =>
                    setFiltros({ ...filtros, stock: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="con_stock">Con stock</option>
                  <option value="sin_stock">Sin stock</option>
                </select>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando...</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <ThOrdenable campo="nombre" tabla={tablaProductos} className="px-6 py-3">Producto</ThOrdenable>
                      {sucursal ? (
                        <>
                          <ThOrdenable campo="stock" tabla={tablaProductos} className="px-6 py-3">Stock Actual</ThOrdenable>
                          <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                            Stock Mínimo
                          </th>
                        </>
                      ) : (
                        SUCURSALES.map((o) => (
                          <th key={o.value} className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                            Stock {o.label.replace("Sucursal", "Suc.")}
                          </th>
                        ))
                      )}
                      <ThOrdenable campo="estado" tabla={tablaProductos} className="px-6 py-3">Estado</ThOrdenable>
                      <th className="w-28 px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tablaProductos.filas.map((producto) => {
                      const abierto = expandidos.has(producto.id);
                      const cantBajos = articulosBajos(producto);
                      return (
                        <Fragment key={producto.id}>
                          <tr className="hover:bg-gray-50 transition-[background-color]">
                            <td className="px-6 py-4 font-medium text-gray-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Package size={16} className="text-gray-500 shrink-0" />
                                {producto.nombre}
                                {producto.tiene_variantes && (
                                  <button
                                    type="button"
                                    onClick={() => alternarExpandido(producto.id)}
                                    className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-md hover:bg-blue-100 transition"
                                  >
                                    {producto.variantes.length} variantes
                                  </button>
                                )}
                              </div>
                            </td>
                            <CeldasStock item={producto} />
                            <td className="col-centro px-6 py-4">
                              <EstadoBadge bajo={cantBajos > 0} cantidad={cantBajos} />
                            </td>
                            <td className="col-acc px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                {producto.tiene_variantes && (
                                  <button
                                    type="button"
                                    onClick={() => alternarExpandido(producto.id)}
                                    className="p-1 text-gray-500 hover:text-blue-600 transition"
                                    title={abierto ? "Contraer" : "Ver variantes"}
                                  >
                                    {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                )}
                                {accionesProducto(producto).length > 0 && (
                                  <MenuAcciones acciones={accionesProducto(producto)} />
                                )}
                              </div>
                            </td>
                          </tr>
                          {abierto && producto.tiene_variantes && (
                            <tr>
                              <td colSpan={sucursal ? 5 : 2 + SUCURSALES.length + 1} className="px-6 pb-4 bg-gray-50">
                                <div className="rounded-xl border border-gray-200 overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Variante</th>
                                        {sucursal ? (
                                          <>
                                            <th className="px-4 py-2 text-xs font-medium text-gray-500">Stock</th>
                                            <th className="px-4 py-2 text-xs font-medium text-gray-500">Mínimo</th>
                                          </>
                                        ) : (
                                          SUCURSALES.map((o) => (
                                            <th key={o.value} className="px-4 py-2 text-xs font-medium text-gray-500">
                                              {o.label.replace("Sucursal", "Suc.")}
                                            </th>
                                          ))
                                        )}
                                        <th className="px-4 py-2 text-xs font-medium text-gray-500">Estado</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {producto.variantes.map((v, i) => (
                                        <tr key={i} className="bg-white">
                                          <td className="px-4 py-2 text-gray-700">{v.nombre}</td>
                                          <CeldasStock item={v} />
                                          <td className="col-centro px-4 py-2">
                                            <EstadoBadge bajo={esBajo(v)} />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                <Paginacion
                  total={tablaProductos.total}
                  porPagina={tablaProductos.porPagina}
                  paginaActual={tablaProductos.pagina}
                  onChange={tablaProductos.setPagina}
                />
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {tablaProductos.filas.map((producto) => (
                  <div
                    key={producto.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Package size={16} className="text-gray-500 shrink-0" />
                        <p className="font-medium text-gray-800 flex-1">
                          {producto.nombre}
                        </p>
                        {accionesProducto(producto).length > 0 && (
                          <MenuAcciones acciones={accionesProducto(producto)} />
                        )}
                      </div>
                      {producto.tiene_variantes && (
                        <button
                          type="button"
                          onClick={() => alternarExpandido(producto.id)}
                          className="mb-2 inline-flex items-center gap-1 text-xs text-blue-600"
                        >
                          {expandidos.has(producto.id) ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                          {producto.variantes.length} variantes
                        </button>
                      )}
                      {producto.tiene_variantes && expandidos.has(producto.id) ? (
                        <div className="space-y-2">
                          {producto.variantes.map((v, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-700">
                                  {v.nombre}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Mínimo: {minimoDe(v)}
                                </p>
                                <Desglose item={v} />
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-800">
                                  {stockDe(v)}
                                </p>
                                <span
                                  className={`text-xs font-medium ${
                                    esBajo(v)
                                      ? "text-red-600"
                                      : "text-green-700"
                                  }`}
                                >
                                  {esBajo(v) ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle size={14} /> Stock bajo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Check size={14} /> OK
                    </span>
                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-xs text-gray-500">
                              Stock actual
                            </p>
                            <p className="text-lg font-bold text-gray-800">
                              {sucursal ? valorEn(producto, sucursal) : stockTotal(producto)}
                            </p>
                            {!sucursal && (
                              <p className="text-xs text-gray-500 font-normal">
                                {SUCURSALES.map((o) => `${o.label.replace("Sucursal ", "S")}: ${valorEn(producto, o.value)}`).join(" · ")}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              Mínimo: {sucursal ? minimoSumado(producto, sucursal) : "-"}
                            </p>
                            <span
                              className={`text-xs font-medium ${
                                articulosBajos(producto) > 0
                                  ? "text-red-600"
                                  : "text-green-700"
                              }`}
                            >
                              {articulosBajos(producto) > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle size={14} /> Stock bajo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Check size={14} /> OK
                    </span>
                  )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <Paginacion
                  total={tablaProductos.total}
                  porPagina={tablaProductos.porPagina}
                  paginaActual={tablaProductos.pagina}
                  onChange={tablaProductos.setPagina}
                />
              </div>
            </>
          )}
        </>
      )}
      {tab === "movimientos" && (
        <>
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
              <option value="ajuste_manual">Ajuste manual</option>
              <option value="devolucion">Devolución</option>
              <option value="perdida">Pérdida / Rotura</option>
              <option value="inventario">Inventario</option>
              <option value="compra">Compra</option>
              <option value="venta">Venta</option>
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
                    {
                      ajuste_manual: "Ajuste manual",
                      devolucion: "Devolución",
                      perdida: "Pérdida / Rotura",
                      inventario: "Inventario",
                      compra: "Compra",
                      venta: "Venta",
                      cancelacion_compra: "Cancelación de compra",
                      cancelacion_venta: "Cancelación de venta",
                    }[m.motivo] || m.motivo;
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
                  {
                    ajuste_manual: "Ajuste manual",
                    devolucion: "Devolución",
                    perdida: "Pérdida / Rotura",
                    inventario: "Inventario",
                    compra: "Compra",
                    venta: "Venta",
                    cancelacion_compra: "Cancelación de compra",
                      cancelacion_venta: "Cancelación de venta",
                  }[m.motivo] || m.motivo;
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
        </>
      )}

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
