import { useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import InputNumero from "../components/ui/InputNumero";
import {
  Plus,
  Search,
  Truck,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  ToggleLeft,
  Phone,
  Mail,
  User,
  ExternalLink,
  Eye,
  XCircle,
  X,
} from "lucide-react";
import { comprasService } from "../services/compras.service";
import { proveedoresService } from "../services/proveedores.service";
import { productosService } from "../services/productos.service";
import toast from "react-hot-toast";
import Paginacion from "../components/ui/Paginacion";
import ThOrdenable from "../components/ui/ThOrdenable";
import { useTabla } from "../hooks/useTabla";
import { formatCurrency, formatDateTime, nombreSucursal } from "../utils/helpers";
import MenuAcciones from "../components/ui/MenuAcciones";
import { useSucursales } from "../hooks/useSucursales";
import DetalleCompra from "../components/ui/DetalleCompra";
import BuscadorProducto from "../components/ui/BuscadorProducto";
import { ProductoModal } from "./Productos";
import { categoriasService } from "../services/categorias.service";

function ProveedorModal({ proveedor, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: proveedor?.nombre || "",
    cuit: proveedor?.cuit || "",
    telefono: proveedor?.telefono || "",
    email: proveedor?.email || "",
    direccion: proveedor?.direccion || "",
    contacto: proveedor?.contacto || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (proveedor) {
        await proveedoresService.update(proveedor.id, form);
        toast.success("Proveedor actualizado");
      } else {
        const creado = await proveedoresService.create(form);
        toast.success(`Proveedor «${form.nombre}» creado`);
        onSave(creado);
        return;
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar el proveedor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {proveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CUIT
              </label>
              <input
                type="text"
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                placeholder="XX-XXXXXXXX-X"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Persona de contacto
            </label>
            <input
              type="text"
              value={form.contacto}
              onChange={(e) => setForm({ ...form, contacto: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Ingreso de mercadería: lo que llega del proveedor suma stock en la sucursal
// que lo recibe. Se eligen productos existentes o se crean en el momento.
function NuevaCompraModal({ onClose, onSave }) {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const { opciones: sucursalesOpc, unica: sucursalUnica, porDefecto } =
    useSucursales();
  const [form, setForm] = useState({
    proveedor_id: "",
    sucursal: sucursalUnica || "",
    numero_remito: "",
    notas: "",
    items: [],
  });
  const [loading, setLoading] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState(false);

  useEffect(() => {
    Promise.all([
      proveedoresService.getAll(),
      productosService.getAll(),
      categoriasService.getAll(),
    ]).then(([provs, prods, cats]) => {
      setProveedores(provs.filter((p) => p.activo !== false));
      setProductos(prods);
      setCategorias(cats);
    });
  }, []);

  const lineasDe = (producto) =>
    producto.tiene_variantes
      ? [{
          producto_id: producto.id,
          variante_nombre: "",
          nombre_producto: producto.nombre,
          cantidad: 1,
          precio_unitario: 0,
        }]
      : [{
          producto_id: producto.id,
          variante_nombre: "",
          nombre_producto: producto.nombre,
          cantidad: 1,
          precio_unitario: producto.precio_costo || 0,
        }];

  const agregarProducto = (producto) =>
    setForm((f) => ({ ...f, items: [...f.items, ...lineasDe(producto)] }));

  // Producto recién creado: se suma a la lista y entra al ingreso (una
  // línea por variante, con su costo)
  const productoCreado = (p) => {
    setNuevoProducto(false);
    if (!p) return;
    setProductos((lista) => [...lista, p]);
    const lineas = p.tiene_variantes
      ? p.variantes.map((v) => ({
          producto_id: p.id,
          variante_nombre: v.nombre,
          nombre_producto: p.nombre,
          cantidad: 1,
          precio_unitario: v.precio_costo || 0,
        }))
      : lineasDe(p);
    setForm((f) => ({ ...f, items: [...f.items, ...lineas] }));
  };

  const eliminarItem = (index) =>
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === "variante_nombre") {
      const producto = productos.find((p) => p.id === items[index].producto_id);
      const variante = producto?.variantes?.find((v) => v.nombre === value);
      if (variante) items[index].precio_unitario = variante.precio_costo || 0;
    }
    setForm({ ...form, items });
  };

  const total = form.items.reduce(
    (acc, item) => acc + (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0),
    0,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.items.length === 0) {
      toast.error("Agregá al menos un producto");
      return;
    }
    setLoading(true);
    try {
      const data = {
        ...form,
        sucursal: form.sucursal || porDefecto,
        total,
        items: form.items.map((item) => ({
          ...item,
          cantidad: parseInt(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario) || 0,
          subtotal: parseInt(item.cantidad) * (parseFloat(item.precio_unitario) || 0),
          variante_nombre: item.variante_nombre || null,
        })),
      };
      const unidades = data.items.reduce((a, i) => a + i.cantidad, 0);
      await comprasService.create(data);
      toast.success(
        `Ingreso registrado: ${unidades} ${unidades === 1 ? "unidad sumada" : "unidades sumadas"} al stock de ${nombreSucursal(data.sucursal)}`,
      );
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar el ingreso");
    } finally {
      setLoading(false);
    }
  };

  const CAMPO =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const ETIQUETA = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">Ingreso de mercadería</h2>
          <p className="text-xs text-gray-500">Lo que se carga acá se suma al stock de la sucursal que lo recibe.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="ing-proveedor" className={ETIQUETA}>Proveedor *</label>
                  <button
                    type="button"
                    onClick={() => setNuevoProveedor(true)}
                    className="text-xs text-blue-600 hover:underline mb-1"
                  >
                    + Nuevo proveedor
                  </button>
                </div>
                <select
                  id="ing-proveedor"
                  required
                  value={form.proveedor_id}
                  onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}
                  className={CAMPO}
                >
                  <option value="">Elegí el proveedor</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ing-sucursal" className={ETIQUETA}>Sucursal que recibe *</label>
                {sucursalUnica ? (
                  <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700">
                    {nombreSucursal(sucursalUnica)}
                  </div>
                ) : (
                  <select
                    id="ing-sucursal"
                    required
                    value={form.sucursal}
                    onChange={(e) => setForm({ ...form, sucursal: e.target.value })}
                    className={CAMPO}
                  >
                    <option value="">Elegí la sucursal</option>
                    {sucursalesOpc.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="ing-remito" className={ETIQUETA}>N° de remito o factura</label>
                <input
                  id="ing-remito"
                  type="text"
                  value={form.numero_remito}
                  onChange={(e) => setForm({ ...form, numero_remito: e.target.value })}
                  placeholder="Del comprobante del proveedor"
                  className={CAMPO}
                />
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Productos</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <BuscadorProducto
                    productos={productos}
                    onElegir={agregarProducto}
                    placeholder="Producto existente: buscar por nombre o código..."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setNuevoProducto(true)}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 border border-blue-600 text-blue-700 rounded-lg text-sm hover:bg-blue-50 whitespace-nowrap"
                >
                  <Plus size={15} /> Producto nuevo
                </button>
              </div>

              {form.items.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-300 rounded-lg">
                  Buscá un producto que ya existe o creá uno nuevo.
                </p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Producto</th>
                        <th className="text-left font-medium px-2 py-2 w-24">Cantidad</th>
                        <th className="text-left font-medium px-2 py-2 w-36">Costo unitario</th>
                        <th className="text-right font-medium px-3 py-2 w-32">Subtotal</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.items.map((item, index) => {
                        const producto = productos.find((p) => p.id === item.producto_id);
                        return (
                          <tr key={index}>
                            <td className="px-3 py-1.5">
                              <p className="text-gray-800">{item.nombre_producto}</p>
                              {producto?.tiene_variantes && (
                                <select
                                  required
                                  value={item.variante_nombre}
                                  onChange={(e) => updateItem(index, "variante_nombre", e.target.value)}
                                  aria-label="Variante"
                                  className={`${CAMPO} mt-1 py-1.5`}
                                >
                                  <option value="">Elegí la variante</option>
                                  {producto.variantes.map((v) => (
                                    <option key={v.nombre} value={v.nombre}>
                                      {v.nombre}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              <InputNumero
                                value={item.cantidad}
                                onChange={(v) => updateItem(index, "cantidad", v)}
                                decimales={0}
                                required
                                aria-label="Cantidad"
                                className={CAMPO}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <InputNumero
                                value={item.precio_unitario}
                                onChange={(v) => updateItem(index, "precio_unitario", v)}
                                aria-label="Costo unitario"
                                className={CAMPO}
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-700 whitespace-nowrap">
                              {formatCurrency((Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0))}
                            </td>
                            <td className="pr-2 text-right">
                              <button
                                type="button"
                                onClick={() => eliminarItem(index)}
                                aria-label="Quitar producto"
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <X size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div>
              <label htmlFor="ing-notas" className={ETIQUETA}>Notas</label>
              <textarea
                id="ing-notas"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={2}
                className={`${CAMPO} resize-none`}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-3 border-t border-gray-100 shrink-0">
            <p className="flex-1 text-sm text-gray-600">
              Total del ingreso: <span className="text-lg font-bold text-gray-800">{formatCurrency(total)}</span>
            </p>
            <button
              type="button"
              onClick={onClose}
              className="sm:w-40 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="sm:w-48 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              {loading ? "Registrando..." : "Registrar ingreso"}
            </button>
          </div>
        </form>
      </div>

      {nuevoProducto && (
        <ProductoModal
          categorias={categorias}
          sinStockInicial
          onClose={() => setNuevoProducto(false)}
          onSave={productoCreado}
        />
      )}
      {nuevoProveedor && (
        <ProveedorModal
          onClose={() => setNuevoProveedor(false)}
          onSave={(creado) => {
            setNuevoProveedor(false);
            if (creado?.id) {
              setProveedores((l) => [...l, creado]);
              setForm((f) => ({ ...f, proveedor_id: creado.id }));
            }
          }}
        />
      )}
    </div>
  );
}

function ModalConfirmar({ mensaje, onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
        <p className="text-gray-800 font-medium text-center">{mensaje}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
          >
            Volver
          </button>
          <button
            onClick={onConfirmar}
            className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 transition"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalDetalleCompra({ compra, proveedor, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Compra {compra.numero_compra}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <DetalleCompra compra={compra} proveedor={proveedor} />
        </div>
        <div className="flex justify-end p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function accionesCompra({ compra, onCancel, onVerDetalle }) {
  const cancelada = compra.estado === "cancelada";
  return [
    {
      label: "Ver detalle",
      icono: <Eye size={14} />,
      onClick: () => onVerDetalle(compra),
    },
    {
      label: "Abrir en pestaña nueva",
      icono: <ExternalLink size={14} />,
      onClick: () =>
        window.open(`/compras/${compra._id}`, "_blank", "noopener"),
    },
    !cancelada && onCancel && {
      label: "Anular ingreso",
      icono: <XCircle size={14} />,
      peligro: true,
      onClick: () => onCancel(compra._id, compra.numero_compra),
    },
  ];
}

function FilaCompra({ compra, proveedores, onCancel, onVerDetalle }) {
  const [expandido, setExpandido] = useState(false);
  const proveedor = proveedores.find((p) => p.id === compra.proveedor_id);
  const cancelada = compra.estado === "cancelada";

  return (
    <>
      <tr className="hover:bg-gray-50 transition-[background-color]">
        <td className="col-centro px-6 py-4">
          <button
            onClick={() => onVerDetalle(compra)}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
          >
            {compra.numero_compra}
          </button>
        </td>
        <td className="px-6 py-4 text-sm text-gray-700">
          {proveedor?.nombre || "-"}
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">
          {nombreSucursal(compra.sucursal || "sucursal_1")}
        </td>
        <td className="col-num px-6 py-4 text-sm text-gray-600 ">
          {compra.items?.length || 0}
        </td>
        <td
          className={`col-num px-6 py-4 text-sm font-semibold ${cancelada ? "text-gray-500 line-through" : "text-gray-800"}`}
        >
          {formatCurrency(compra.total)}
        </td>
        <td className="col-centro px-6 py-4 text-sm text-gray-500">
          {compra.fecha ? formatDateTime(compra.fecha) : "-"}
        </td>
        <td className="col-centro px-6 py-4">
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium ${
              cancelada
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {cancelada ? "Cancelada" : "Completada"}
          </span>
        </td>
        <td className="col-acc px-6 py-4 ">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setExpandido(!expandido)}
              className="p-1 text-gray-500 hover:text-gray-600"
            >
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <MenuAcciones
              acciones={accionesCompra({ compra, onCancel, onVerDetalle })}
            />
          </div>
        </td>
      </tr>
      {expandido && (
        <tr>
          <td colSpan={8} className="px-6 pb-4 bg-gray-50">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {["Producto", "Variante", "Cantidad", "Precio unit.", "Subtotal"].map(
                      (t) => (
                        <th
                          key={t}
                          className="px-4 py-2 text-xs font-medium text-gray-500"
                        >
                          {t}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {compra.items?.map((item, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-4 py-2 font-medium text-gray-700">
                        {item.nombre_producto}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {item.variante_nombre || "-"}
                      </td>
                      <td className="col-num px-4 py-2 text-gray-600 ">
                        {item.cantidad}
                      </td>
                      <td className="col-num px-4 py-2 text-gray-600 ">
                        {formatCurrency(item.precio_unitario)}
                      </td>
                      <td className="col-num px-4 py-2 font-medium text-gray-700 ">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-x-4">
                <span>
                  Sucursal: {nombreSucursal(compra.sucursal || "sucursal_1")}
                </span>
                {compra.numero_remito && (
                  <span>Remito: {compra.numero_remito}</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CardCompraMobile({ compra, proveedor, onCancel, onVerDetalle }) {
  const [expandido, setExpandido] = useState(false);
  const cancelada = compra.estado === "cancelada";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => onVerDetalle(compra)}
            className="font-medium text-blue-600 hover:underline"
          >
            {compra.numero_compra}
          </button>
          <span
            className={`text-sm font-bold ${cancelada ? "text-gray-500 line-through" : "text-gray-800"}`}
          >
            {formatCurrency(compra.total)}
          </span>
        </div>
        {cancelada && (
          <span className="inline-block mb-2 px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700">
            Cancelada
          </span>
        )}
        <div className="space-y-1 text-sm text-gray-600">
          <p className="font-medium text-gray-700">
            {proveedor?.nombre || "-"}
          </p>
          <p className="text-xs text-gray-500">
            {nombreSucursal(compra.sucursal || "sucursal_1")}
          </p>
          <p className="text-xs text-gray-500">
            {compra.fecha ? formatDateTime(compra.fecha) : "-"}
          </p>
          <p className="text-xs text-gray-500">
            {compra.items?.length || 0} productos
          </p>
          {compra.numero_remito && (
            <p className="text-xs text-gray-500">
              Remito: {compra.numero_remito}
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setExpandido(!expandido)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expandido ? "Ocultar detalle" : "Ver detalle"}
          </button>
          <MenuAcciones
            acciones={accionesCompra({ compra, onCancel, onVerDetalle })}
          />
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
          {compra.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <div>
                <span className="font-medium">{item.nombre_producto}</span>
                {item.variante_nombre && (
                  <span className="text-gray-500">
                    {" "}
                    — {item.variante_nombre}
                  </span>
                )}
                <span className="text-gray-500"> x{item.cantidad}</span>
              </div>
              <span className="font-medium">
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold text-gray-800 border-t border-gray-200 pt-2">
            <span>Total</span>
            <span>{formatCurrency(compra.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function GestionProveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const filtered = proveedores.filter((p) => {
    if (
      busqueda &&
      !`${p.nombre} ${p.cuit} ${p.contacto}`
        .toLowerCase()
        .includes(busqueda.toLowerCase())
    )
      return false;
    if (filtroEstado === "activo" && !p.activo) return false;
    if (filtroEstado === "inactivo" && p.activo) return false;
    return true;
  });

  const fetchProveedores = async () => {
    try {
      const data = await proveedoresService.getAll();
      setProveedores(data);
    } catch (error) {
      toast.error("Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProveedores();
  }, []);

  const handleToggle = async (proveedor) => {
    const accion = proveedor.activo ? "desactivar" : "activar";
    if (
      !confirm(
        `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${proveedor.nombre}?`,
      )
    )
      return;
    try {
      await proveedoresService.delete(proveedor.id);
      toast.success(
        `Proveedor ${accion === "desactivar" ? "desactivado" : "activado"}`,
      );
      fetchProveedores();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };


  const accionesProveedor = (proveedor) => [
    {
      label: "Editar",
      icono: <Edit size={14} />,
      onClick: () => {
        setSelected(proveedor);
        setShowModal(true);
      },
    },
    {
      label: proveedor.activo ? "Desactivar" : "Activar",
      icono: proveedor.activo ? <Trash2 size={14} /> : <ToggleLeft size={14} />,
      peligro: proveedor.activo,
      onClick: () => handleToggle(proveedor),
    },
  ];

  const tabla = useTabla(filtered, {
    porPagina: 20,
    ordenInicial: { campo: "nombre", dir: "asc" },
    accessors: {

    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setSelected(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={18} />
          Nuevo Proveedor
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Buscar por nombre o CUIT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : proveedores.length === 0 ? (
        <div className="text-center py-12">
          <Truck size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay proveedores registrados</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <ThOrdenable campo="nombre" tabla={tabla} className="px-6 py-3">Proveedor</ThOrdenable>
                  <ThOrdenable campo="cuit" tabla={tabla} className="px-6 py-3">CUIT</ThOrdenable>
                  <ThOrdenable campo="contacto" tabla={tabla} className="px-6 py-3">Contacto</ThOrdenable>
                  <ThOrdenable campo="telefono" tabla={tabla} className="px-6 py-3">Teléfono</ThOrdenable>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabla.filas.map((proveedor) => (
                  <tr
                    key={proveedor.id}
                    className="hover:bg-gray-50 transition-[background-color]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                          <Truck size={16} className="text-orange-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">
                              {proveedor.nombre}
                            </p>
                            {!proveedor.activo && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                                Inactivo
                              </span>
                            )}
                          </div>
                          {proveedor.email && (
                            <p className="text-xs text-gray-500">
                              {proveedor.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="col-centro px-6 py-4 text-sm text-gray-600">
                      {proveedor.cuit || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {proveedor.contacto || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {proveedor.telefono || "-"}
                    </td>
                    <td className="col-acc px-6 py-4 ">
                      <div className="flex items-center justify-center gap-2">
                        <MenuAcciones acciones={accionesProveedor(proveedor)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {tabla.filas.map((proveedor) => (
              <div
                key={proveedor.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <Truck size={18} className="text-orange-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">
                          {proveedor.nombre}
                        </p>
                        {!proveedor.activo && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        CUIT: {proveedor.cuit || "-"}
                      </p>
                    </div>
                  </div>
                  <MenuAcciones acciones={accionesProveedor(proveedor)} />
                </div>
                <div className="space-y-1">
                  {proveedor.contacto && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User size={14} />
                      {proveedor.contacto}
                    </div>
                  )}
                  {proveedor.telefono && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={14} />
                      {proveedor.telefono}
                    </div>
                  )}
                  {proveedor.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail size={14} />
                      {proveedor.email}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Paginacion
            total={tabla.total}
            porPagina={tabla.porPagina}
            paginaActual={tabla.pagina}
            onChange={tabla.setPagina}
          />
        </>
      )}

      {showModal && (
        <ProveedorModal
          proveedor={selected}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchProveedores();
          }}
        />
      )}
    </div>
  );
}

export default function Compras() {
  const { user } = useAuth();
  // Cancelar una compra revierte stock: administrador y depósito
  const puedeCancelar = ["administrador", "deposito"].includes(user?.rol);
  // La vista sale de la dirección (?vista=...): la eligen el menú y las pestañas del módulo
  const [params] = useSearchParams();
  const tab = params.get("vista") === "proveedores" ? "proveedores" : "compras";
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // "?nuevo=1" abre directamente el ingreso (botón de Productos y stock)
  const [showModal, setShowModal] = useState(() => params.get("nuevo") === "1");
  const [compraCancelar, setCompraCancelar] = useState(null);
  const [compraDetalle, setCompraDetalle] = useState(null);

  const fetchData = async () => {
    try {
      const [comps, provs] = await Promise.all([
        comprasService.getAll(),
        proveedoresService.getAll(),
      ]);
      setCompras(comps);
      setProveedores(provs);
    } catch (error) {
      toast.error("Error al cargar los ingresos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = compras.filter(
    (c) =>
      c.numero_compra?.toLowerCase().includes(search.toLowerCase()) ||
      proveedores
        .find((p) => p.id === c.proveedor_id)
        ?.nombre?.toLowerCase()
        .includes(search.toLowerCase()),
  );

  const handleCancelar = async () => {
    try {
      await comprasService.cancelar(compraCancelar.id);
      toast.success("Ingreso anulado: se restó el stock que había sumado");
      setCompraCancelar(null);
      fetchData();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Error al anular el ingreso",
      );
      setCompraCancelar(null);
    }
  };


  const tabla = useTabla(filtered, {
    porPagina: 20,
    ordenInicial: { campo: "fecha", dir: "desc" },
    accessors: {
      proveedor: (c) => proveedores.find((p) => p.id === c.proveedor_id)?.nombre || "",
      cantidad: (c) => c.items?.length || 0,
      sucursal: (c) => nombreSucursal(c.sucursal || "sucursal_1"),
      fecha: (c) => (c.fecha ? new Date(c.fecha).getTime() : null)
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {tab === "proveedores" ? "Proveedores" : "Ingresos de mercadería"}
        </h1>
      </div>

      {tab === "proveedores" ? (
        <GestionProveedores />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              {compras.length} ingresos registrados · lo que llega de los proveedores
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
            >
              <Plus size={18} />
              Nuevo ingreso
            </button>
          </div>

          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              type="text"
              placeholder="Buscar por número o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Truck size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay ingresos registrados</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <ThOrdenable campo="numero_compra" tabla={tabla} className="px-6 py-3">Número</ThOrdenable>
                      <ThOrdenable campo="proveedor" tabla={tabla} className="px-6 py-3">Proveedor</ThOrdenable>
                      <ThOrdenable campo="sucursal" tabla={tabla} className="px-6 py-3">Sucursal</ThOrdenable>
                      <ThOrdenable campo="cantidad" tabla={tabla} className="px-6 py-3">Cant.</ThOrdenable>
                      <ThOrdenable campo="total" tabla={tabla} className="px-6 py-3">Total</ThOrdenable>
                      <ThOrdenable campo="fecha" tabla={tabla} className="px-6 py-3">Fecha</ThOrdenable>
                      <ThOrdenable campo="estado" tabla={tabla} className="px-6 py-3">Estado</ThOrdenable>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tabla.filas.map((compra) => (
                      <FilaCompra
                        key={compra._id}
                        compra={compra}
                        proveedores={proveedores}
                        onVerDetalle={setCompraDetalle}
                        onCancel={
                          puedeCancelar
                            ? (id, numero) => setCompraCancelar({ id, numero })
                            : null
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {tabla.filas.map((compra) => {
                  const proveedor = proveedores.find(
                    (p) => p.id === compra.proveedor_id,
                  );
                  return (
                    <CardCompraMobile
                      key={compra._id}
                      compra={compra}
                      proveedor={proveedor}
                      onVerDetalle={setCompraDetalle}
                      onCancel={
                        puedeCancelar
                          ? (id, numero) => setCompraCancelar({ id, numero })
                          : null
                      }
                    />
                  );
                })}
              </div>

          <Paginacion
            total={tabla.total}
            porPagina={tabla.porPagina}
            paginaActual={tabla.pagina}
            onChange={tabla.setPagina}
          />
            </>
          )}
          {showModal && (
            <NuevaCompraModal
              onClose={() => setShowModal(false)}
              onSave={() => {
                setShowModal(false);
                fetchData();
              }}
            />
          )}
        </div>
      )}

      {compraDetalle && (
        <ModalDetalleCompra
          compra={compraDetalle}
          proveedor={proveedores.find(
            (p) => p.id === compraDetalle.proveedor_id,
          )}
          onClose={() => setCompraDetalle(null)}
        />
      )}

      {compraCancelar && (
        <ModalConfirmar
          mensaje={`¿Anular el ingreso ${compraCancelar.numero}? Se va a restar el stock que había sumado.`}
          onConfirmar={handleCancelar}
          onCancelar={() => setCompraCancelar(null)}
        />
      )}
    </div>
  );
}
