import SelectorCategoria from "../components/ui/SelectorCategoria";
import InputNumero from "../components/ui/InputNumero";
import InputPrecio, { SelectorMoneda } from "../components/ui/InputPrecio";
import { categoriasService } from "../services/categorias.service";
import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  Search,
  PlusCircle,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Tag,
  ToggleLeft,
  Eye,
  AlertTriangle,
} from "lucide-react";
import MenuAcciones from "../components/ui/MenuAcciones";
import { productosService } from "../services/productos.service";
import toast from "react-hot-toast";
import PrecioUSD from "../components/ui/PrecioUSD";
import ThOrdenable from "../components/ui/ThOrdenable";
import { useTabla } from "../hooks/useTabla";
import {
  formatCurrency,
  formatDate,
  SUCURSALES,
  nombreSucursal,
  stockEn,
  minimoEn,
} from "../utils/helpers";
import { exportarListaPrecios } from "../utils/exportExcel";
import Paginacion from "../components/ui/Paginacion";

const mapaVacio = (valor = 0) =>
  Object.fromEntries(SUCURSALES.map((s) => [s.value, valor]));

const mapaDe = (item, campo) =>
  Object.fromEntries(
    SUCURSALES.map((s) => [
      s.value,
      campo === "stock" ? stockEn(item, s.value) : minimoEn(item, s.value),
    ]),
  );

const aEntero = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

const mapaAEnteros = (m) =>
  Object.fromEntries(SUCURSALES.map((s) => [s.value, aEntero(m?.[s.value])]));

// Sucursales cuyo stock está por debajo de su mínimo
const sucursalesBajas = (item) =>
  SUCURSALES.filter((s) => stockEn(item, s.value) < minimoEn(item, s.value));

const tieneStockBajo = (item) => sucursalesBajas(item).length > 0;

const stockTotalDe = (item) => item?.stock_actual ?? 0;

// Stock de un producto en una sucursal (suma de variantes si tiene) y si está bajo su mínimo
const stockDeSucursal = (p, suc) =>
  p.tiene_variantes
    ? (p.variantes || []).reduce((a, v) => a + stockEn(v, suc), 0)
    : stockEn(p, suc);
const bajoEnSucursal = (p, suc) =>
  p.tiene_variantes
    ? (p.variantes || []).some((v) => stockEn(v, suc) < minimoEn(v, suc))
    : stockEn(p, suc) < minimoEn(p, suc);

// Celda de stock de una sucursal: un solo número, en rojo si está bajo el mínimo
function CeldaStock({ producto, sucursal }) {
  const bajo = bajoEnSucursal(producto, sucursal);
  return (
    <span
      title={bajo ? "Stock bajo el mínimo" : undefined}
      className={`inline-flex items-center gap-1 text-sm ${
        bajo ? "font-semibold text-red-600" : "text-gray-700"
      }`}
    >
      {bajo && <AlertTriangle size={13} />}
      {stockDeSucursal(producto, sucursal)}
    </span>
  );
}

// Total + desglose chico por sucursal, con alerta por sucursal
function StockDesglose({ item }) {
  const bajas = sucursalesBajas(item);
  const bajo = bajas.length > 0;
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${
          bajo ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
        }`}
      >
        Total {stockTotalDe(item)}
      </span>
      <span className="text-[11px] text-gray-500 whitespace-nowrap">
        {SUCURSALES.map((s, i) => (
          <span
            key={s.value}
            className={
              bajas.some((b) => b.value === s.value)
                ? "text-red-600 font-medium"
                : ""
            }
          >
            {i > 0 && " · "}S{i + 1}: {stockEn(item, s.value)}
          </span>
        ))}
      </span>
      {bajo && (
        <span className="text-[11px] text-red-600">
          Stock bajo: {bajas.map((b) => nombreSucursal(b.value)).join(", ")}
        </span>
      )}
    </div>
  );
}

// Bloque de inputs "Stock por sucursal" (stock inicial + mínimo)
function StockPorSucursal({
  stock,
  minimo,
  onStock,
  onMinimo,
  stockSoloLectura,
  rounded = "rounded-lg",
}) {
  const clase = `w-full px-3 py-2 border border-gray-300 ${rounded} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500`;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600">Stock por sucursal</p>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 items-end">
        <span />
        <span className="text-xs text-gray-500">
          {stockSoloLectura ? "Stock actual" : "Stock inicial *"}
        </span>
        <span className="text-xs text-gray-500">Stock mínimo</span>
        {SUCURSALES.map((s) => (
          <div key={s.value} className="contents">
            <span className="text-sm text-gray-700 self-center">{s.label}</span>
            <InputNumero
              value={stock?.[s.value] ?? ""}
              onChange={(v) => onStock(s.value, v)}
              decimales={0}
              disabled={stockSoloLectura}
              required={!stockSoloLectura}
              className={clase}
            />
            <InputNumero
              value={minimo?.[s.value] ?? 0}
              onChange={(v) => onMinimo(s.value, v)}
              decimales={0}
              className={clase}
            />
          </div>
        ))}
      </div>
      {stockSoloLectura && (
        <p className="text-xs text-gray-400">
          El stock se modifica desde el módulo Stock
        </p>
      )}
    </div>
  );
}

const generarCodigoBarras = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `${timestamp}${random}`;
};

function VarianteForm({
  variante,
  index,
  onChange,
  onRemove,
  precioGlobal,
  moneda,
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Variante {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700"
        >
          <MinusCircle size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nombre *
          </label>
          <input
            type="text"
            required
            value={variante.nombre}
            onChange={(e) => onChange(index, "nombre", e.target.value)}
            placeholder="ej: Rojo 500ml"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Código de barras
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={variante.codigo_barras}
              onChange={(e) => onChange(index, "codigo_barras", e.target.value)}
              placeholder="Escaneá o escribí el código..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() =>
                onChange(index, "codigo_barras", generarCodigoBarras())
              }
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg text-xs text-gray-600 transition whitespace-nowrap"
            >
              Auto
            </button>
          </div>
        </div>
        {!precioGlobal && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Precio costo *
              </label>
              <InputPrecio
                pesos={variante.precio_costo}
                onChange={(v) =>
                  onChange(index, "precio_costo", v)}
                required
                              moneda={moneda}
                key={moneda}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Precio venta *
              </label>
              <InputPrecio
                pesos={variante.precio_venta}
                onChange={(v) =>
                  onChange(index, "precio_venta", v)}
                required
                              moneda={moneda}
                key={moneda}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
        <div className="col-span-2">
          <StockPorSucursal
            stock={variante.stock_sucursal}
            minimo={variante.stock_minimo_sucursal}
            onStock={(suc, v) =>
              onChange(index, "stock_sucursal", {
                ...variante.stock_sucursal,
                [suc]: v,
              })
            }
            onMinimo={(suc, v) =>
              onChange(index, "stock_minimo_sucursal", {
                ...variante.stock_minimo_sucursal,
                [suc]: v,
              })
            }
            stockSoloLectura={!!variante.id}
          />
        </div>
      </div>
    </div>
  );
}

function ProductoModal({ producto, categorias, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: producto?.nombre || "",
    descripcion: producto?.descripcion || "",
    categoria_id: producto?.categoria_id || "",
    codigo_barras: producto?.codigo_barras || generarCodigoBarras(),
    unidad_medida: "unidad",
    tiene_variantes: producto?.tiene_variantes || false,
    variantes: (producto?.variantes || []).map((v) => ({
      ...v,
      stock_sucursal: mapaDe(v, "stock"),
      stock_minimo_sucursal: mapaDe(v, "minimo"),
    })),
    precio_costo: producto?.precio_costo || "",
    precio_venta: producto?.precio_venta || "",
    stock_sucursal: producto ? mapaDe(producto, "stock") : mapaVacio(""),
    stock_minimo_sucursal: producto ? mapaDe(producto, "minimo") : mapaVacio(0),
  });
  const [precioGlobal, setPrecioGlobal] = useState(false);
  const [moneda, setMoneda] = useState("ars");
  const [precioCostoGlobal, setPrecioCostoGlobal] = useState("");
  const [precioVentaGlobal, setPrecioVentaGlobal] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVarianteChange = (index, field, value) => {
    const newVariantes = [...form.variantes];
    newVariantes[index] = { ...newVariantes[index], [field]: value };
    setForm({ ...form, variantes: newVariantes });
  };

  const addVariante = () => {
    setForm({
      ...form,
      variantes: [
        ...form.variantes,
        {
          nombre: "",
          codigo_barras: generarCodigoBarras(),
          precio_costo: precioGlobal ? parseFloat(precioCostoGlobal) || 0 : 0,
          precio_venta: precioGlobal ? parseFloat(precioVentaGlobal) || 0 : 0,
          stock_sucursal: mapaVacio(""),
          stock_minimo_sucursal: mapaVacio(0),
        },
      ],
    });
  };

  const removeVariante = (index) => {
    setForm({
      ...form,
      variantes: form.variantes.filter((_, i) => i !== index),
    });
  };

  const aplicarPrecioGlobal = () => {
    if (!precioCostoGlobal && !precioVentaGlobal) return;
    const newVariantes = form.variantes.map((v) => ({
      ...v,
      precio_costo: parseFloat(precioCostoGlobal) || v.precio_costo,
      precio_venta: parseFloat(precioVentaGlobal) || v.precio_venta,
    }));
    setForm({ ...form, variantes: newVariantes });
    toast.success("Precios aplicados a todas las variantes");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.categoria_id) {
      toast.error("Seleccioná una categoría");
      return;
    }
    setLoading(true);
    try {
      let variantes = form.variantes;
      if (precioGlobal && (precioCostoGlobal || precioVentaGlobal)) {
        variantes = form.variantes.map((v) => ({
          ...v,
          precio_costo: parseFloat(precioCostoGlobal) || v.precio_costo,
          precio_venta: parseFloat(precioVentaGlobal) || v.precio_venta,
        }));
      }
      if (form.tiene_variantes) {
        const falta = variantes.some(
          (v) =>
            !v.id &&
            SUCURSALES.some(
              (s) => v.stock_sucursal?.[s.value] === "" || v.stock_sucursal?.[s.value] == null,
            ),
        );
        if (falta) {
          toast.error("Cargá el stock inicial de cada sucursal en las variantes nuevas");
          setLoading(false);
          return;
        }
      }
      variantes = variantes.map((v) => {
        // eslint-disable-next-line no-unused-vars
        const { stock_actual, stock_minimo, stock_sucursal, ...resto } = v;
        const base = {
          ...resto,
          stock_minimo_sucursal: mapaAEnteros(v.stock_minimo_sucursal),
        };
        // El stock de variantes existentes no se envía: solo cambia por movimientos
        return v.id
          ? base
          : { ...base, stock_sucursal: mapaAEnteros(stock_sucursal) };
      });
      // eslint-disable-next-line no-unused-vars
      const { stock_sucursal, stock_minimo_sucursal, ...formBase } = form;
      const data = {
        ...formBase,
        variantes,
        precio_costo: form.tiene_variantes
          ? null
          : parseFloat(form.precio_costo),
        precio_venta: form.tiene_variantes
          ? null
          : parseFloat(form.precio_venta),
        stock_minimo_sucursal: form.tiene_variantes
          ? mapaVacio(0)
          : mapaAEnteros(stock_minimo_sucursal),
        codigo_barras: form.codigo_barras || null,
      };
      // En la creación el stock inicial va en el producto o en cada variante;
      // en la edición el backend ignora el stock existente.
      if (!producto) {
        data.stock_sucursal = form.tiene_variantes
          ? mapaVacio(0)
          : mapaAEnteros(stock_sucursal);
      }
      if (producto) {
        await productosService.update(producto.id, data);
        toast.success("Producto actualizado");
      } else {
        await productosService.create(data);
        toast.success("Producto creado");
      }
      onSave();
    } catch (error) {
      const detalle = error.response?.data?.detail;
      toast.error(
        typeof detalle === "string" ? detalle : "Error al guardar el producto",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">
            {producto ? "Editar Producto" : "Nuevo Producto"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría *
              </label>
              <SelectorCategoria
                categorias={categorias}
                value={form.categoria_id}
                onChange={(id) => setForm({ ...form, categoria_id: id })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de barras
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.codigo_barras}
                  onChange={(e) =>
                    setForm({ ...form, codigo_barras: e.target.value })
                  }
                  placeholder="Escaneá o escribí el código..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus={false}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, codigo_barras: Date.now().toString() })
                  }
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition"
                >
                  Generar
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Podés escanear el código del empaque directamente en este campo
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="tiene_variantes"
              checked={form.tiene_variantes}
              onChange={(e) =>
                setForm({
                  ...form,
                  tiene_variantes: e.target.checked,
                  variantes: [],
                })
              }
              className="w-4 h-4 text-blue-600"
            />
            <label
              htmlFor="tiene_variantes"
              className="text-sm font-medium text-gray-700"
            >
              Este producto tiene variantes (color, tamaño, etc.)
            </label>
          </div>

          <SelectorMoneda moneda={moneda} onChange={setMoneda} />

          {!form.tiene_variantes && (
            <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Precio costo *
                </label>
                <InputPrecio
                  pesos={form.precio_costo}
                  onChange={(v) =>
                    setForm({ ...form, precio_costo: v })}
                  required
                                  moneda={moneda}
                  key={moneda}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Precio venta *
                </label>
                <InputPrecio
                  pesos={form.precio_venta}
                  onChange={(v) =>
                    setForm({ ...form, precio_venta: v })}
                  required
                                  moneda={moneda}
                  key={moneda}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <StockPorSucursal
              stock={form.stock_sucursal}
              minimo={form.stock_minimo_sucursal}
              onStock={(suc, v) =>
                setForm({
                  ...form,
                  stock_sucursal: { ...form.stock_sucursal, [suc]: v },
                })
              }
              onMinimo={(suc, v) =>
                setForm({
                  ...form,
                  stock_minimo_sucursal: {
                    ...form.stock_minimo_sucursal,
                    [suc]: v,
                  },
                })
              }
              stockSoloLectura={!!producto}
              rounded="rounded-xl"
            />
            </div>
          )}

          {form.tiene_variantes && (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="precio_global"
                    checked={precioGlobal}
                    onChange={(e) => setPrecioGlobal(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label
                    htmlFor="precio_global"
                    className="text-sm font-medium text-blue-800"
                  >
                    Usar el mismo precio para todas las variantes
                  </label>
                </div>
                {precioGlobal && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">
                        Precio costo global
                      </label>
                      <InputPrecio
                        pesos={precioCostoGlobal}
                        onChange={(v) => setPrecioCostoGlobal(v)}
                                              moneda={moneda}
                        key={moneda}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">
                        Precio venta global
                      </label>
                      <InputPrecio
                        pesos={precioVentaGlobal}
                        onChange={(v) => setPrecioVentaGlobal(v)}
                                              moneda={moneda}
                        key={moneda}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={aplicarPrecioGlobal}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                      >
                        Aplicar a todas las variantes
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Variantes
                </span>
                <button
                  type="button"
                  onClick={addVariante}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <PlusCircle size={16} />
                  Agregar variante
                </button>
              </div>
              {form.variantes.map((v, i) => (
                <VarianteForm
                  key={i}
                  variante={v}
                  index={i}
                  onChange={handleVarianteChange}
                  onRemove={() => removeVariante(i)}
                  precioGlobal={precioGlobal}
                  moneda={moneda}
                />
              ))}
              {form.variantes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No hay variantes. Hacé click en "Agregar variante".
                </p>
              )}
            </div>
          )}

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

function accionesProducto({ producto, onEdit, onDelete, onToggleDetalle, expandido }) {
  return [
    {
      label: "Editar",
      icono: <Edit size={14} />,
      onClick: () => onEdit(producto),
    },
    onToggleDetalle && {
      label: producto.tiene_variantes
        ? expandido
          ? "Ocultar variantes"
          : "Ver variantes"
        : expandido
          ? "Ocultar detalle"
          : "Ver detalle",
      icono: <Eye size={14} />,
      onClick: onToggleDetalle,
    },
    {
      label: producto.activo ? "Desactivar" : "Activar",
      icono: producto.activo ? <Trash2 size={14} /> : <ToggleLeft size={14} />,
      onClick: () => onDelete(producto.id),
      peligro: producto.activo,
    },
  ];
}

const thSub = "text-center px-4 py-2 text-xs font-medium text-gray-500";

function MinimosSucursal({ item }) {
  return (
    <span className="text-xs text-gray-500 whitespace-nowrap">
      {SUCURSALES.map((s, i) => (
        <span key={s.value}>
          {i > 0 && " · "}S{i + 1}: {minimoEn(item, s.value)}
        </span>
      ))}
    </span>
  );
}

function FilaProducto({ producto, categorias, onEdit, onDelete }) {
  const [expandido, setExpandido] = useState(false);
  const getNombreCategoria = (id) =>
    categorias.find((c) => c.id === id)?.nombre || "-";
  const toggle = () => setExpandido(!expandido);

  return (
    <>
      <tr className="hover:bg-gray-50 transition-[background-color]">
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-800">{producto.nombre}</p>
            {producto.tiene_variantes && (
              <button
                type="button"
                onClick={toggle}
                className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-md whitespace-nowrap hover:bg-blue-100"
              >
                {producto.variantes.length} variantes
              </button>
            )}
            {!producto.activo && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                Inactivo
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">
          {getNombreCategoria(producto.categoria_id)}
        </td>
        <td className="col-num px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
          {producto.tiene_variantes
            ? `Desde ${formatCurrency(Math.min(...producto.variantes.map((v) => v.precio_venta)))}`
            : formatCurrency(producto.precio_venta)}
          <PrecioUSD
            className="ml-2"
            pesos={
              producto.tiene_variantes
                ? Math.min(...producto.variantes.map((v) => v.precio_venta))
                : producto.precio_venta
            }
          />
        </td>
        {SUCURSALES.map((suc) => (
          <td key={suc.value} className="col-num px-6 py-4 ">
            <CeldaStock producto={producto} sucursal={suc.value} />
          </td>
        ))}
        <td className="col-centro px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
          {producto.fecha_creacion ? formatDate(producto.fecha_creacion) : "-"}
        </td>
        <td className="col-acc px-6 py-4 ">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={toggle}
              className="p-1 text-gray-400 hover:text-blue-600 transition"
              title={expandido ? "Contraer" : "Expandir"}
            >
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <MenuAcciones
              acciones={accionesProducto({
                producto,
                onEdit,
                onDelete,
                onToggleDetalle: toggle,
                expandido,
              })}
            />
          </div>
        </td>
      </tr>

      {/* Fila expandida */}
      {expandido && (
        <tr>
          <td colSpan={7} className="px-6 pb-4 bg-gray-50">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {producto.tiene_variantes ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className={thSub}>Variante</th>
                      <th className={thSub}>Cód. Barras</th>
                      <th className={thSub}>P. Costo</th>
                      <th className={thSub}>P. Venta</th>
                      <th className={thSub}>Stock Suc. 1</th>
                      <th className={thSub}>Stock Suc. 2</th>
                      <th className={thSub}>Mín. Suc. 1</th>
                      <th className={thSub}>Mín. Suc. 2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {producto.variantes.map((v, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-4 py-2 font-medium text-gray-700">
                          {v.nombre}
                        </td>
                        <td className="col-centro px-4 py-2 text-gray-500 text-xs">
                          {v.codigo_barras || "-"}
                        </td>
                        <td className="col-num px-4 py-2 text-gray-600">
                          {formatCurrency(v.precio_costo)}
                        </td>
                        <td className="col-num px-4 py-2 text-gray-600">
                          {formatCurrency(v.precio_venta)}
                          <PrecioUSD pesos={v.precio_venta} className="block" />
                        </td>
                        {SUCURSALES.map((suc) => (
                          <td key={suc.value} className="col-num px-4 py-2">
                            <CeldaStock producto={v} sucursal={suc.value} />
                          </td>
                        ))}
                        {SUCURSALES.map((suc) => (
                          <td key={`min-${suc.value}`} className="col-num px-4 py-2 text-gray-500">
                            {minimoEn(v, suc.value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className={thSub}>Cód. Barras</th>
                      <th className={thSub}>Descripción</th>
                      <th className={thSub}>P. Costo</th>
                      <th className={thSub}>P. Venta</th>
                      <th className={thSub}>Stock Suc. 1</th>
                      <th className={thSub}>Stock Suc. 2</th>
                      <th className={thSub}>Mín. Suc. 1</th>
                      <th className={thSub}>Mín. Suc. 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="col-centro px-4 py-2 text-gray-500 text-xs">
                        {producto.codigo_barras || "-"}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {producto.descripcion || "-"}
                      </td>
                      <td className="col-num px-4 py-2 text-gray-600">
                        {formatCurrency(producto.precio_costo)}
                      </td>
                      <td className="col-num px-4 py-2 text-gray-600">
                        {formatCurrency(producto.precio_venta)}
                        <PrecioUSD pesos={producto.precio_venta} className="block" />
                      </td>
                      {SUCURSALES.map((suc) => (
                        <td key={suc.value} className="col-num px-4 py-2">
                          <CeldaStock producto={producto} sucursal={suc.value} />
                        </td>
                      ))}
                      {SUCURSALES.map((suc) => (
                        <td key={`min-${suc.value}`} className="col-num px-4 py-2 text-gray-500">
                          {minimoEn(producto, suc.value)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CategoriaModal({ categoria, categorias, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: categoria?.nombre || "",
    descripcion: categoria?.descripcion || "",
    categoria_padre_id: categoria?.categoria_padre_id || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        categoria_padre_id: form.categoria_padre_id || null,
      };
      if (categoria) {
        await categoriasService.update(categoria.id, data);
        toast.success("Categoría actualizada");
      } else {
        await categoriasService.create(data);
        toast.success("Categoría creada");
      }
      onSave();
    } catch (error) {
      toast.error("Error al guardar la categoría");
    } finally {
      setLoading(false);
    }
  };
  const padres = categorias.filter((c) => c.id !== categoria?.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {categoria ? "Editar Categoría" : "Nueva Categoría"}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría padre
            </label>
            <SelectorCategoria
              categorias={categorias}
              value={form.categoria_padre_id}
              onChange={(id) => setForm({ ...form, categoria_padre_id: id })}
              textoVacio="Sin categoría padre"
              permitirVacio
              excluirId={categoria?.id}
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

function GestionCategorias({ onCambio }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const filtered = categorias.filter((c) => {
    if (busqueda && !c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      return false;
    if (filtroEstado === "activo" && !c.activo) return false;
    if (filtroEstado === "inactivo" && c.activo) return false;
    return true;
  });

  const fetchCategorias = async () => {
    try {
      const data = await categoriasService.getAll();
      setCategorias(data);
      // Avisa a la pantalla de Productos para que el modal de producto
      // vea siempre las categorías actuales.
      onCambio?.(data);
    } catch (error) {
      toast.error("Error al cargar categorías");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const getNombrePadre = (id) =>
    categorias.find((c) => c.id === id)?.nombre || "-";

  const handleToggle = async (categoria) => {
    const accion = categoria.activo ? "desactivar" : "activar";
    if (
      !confirm(
        `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} esta categoría?`,
      )
    )
      return;
    try {
      await categoriasService.delete(categoria.id);
      toast.success(
        `Categoría ${accion === "desactivar" ? "desactivada" : "activada"}`,
      );
      fetchCategorias();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };


  const accionesCategoria = (categoria) => [
    {
      label: "Editar",
      icono: <Edit size={14} />,
      onClick: () => {
        setSelectedCategoria(categoria);
        setShowModal(true);
      },
    },
    {
      label: categoria.activo ? "Desactivar" : "Activar",
      icono: categoria.activo ? <Trash2 size={14} /> : <ToggleLeft size={14} />,
      onClick: () => handleToggle(categoria),
      peligro: categoria.activo,
    },
  ];

  const tabla = useTabla(filtered, {
    porPagina: 20,
    ordenInicial: { campo: "nombre", dir: "asc" },
    accessors: {
      padre: (c) => (c.categoria_padre_id ? getNombrePadre(c.categoria_padre_id) : null)
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setSelectedCategoria(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={18} />
          Nueva Categoría
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Buscar tipo de reparación..."
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
      ) : categorias.length === 0 ? (
        <div className="text-center py-12">
          <Tag size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay categorías registradas</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <ThOrdenable campo="nombre" tabla={tabla} align="center" className="px-6 py-3">Nombre</ThOrdenable>
                  <ThOrdenable campo="descripcion" tabla={tabla} align="center" className="px-6 py-3">Descripción</ThOrdenable>
                  <ThOrdenable campo="padre" tabla={tabla} align="center" className="px-6 py-3">Categoría Padre</ThOrdenable>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabla.filas.map((categoria) => (
                  <tr
                    key={categoria.id}
                    className="hover:bg-gray-50 transition-[background-color]"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Tag size={14} className="text-purple-600" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">
                            {categoria.nombre}
                          </span>
                          {!categoria.activo && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                              Inactiva
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {categoria.descripcion || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {categoria.categoria_padre_id
                        ? getNombrePadre(categoria.categoria_padre_id)
                        : "-"}
                    </td>
                    <td className="col-acc px-6 py-4 ">
                      <MenuAcciones acciones={accionesCategoria(categoria)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {tabla.filas.map((categoria) => (
              <div
                key={categoria.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                      <Tag size={16} className="text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">
                          {categoria.nombre}
                        </p>
                        {!categoria.activo && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                            Inactiva
                          </span>
                        )}
                      </div>
                      {categoria.descripcion && (
                        <p className="text-xs text-gray-500">
                          {categoria.descripcion}
                        </p>
                      )}
                      {categoria.categoria_padre_id && (
                        <p className="text-xs text-gray-400">
                          Subcategoría de:{" "}
                          {getNombrePadre(categoria.categoria_padre_id)}
                        </p>
                      )}
                    </div>
                  </div>
                  <MenuAcciones acciones={accionesCategoria(categoria)} />
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
        <CategoriaModal
          categoria={selectedCategoria}
          categorias={categorias}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchCategorias();
          }}
        />
      )}
    </div>
  );
}

export default function Productos() {
  const [tab, setTab] = useState("productos");
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [filtros, setFiltros] = useState({
    nombre: "",
    categoria_id: "",
    precio_min: "",
    precio_max: "",
    estado: "",
  });
  const [showFiltros, setShowFiltros] = useState(false);

  const fetchData = async () => {
    try {
      const [prods, cats] = await Promise.all([
        productosService.getAll(),
        categoriasService.getAll(),
      ]);
      setProductos(prods);
      setCategorias(cats);
    } catch (error) {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    const producto = productos.find((p) => p.id === id);
    const accion = producto?.activo ? "desactivar" : "activar";
    if (
      !confirm(
        `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este producto?`,
      )
    )
      return;
    try {
      await productosService.delete(id);
      toast.success(
        `Producto ${accion === "desactivar" ? "desactivado" : "activado"}`,
      );
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar producto");
    }
  };

  const limpiarFiltros = () =>
    setFiltros({
      nombre: "",
      categoria_id: "",
      precio_min: "",
      precio_max: "",
      stock: "",
      estado: "",
    });
  const filtrosActivos = Object.values(filtros).some((v) => v !== "");

  const getPrecioVenta = (producto) => {
    if (producto.tiene_variantes && producto.variantes.length > 0) {
      return Math.min(...producto.variantes.map((v) => v.precio_venta));
    }
    return producto.precio_venta || 0;
  };

  const filtered = productos.filter((p) => {
    if (
      filtros.nombre &&
      !p.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())
    )
      return false;
    if (filtros.categoria_id && p.categoria_id !== filtros.categoria_id)
      return false;
    const precio = getPrecioVenta(p);
    if (filtros.precio_min && precio < parseFloat(filtros.precio_min))
      return false;
    if (filtros.precio_max && precio > parseFloat(filtros.precio_max))
      return false;
    if (filtros.stock === "con_stock") {
      const tieneStock = p.tiene_variantes
        ? p.variantes.some((v) => v.stock_actual > 0)
        : p.stock_actual > 0;
      if (!tieneStock) return false;
    }
    if (filtros.stock === "sin_stock") {
      const sinStock = p.tiene_variantes
        ? p.variantes.every((v) => v.stock_actual === 0)
        : p.stock_actual === 0;
      if (!sinStock) return false;
    }
    if (filtros.estado === "activo" && !p.activo) return false;
    if (filtros.estado === "inactivo" && p.activo) return false;
    return true;
  });

  const handleExportar = () => {
    if (filtered.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }
    exportarListaPrecios(filtered, categorias);
    toast.success(`Lista de precios exportada (${filtered.length} productos)`);
  };

  const nombreCategoria = (id) =>
    categorias.find((c) => c.id === id)?.nombre || "";
  const fechaCreacion = (p) =>
    p.fecha_creacion ? new Date(p.fecha_creacion).getTime() : null;

  const tabla = useTabla(filtered, {
    porPagina: 20,
    ordenInicial: { campo: "fecha_creacion", dir: "desc" },
    accessors: {
      fecha_creacion: fechaCreacion,
      categoria: (p) => nombreCategoria(p.categoria_id),
      precio: getPrecioVenta,
      stock_sucursal_1: (p) => stockDeSucursal(p, "sucursal_1"),
      stock_sucursal_2: (p) => stockDeSucursal(p, "sucursal_2"),
    },
  });
  const productosPaginados = tabla.filas;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Productos</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => {
            setTab("productos");
            // Las categorías pudieron cambiar en la otra pestaña
            categoriasService
              .getAll()
              .then(setCategorias)
              .catch(() => {});
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "productos"
              ? "bg-white shadow text-gray-800"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setTab("categorias")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "categorias"
              ? "bg-white shadow text-gray-800"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Categorías
        </button>
      </div>

      {tab === "categorias" ? (
        <GestionCategorias onCambio={setCategorias} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm">
                {productos.length} productos registrados
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportar}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition text-sm font-medium"
              >
                <Download size={18} />
                Exportar lista
              </button>
              <button
                onClick={() => {
                  setSelectedProducto(null);
                  setShowModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
              >
                <Plus size={18} />
                Nuevo Producto
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={filtros.nombre}
                  onChange={(e) =>
                    setFiltros({ ...filtros, nombre: e.target.value })
                  }
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
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
                  onClick={limpiarFiltros}
                  className="px-4 py-2 rounded-xl text-sm text-red-600 border border-red-200 hover:bg-red-50 transition"
                >
                  Limpiar
                </button>
              )}
            </div>

            {showFiltros && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Categoría
                  </label>
                  <select
                    value={filtros.categoria_id}
                    onChange={(e) =>
                      setFiltros({ ...filtros, categoria_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas las categorías</option>
                    {categorias.filter((c) => c.activo !== false).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Precio mínimo
                  </label>
                  <InputNumero
                    value={filtros.precio_min}
                    onChange={(v) =>
                      setFiltros({ ...filtros, precio_min: v })}
                    placeholder="$ 0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Precio máximo
                  </label>
                  <InputNumero
                    value={filtros.precio_max}
                    onChange={(v) =>
                      setFiltros({ ...filtros, precio_max: v })}
                    placeholder="$ 0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Stock
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Estado
                  </label>
                  <select
                    value={filtros.estado}
                    onChange={(e) =>
                      setFiltros({ ...filtros, estado: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos</option>
                    <option value="activo">Activos</option>
                    <option value="inactivo">Inactivos</option>
                  </select>
                </div>
              </div>
            )}

            {filtrosActivos && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-blue-700">
                  {filtered.length} productos encontrados
                </span>
                <button
                  onClick={handleExportar}
                  className="flex items-center gap-1 text-sm text-blue-700 font-medium hover:text-blue-900"
                >
                  <Download size={14} /> Exportar estos {filtered.length}{" "}
                  productos
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No se encontraron productos</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <ThOrdenable campo="nombre" tabla={tabla} align="center" className="px-6 py-3">Producto</ThOrdenable>
                      <ThOrdenable campo="categoria" tabla={tabla} align="center" className="px-6 py-3">Categoría</ThOrdenable>
                      <ThOrdenable campo="precio" tabla={tabla} align="center" className="px-6 py-3">Precio Venta</ThOrdenable>
                      <ThOrdenable campo="stock_sucursal_1" tabla={tabla} align="center" className="px-6 py-3">Stock Suc. 1</ThOrdenable>
                      <ThOrdenable campo="stock_sucursal_2" tabla={tabla} align="center" className="px-6 py-3">Stock Suc. 2</ThOrdenable>
                      <ThOrdenable campo="fecha_creacion" tabla={tabla} align="center" className="px-6 py-3">Creado</ThOrdenable>
                      <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {productosPaginados.map((producto) => (
                      <FilaProducto
                        key={producto.id}
                        producto={producto}
                        categorias={categorias}
                        onEdit={(p) => {
                          setSelectedProducto(p);
                          setShowModal(true);
                        }}
                        onDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {productosPaginados.map((producto) => (
                  <div
                    key={producto.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                          <Package size={18} className="text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {producto.nombre}
                          </p>
                          {!producto.activo && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                              Inactivo
                            </span>
                          )}
                          <p className="text-xs text-gray-500">
                            {categorias.find(
                              (c) => c.id === producto.categoria_id,
                            )?.nombre || "-"}
                          </p>
                          {producto.fecha_creacion && (
                            <p className="text-xs text-gray-400">
                              Creado: {formatDate(producto.fecha_creacion)}
                            </p>
                          )}
                        </div>
                      </div>
                      <MenuAcciones
                        acciones={accionesProducto({
                          producto,
                          onEdit: (p) => {
                            setSelectedProducto(p);
                            setShowModal(true);
                          },
                          onDelete: handleDelete,
                        })}
                      />
                    </div>
                    {producto.tiene_variantes ? (
                      <div className="mt-2 space-y-1">
                        {producto.variantes.map((v, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg"
                          >
                            <span>{v.nombre}</span>
                            <div className="flex flex-col items-end">
                              <span className="font-medium">
                                {formatCurrency(v.precio_venta)}
                              </span>
                              <StockDesglose item={v} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(producto.precio_venta)}
                        </span>
                        <StockDesglose item={producto} />
                      </div>
                    )}
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
            <ProductoModal
              producto={selectedProducto}
              categorias={categorias}
              onClose={() => setShowModal(false)}
              onSave={() => {
                setShowModal(false);
                fetchData();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
