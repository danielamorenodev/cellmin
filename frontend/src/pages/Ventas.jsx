import { cajaService } from "../services/caja.service";
import InputNumero from "../components/ui/InputNumero";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Search,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  ExternalLink,
  Printer,
  Trash2,
  Eye,
  Ban,
  Minus,
} from "lucide-react";
import { ventasService } from "../services/ventas.service";
import { productosService } from "../services/productos.service";
import { clientesService } from "../services/clientes.service";
import toast from "react-hot-toast";
import PrecioUSD from "../components/ui/PrecioUSD";
import { useCotizacion } from "../hooks/useCotizacion";
import { useSucursales } from "../hooks/useSucursales";
import MenuAcciones from "../components/ui/MenuAcciones";
import {
  formatCurrency,
  formatDateTime,
  METODOS_PAGO,
  minimoEn,
  nombreSucursal,
  parsearMetodoPago,
  stockEn,
} from "../utils/helpers";
import { useAuth } from "../context/AuthContext";
import Paginacion from "../components/ui/Paginacion";
import ThOrdenable from "../components/ui/ThOrdenable";
import SelectorCliente from "../components/ui/SelectorCliente";
import { useTabla } from "../hooks/useTabla";
import TicketVenta from "../components/ui/TicketVenta";
import DetalleVenta from "../components/ui/DetalleVenta";

function estadoStock(stock, minimo) {
  if (stock <= 0) return "agotado";
  if (minimo > 0 && stock <= minimo) return "bajo";
  return "ok";
}

function ChipStock({ stock, minimo }) {
  const estado = estadoStock(stock, minimo);
  const estilos = {
    ok: "bg-green-50 text-green-700",
    bajo: "bg-yellow-50 text-yellow-700",
    agotado: "bg-red-50 text-red-600",
  };
  const texto = {
    ok: `Stock: ${stock}`,
    bajo: `Stock bajo: ${stock}`,
    agotado: "Agotado",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${estilos[estado]}`}
    >
      {texto[estado]}
    </span>
  );
}

function OpcionBusqueda({ opcion, activa, enCarrito, onElegir, onHover }) {
  const agotado = opcion.stock <= 0;
  return (
    <button
      type="button"
      role="option"
      aria-selected={activa}
      disabled={agotado}
      data-activa={activa ? "1" : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onHover}
      onClick={onElegir}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${
        agotado
          ? "bg-gray-50 cursor-not-allowed"
          : activa
            ? "bg-blue-50"
            : "bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${agotado ? "text-gray-400" : "text-gray-800"}`}
        >
          {opcion.nombre}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span
            className={`text-sm font-semibold ${agotado ? "text-gray-400" : "text-gray-700"}`}
          >
            {formatCurrency(opcion.precio)}
          </span>
          <PrecioUSD pesos={opcion.precio} />
          <ChipStock stock={opcion.stock} minimo={opcion.minimo} />
        </div>
      </div>
      {enCarrito > 0 && (
        <span className="px-1.5 rounded bg-blue-600 text-white text-xs">
          ×{enCarrito}
        </span>
      )}
    </button>
  );
}

// "sucursal" es la de la caja del usuario: de ahí sale el stock y ahí entra la venta
function NuevaVentaModal({ onClose, onSave, sucursal }) {
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [form, setForm] = useState({
    cliente_id: "",
    notas: "",
    sucursal,
  });
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const buscadorRef = useRef(null);
  const listaRef = useRef(null);
  const [tipoAjuste, setTipoAjuste] = useState("ninguno");
  const [porcentajeAjuste, setPorcentajeAjuste] = useState(0);
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagos, setPagos] = useState([{ metodo: "efectivo", monto: 0 }]);
  const [loading, setLoading] = useState(false);
  // Una clave por formulario abierto + bloqueo inmediato: un doble click no duplica la venta
  const claveVenta = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const enviando = useRef(false);
  const [montoEditado, setMontoEditado] = useState(false);
  const cotizacion = useCotizacion();

  useEffect(() => {
    Promise.all([productosService.getAll(), clientesService.getAll()]).then(
      ([prods, clients]) => {
        setProductos(prods);
        setClientes(clients);
      },
    );
  }, []);

  const termino = search.trim().toLowerCase();
  const LIMITE_LISTA = 30;

  // Opciones del combo: cada producto simple y cada variante es una opción
  const opciones = useMemo(() => {
    if (!termino) return [];
    const out = [];
    for (const p of productos) {
      if (p.activo === false) continue;
      const coincideProducto =
        p.nombre.toLowerCase().includes(termino) ||
        p.codigo_barras?.toLowerCase().includes(termino);
      if (p.tiene_variantes) {
        for (const v of p.variantes || []) {
          const coincideVariante =
            v.nombre?.toLowerCase().includes(termino) ||
            v.sku?.toLowerCase().includes(termino) ||
            v.codigo_barras?.toLowerCase().includes(termino);
          if (coincideProducto || coincideVariante) {
            out.push({
              key: `${p.id}-${v.nombre}`,
              producto: p,
              variante: v,
              nombre: `${p.nombre} — ${v.nombre}`,
              precio: v.precio_venta,
              stock: stockEn(v, sucursal),
              minimo: minimoEn(v, sucursal),
            });
          }
        }
      } else if (coincideProducto) {
        out.push({
          key: p.id,
          producto: p,
          variante: null,
          nombre: p.nombre,
          precio: p.precio_venta,
          stock: stockEn(p, sucursal),
          minimo: minimoEn(p, sucursal),
        });
      }
    }
    return out;
  }, [productos, termino, sucursal]);
  const opcionesVisibles = opciones.slice(0, LIMITE_LISTA);

  const elegirOpcion = (o) => {
    if (!o) return;
    agregarAlCarrito(o.producto, o.variante);
    setSearch("");
    setActivo(0);
    setAbierto(false);
    buscadorRef.current?.focus();
  };

  // Enter en el buscador: un código exacto (lector de código de barras o SKU)
  // agrega ese producto o variante; si no, la opción resaltada del combo
  const agregarPorCodigo = () => {
    if (!termino) return;
    for (const p of productos) {
      if (p.activo === false) continue;
      if (p.codigo_barras?.toLowerCase() === termino && !p.tiene_variantes) {
        return elegirOpcion({ producto: p, variante: null });
      }
      const v = p.variantes?.find(
        (x) =>
          x.codigo_barras?.toLowerCase() === termino ||
          x.sku?.toLowerCase() === termino,
      );
      if (v) return elegirOpcion({ producto: p, variante: v });
    }
    elegirOpcion(opcionesVisibles[activo] || opcionesVisibles[0]);
  };

  // Mantiene visible la opción resaltada al navegar con el teclado
  useEffect(() => {
    listaRef.current
      ?.querySelector('[data-activa="1"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activo, abierto]);

  const cantidadEnCarrito = (producto, variante = null) =>
    carrito.find(
      (i) =>
        i.key === (variante ? `${producto.id}-${variante.nombre}` : producto.id),
    )?.cantidad || 0;

  const agregarAlCarrito = (producto, variante = null) => {
    const key = variante ? `${producto.id}-${variante.nombre}` : producto.id;
    const stockDisponible = stockEn(variante || producto, sucursal);
    const existente = carrito.find((item) => item.key === key);

    if (stockDisponible <= 0) {
      toast.error("Sin stock disponible");
      return;
    }

    if (existente) {
      if (existente.cantidad + 1 > stockDisponible) {
        toast.error(`Solo hay ${stockDisponible} unidades disponibles`);
        return;
      }
      setCarrito(
        carrito.map((item) =>
          item.key === key
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: (item.cantidad + 1) * item.precio_unitario,
              }
            : item,
        ),
      );
    } else {
      const precio = variante ? variante.precio_venta : producto.precio_venta;
      setCarrito([
        ...carrito,
        {
          key,
          producto_id: producto.id,
          variante_nombre: variante?.nombre || null,
          nombre_producto: variante
            ? `${producto.nombre} — ${variante.nombre}`
            : producto.nombre,
          cantidad: 1,
          precio_unitario: precio,
          subtotal: precio,
          stock_disponible: stockDisponible,
        },
      ]);
    }
  };

  const actualizarCantidad = (key, cantidad) => {
    if (cantidad <= 0) {
      setCarrito(carrito.filter((item) => item.key !== key));
      return;
    }
    const item = carrito.find((i) => i.key === key);
    if (item && cantidad > item.stock_disponible) {
      toast.error(`Solo hay ${item.stock_disponible} unidades disponibles`);
      return;
    }
    setCarrito(
      carrito.map((i) =>
        i.key === key
          ? { ...i, cantidad, subtotal: cantidad * i.precio_unitario }
          : i,
      ),
    );
  };

  const fijarCantidad = (key, texto) => {
    const n = parseInt(texto, 10);
    if (Number.isNaN(n) || n < 1) return;
    actualizarCantidad(key, n);
  };

  const quitarDelCarrito = (key) =>
    setCarrito(carrito.filter((item) => item.key !== key));

  const subtotal = carrito.reduce((acc, item) => acc + item.subtotal, 0);
  const porcentaje = parseFloat(porcentajeAjuste) || 0;
  const montoAjuste = subtotal * (porcentaje / 100);
  const total =
    tipoAjuste === "descuento"
      ? subtotal - montoAjuste
      : tipoAjuste === "interes"
        ? subtotal + montoAjuste
        : subtotal;

  // Con medio "dólares" el monto de la línea es en US$. Todo se compara en
  // pesos con la cotización del dólar; lo que sobra es el vuelto.
  const esUSD = (p) => p.metodo === "usd";
  const pesosDe = (p) =>
    esUSD(p)
      ? (cotizacion.aPesos(parseFloat(p.monto) || 0) ?? 0)
      : parseFloat(p.monto) || 0;
  // Pesos -> monto de la línea (los dólares se redondean hacia arriba al centavo)
  const desdePesos = (metodo, pesos) =>
    metodo === "usd"
      ? Math.ceil((cotizacion.aUSD(pesos) ?? 0) * 100 - 1e-9) / 100
      : Math.round(pesos * 100) / 100;

  const hayUSD = pagos.some(esUSD);
  const esCobroEnEfectivo =
    !pagoMixto && (pagos[0]?.metodo === "efectivo" || pagos[0]?.metodo === "usd");
  const pagadoPesos = pagos.reduce((acc, p) => acc + pesosDe(p), 0);
  const diferencia = pagadoPesos - total; // > 0 sobra, < 0 falta
  const enEfectivo = pagos
    .filter((p) => p.metodo === "efectivo" || p.metodo === "usd")
    .reduce((acc, p) => acc + pesosDe(p), 0);

  const vuelto =
    (esCobroEnEfectivo || (pagoMixto && hayUSD)) && diferencia > 0.005
      ? Math.round(diferencia * 100) / 100
      : null;
  const faltaCobrar =
    (esCobroEnEfectivo || pagoMixto) && diferencia < -0.01 ? -diferencia : null;
  // Mixto sin dólares: tiene que dar justo. Con dólares puede sobrar, pero el
  // vuelto solo puede salir de lo cobrado en efectivo o en dólares.
  const mixtoExcede =
    pagoMixto &&
    diferencia > 0.01 &&
    (!hayUSD || diferencia > enEfectivo + 0.01);
  const sinCotizacion = hayUSD && !cotizacion.disponible;

  useEffect(() => {
    const p = pagos[0];
    if (!pagoMixto && (p?.metodo === "efectivo" || p?.metodo === "usd") && !montoEditado) {
      const sugerido = desdePesos(p.metodo, total);
      if (sugerido !== p.monto) setPagos([{ ...p, monto: sugerido }]);
    }
  }, [total, pagoMixto, pagos[0]?.metodo, montoEditado, cotizacion.venta]);

  const puedeConfirmar =
    carrito.length > 0 &&
    !loading &&
    faltaCobrar === null &&
    !mixtoExcede &&
    !sinCotizacion;

  const handlePagoChange = (index, field, value) => {
    if (!pagoMixto) {
      if (field === "monto") setMontoEditado(true);
      if (field === "metodo") setMontoEditado(false);
    }
    const newPagos = [...pagos];
    const anterior = newPagos[index];
    newPagos[index] = { ...anterior, [field]: value };
    // Si se cambia entre dólares y otro medio, se conserva el valor en pesos
    if (field === "metodo" && esUSD(anterior) !== (value === "usd")) {
      newPagos[index].monto = pagoMixto
        ? desdePesos(value, pesosDe(anterior))
        : 0;
    }
    // Pago mixto con 2 medios: el otro se autocompleta con lo que falta
    if (pagoMixto && newPagos.length === 2 && (field === "monto" || field === "metodo")) {
      const otro = index === 0 ? 1 : 0;
      const resto = Math.max(0, total - pesosDe(newPagos[index]));
      newPagos[otro] = {
        ...newPagos[otro],
        monto: desdePesos(newPagos[otro].metodo, resto),
      };
    }
    setPagos(newPagos);
  };

  const togglePagoMixto = (value) => {
    setMontoEditado(false);
    setPagoMixto(value);
    setPagos(
      value
        ? [
            { metodo: "efectivo", monto: 0 },
            { metodo: "transferencia", monto: 0 },
          ]
        : [{ metodo: "efectivo", monto: 0 }],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (carrito.length === 0) {
      toast.error("Agregá al menos un producto");
      return;
    }
    if (!puedeConfirmar) {
      toast.error("Revisá el pago: no coincide con el total a cobrar");
      return;
    }
    if (enviando.current) return;
    enviando.current = true;
    setLoading(true);
    try {
      const metodo_pago = pagoMixto
        ? pagos
            .map((p) =>
              esUSD(p)
                ? `usd: US$ ${p.monto}`
                : `${p.metodo}: ${formatCurrency(p.monto)}`,
            )
            .join(" + ")
        : pagos[0].metodo;
      const data = {
        ...form,
        cliente_id: form.cliente_id || null,
        clave_idempotencia: claveVenta.current,
        descuento: tipoAjuste === "descuento" ? montoAjuste : 0,
        total,
        tipo_ajuste: tipoAjuste,
        porcentaje_ajuste: porcentaje,
        pagos: pagos.map((p) => ({
          metodo: p.metodo,
          monto: parseFloat(p.monto) || 0,
        })),
        metodo_pago,
        items: carrito.map((item) => ({
          producto_id: item.producto_id,
          variante_nombre: item.variante_nombre,
          nombre_producto: item.nombre_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
        })),
      };
      const result = await ventasService.create(data);
      toast.success(
        result.vuelto > 0
          ? `Venta ${result.numero_venta} registrada. Vuelto: ${formatCurrency(result.vuelto)}`
          : `Venta ${result.numero_venta} registrada`,
      );
      onSave();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Error al registrar la venta",
      );
    } finally {
      enviando.current = false;
      setLoading(false);
    }
  };

  const inputBase =
    "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl h-[90vh] flex flex-col overflow-hidden">
        {/* Encabezado fijo */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Nueva Venta
            <span className="ml-2 text-sm font-normal text-gray-500">
              {nombreSucursal(sucursal)}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Contenido: en pantallas grandes cada columna tiene su propio scroll */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 overflow-y-auto lg:overflow-hidden">
          {/* Izquierda: buscador con combo + carrito */}
          <div className="flex flex-col min-h-0 p-6 gap-3 lg:border-r border-gray-100">
            <h3 className="font-medium text-gray-700 shrink-0">Agregar productos</h3>
            <div className="relative shrink-0 z-20">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={buscadorRef}
                type="text"
                autoFocus
                role="combobox"
                aria-expanded={abierto && !!termino}
                aria-autocomplete="list"
                placeholder="Buscar por nombre, SKU o escanear código de barras..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActivo(0);
                  setAbierto(true);
                }}
                onFocus={() => setAbierto(true)}
                onBlur={() => setAbierto(false)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setAbierto(true);
                    setActivo((a) => Math.min(a + 1, opcionesVisibles.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActivo((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    agregarPorCodigo();
                  } else if (e.key === "Escape" && (search || abierto)) {
                    e.stopPropagation();
                    setSearch("");
                    setAbierto(false);
                  }
                }}
                className={`${inputBase} pl-9 pr-9`}
              />
              {search && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSearch("");
                    buscadorRef.current?.focus();
                  }}
                  title="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              )}

              {abierto && termino && (
                <div
                  ref={listaRef}
                  role="listbox"
                  className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto divide-y divide-gray-100"
                >
                  {opcionesVisibles.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No se encontraron productos
                    </p>
                  ) : (
                    opcionesVisibles.map((o, i) => (
                      <OpcionBusqueda
                        key={o.key}
                        opcion={o}
                        activa={i === activo}
                        enCarrito={cantidadEnCarrito(o.producto, o.variante)}
                        onHover={() => setActivo(i)}
                        onElegir={() => elegirOpcion(o)}
                      />
                    ))
                  )}
                  {opciones.length > LIMITE_LISTA && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      Mostrando {LIMITE_LISTA} de {opciones.length}. Escribí más
                      para afinar la búsqueda.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1">
            <h3 className="font-medium text-gray-700 shrink-0">
              Carrito
              {carrito.length > 0 && (
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  {carrito.length} {carrito.length === 1 ? "artículo" : "artículos"}
                </span>
              )}
            </h3>
            {carrito.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl">
                <ShoppingCart size={20} className="text-gray-300 shrink-0" />
                <p className="text-sm text-gray-400">
                  El carrito está vacío. Buscá o escaneá un producto arriba.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {carrito.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="basis-full sm:basis-0 sm:flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 sm:truncate">
                        {item.nombre_producto}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.precio_unitario)} c/u · stock{" "}
                        {item.stock_disponible}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          actualizarCantidad(item.key, item.cantidad - 1)
                        }
                        className="w-7 h-7 bg-gray-200 rounded-lg hover:bg-gray-300 transition flex items-center justify-center"
                      >
                        <Minus size={12} />
                      </button>
                      <InputNumero
                        value={item.cantidad}
                        onChange={(v) => fijarCantidad(item.key, v)}
                        decimales={0}
                        max={item.stock_disponible}
                        className="w-12 h-7 text-center text-sm font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        disabled={item.cantidad >= item.stock_disponible}
                        title={
                          item.cantidad >= item.stock_disponible
                            ? "No hay más stock disponible"
                            : "Agregar una unidad"
                        }
                        onClick={() =>
                          actualizarCantidad(item.key, item.cantidad + 1)
                        }
                        className="w-7 h-7 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 sm:w-24 text-right ml-auto sm:ml-0">
                      {formatCurrency(item.subtotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarDelCarrito(item.key)}
                      title="Quitar del carrito"
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            </div>
          </div>

          {/* Derecha: cliente, ajuste, cobro */}
          <div className="min-h-0 p-6 space-y-4 lg:overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente
              </label>
              <SelectorCliente
                clientes={clientes}
                value={form.cliente_id}
                onChange={(id) => setForm({ ...form, cliente_id: id })}
              />
            </div>

            {/* Ajuste */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">
                Ajuste de precio
              </p>
              <div className="flex gap-2">
                {["ninguno", "descuento", "interes"].map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      setTipoAjuste(tipo);
                      setPorcentajeAjuste(0);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                      tipoAjuste === tipo
                        ? tipo === "descuento"
                          ? "bg-green-600 text-white"
                          : tipo === "interes"
                            ? "bg-orange-500 text-white"
                            : "bg-gray-700 text-white"
                        : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {tipo === "ninguno"
                      ? "Ninguno"
                      : tipo === "descuento"
                        ? "Descuento"
                        : "Interés"}
                  </button>
                ))}
              </div>
              {tipoAjuste !== "ninguno" && (
                <div className="flex items-center gap-2">
                  <InputNumero
                    value={porcentajeAjuste}
                    onChange={(v) => setPorcentajeAjuste(v)}
                    decimales={2}
                    completarDecimales={false}
                    max="100"
                    placeholder="0"
                    className={`flex-1 ${inputBase}`}
                  />
                  <span className="text-gray-500 font-medium">%</span>
                  <span
                    className={`text-sm font-medium ${tipoAjuste === "descuento" ? "text-green-600" : "text-orange-500"}`}
                  >
                    {tipoAjuste === "descuento" ? "-" : "+"}
                    {formatCurrency(montoAjuste)}
                  </span>
                </div>
              )}
            </div>

            {/* Pago */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  Medio de pago
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pagoMixto}
                    onChange={(e) => togglePagoMixto(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-xs text-gray-600">Pago mixto</span>
                </label>
              </div>
              {pagos.map((pago, index) => (
                <div key={index} className="grid grid-cols-2 gap-2">
                  <select
                    value={pago.metodo}
                    onChange={(e) =>
                      handlePagoChange(index, "metodo", e.target.value)
                    }
                    className={inputBase}
                  >
                    {METODOS_PAGO.filter(
                      (m) => m.value !== "usd" || cotizacion.disponible,
                    ).map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {(pagoMixto ||
                    pago.metodo === "efectivo" ||
                    pago.metodo === "usd") && (
                    <div className="relative">
                      <InputNumero
                        value={pago.monto}
                        onChange={(v) => handlePagoChange(index, "monto", v)}
                        placeholder={
                          pagoMixto
                            ? esUSD(pago)
                              ? "US$"
                              : "Monto"
                            : "Recibido"
                        }
                        className={inputBase}
                      />
                      <span className="absolute -top-2 left-3 px-1 bg-gray-50 text-[10px] text-gray-500">
                        {esUSD(pago)
                          ? "Recibido en US$"
                          : pagoMixto
                            ? "Monto en $"
                            : "Recibido"}
                      </span>
                    </div>
                  )}
                  {esUSD(pago) && (
                    <p className="col-span-2 text-xs text-gray-500">
                      Equivale a{" "}
                      <span className="font-medium text-gray-700">
                        {formatCurrency(pesosDe(pago))}
                      </span>{" "}
                      (dólar {formatCurrency(cotizacion.venta || 0)})
                    </p>
                  )}
                </div>
              ))}
              {vuelto !== null && hayUSD && (
                <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  El vuelto de {formatCurrency(vuelto)} se entrega en pesos.
                </p>
              )}
              {mixtoExcede && (
                <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
                  {hayUSD
                    ? "El vuelto solo puede salir de lo cobrado en efectivo o en dólares."
                    : "Los montos superan el total a cobrar."}
                </p>
              )}
              {sinCotizacion && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  No hay cotización del dólar disponible: no se puede cobrar en dólares.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Notas (opcional)
              </label>
              <input
                type="text"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                className={inputBase}
              />
            </div>
          </div>
        </div>

        {/* Pie fijo: totales y confirmación */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
            <div>
              <p className="text-xs text-gray-500">Subtotal</p>
              <p className="font-medium text-gray-700">
                {formatCurrency(subtotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {tipoAjuste === "descuento"
                  ? `Descuento (${porcentaje}%)`
                  : tipoAjuste === "interes"
                    ? `Interés (${porcentaje}%)`
                    : "Ajuste"}
              </p>
              <p
                className={`font-medium ${
                  tipoAjuste === "descuento"
                    ? "text-green-600"
                    : tipoAjuste === "interes"
                      ? "text-orange-500"
                      : "text-gray-400"
                }`}
              >
                {tipoAjuste === "ninguno"
                  ? "-"
                  : `${tipoAjuste === "descuento" ? "- " : "+ "}${formatCurrency(montoAjuste)}`}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total a cobrar</p>
              <p className="text-xl font-bold text-gray-800">
                {formatCurrency(total)}
              </p>
              <PrecioUSD pesos={total} />
            </div>
            <div>
              {vuelto !== null && (
                <>
                  <p className="text-xs text-gray-500">Vuelto (en pesos)</p>
                  <p className="font-bold text-green-600">
                    {formatCurrency(vuelto)}
                  </p>
                </>
              )}
              {faltaCobrar !== null && (
                <>
                  <p className="text-xs text-red-500">Falta cobrar</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(faltaCobrar)}
                  </p>
                </>
              )}
              {mixtoExcede && (
                <>
                  <p className="text-xs text-yellow-600">Excede el total</p>
                  <p className="font-bold text-yellow-600">
                    {formatCurrency(diferencia)}
                  </p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!puedeConfirmar || loading}
            className="md:w-72 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition"
          >
            {loading
              ? "Registrando..."
              : `Confirmar venta — ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function BadgePago({ metodoPago }) {
  const { esMixto, partes } = parsearMetodoPago(metodoPago);
  if (esMixto) {
    return (
      <span
        title={partes.map((p) => `${p.metodo}: ${p.monto}`).join(" + ")}
        className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium cursor-help"
      >
        Mixto
      </span>
    );
  }
  return (
    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
      {partes[0]?.metodo || "-"}
    </span>
  );
}

// Acciones del menú de tres puntitos de cada venta
function construirAcciones({
  venta,
  puedeCancelar,
  onCancel,
  onImprimir,
  onVerDetalle,
}) {
  return [
    {
      label: "Ver detalle",
      icono: <Eye size={15} />,
      onClick: () => onVerDetalle(venta),
    },
    {
      label: "Abrir en pestaña nueva",
      icono: <ExternalLink size={15} />,
      onClick: () => window.open(`/ventas/${venta._id}`, "_blank", "noopener"),
    },
    {
      label: "Imprimir ticket",
      icono: <Printer size={15} />,
      onClick: () => onImprimir(venta),
    },
    venta.estado === "completada" &&
      puedeCancelar && {
        label: "Cancelar venta",
        icono: <Ban size={15} />,
        peligro: true,
        onClick: () => onCancel(venta._id, venta.numero_venta),
      },
  ];
}

function FilaVenta({
  venta,
  clientes,
  puedeCancelar,
  onCancel,
  onImprimir,
  onVerDetalle,
}) {
  const [expandido, setExpandido] = useState(false);
  const cliente = clientes.find((c) => c.id === venta.cliente_id);
  const pago = parsearMetodoPago(venta.metodo_pago);

  return (
    <>
      {/* Desktop */}
      <tr className="hidden md:table-row hover:bg-gray-50 transition-[background-color]">
        <td className="col-centro px-6 py-4 ">
          <button
            onClick={() => onVerDetalle(venta)}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
          >
            {venta.numero_venta}
          </button>
        </td>
        <td className="col-centro px-6 py-4 text-sm  text-gray-700">
          {venta.fecha ? formatDateTime(venta.fecha) : "-"}
        </td>
        <td className="px-6 py-4 text-sm  text-gray-600">
          {cliente
            ? `${cliente.nombre} ${cliente.apellido || ""}`
            : "Consumidor final"}
        </td>
        <td className="px-6 py-4 text-sm  text-gray-600">
          {venta.sucursal === "sucursal_1" ? "Sucursal 1" : "Sucursal 2"}
        </td>
        <td className="col-num px-6 py-4 text-sm text-gray-600">
          {venta.items?.length || 0}
        </td>
        <td className="col-centro px-6 py-4 ">
          <BadgePago metodoPago={venta.metodo_pago} />
        </td>
        <td className="col-num px-6 py-4 text-sm font-semibold text-gray-800">
          {formatCurrency(venta.total)}
        </td>
        <td className="col-centro px-6 py-4 ">
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium ${
              venta.estado === "completada"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {venta.estado === "completada" ? "Completada" : "Cancelada"}
          </span>
        </td>
        <td className="col-acc px-6 py-4 ">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setExpandido(!expandido)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <MenuAcciones
              acciones={construirAcciones({
                venta,
                puedeCancelar,
                onCancel,
                onImprimir,
                onVerDetalle,
              })}
            />
          </div>
        </td>
      </tr>

      {/* Desktop expandido */}
      {expandido && (
        <tr className="hidden md:table-row">
          <td colSpan={9} className="px-6 pb-4 bg-gray-50">
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">
                      Producto
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">
                      Cantidad
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">
                      Precio unit.
                    </th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {venta.items?.map((item, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-4 py-2  font-medium text-gray-700">
                        {item.nombre_producto}
                      </td>
                      <td className="col-num px-4 py-2 text-gray-600">
                        {item.cantidad}
                      </td>
                      <td className="col-num px-4 py-2 text-gray-600">
                        {formatCurrency(item.precio_unitario)}
                      </td>
                      <td className="col-num px-4 py-2 font-medium text-gray-700">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-gray-50 flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-gray-500">
                  Pago:{" "}
                  <span className="font-medium text-gray-700">
                    {pago.esMixto
                      ? `Mixto (${pago.partes
                          .map((p) => `${p.metodo} ${p.monto}`)
                          .join(" + ")})`
                      : pago.partes[0]?.metodo || "-"}
                  </span>
                </span>
                {venta.descuento > 0 && (
                  <span className="text-gray-500">
                    Descuento:{" "}
                    <span className="font-medium text-red-600">
                      - {formatCurrency(venta.descuento)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Card mobile separada
function CardVentaMobile({
  venta,
  clientes,
  puedeCancelar,
  onCancel,
  onImprimir,
  onVerDetalle,
}) {
  const [expandido, setExpandido] = useState(false);
  const cliente = clientes.find((c) => c.id === venta.cliente_id);
  const pago = parsearMetodoPago(venta.metodo_pago);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => onVerDetalle(venta)}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {venta.numero_venta}
          </button>
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium ${
              venta.estado === "completada"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {venta.estado === "completada" ? "Completada" : "Cancelada"}
          </span>
        </div>
        <div className="space-y-1 text-sm text-gray-600">
          <p>
            {cliente
              ? `${cliente.nombre} ${cliente.apellido || ""}`
              : "Consumidor final"}
          </p>
          <p>{venta.fecha ? formatDateTime(venta.fecha) : "-"}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <BadgePago metodoPago={venta.metodo_pago} />
            <span className="text-xs text-gray-400">
              {venta.sucursal === "sucursal_1" ? "Sucursal 1" : "Sucursal 2"}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="font-bold text-gray-800">
            {formatCurrency(venta.total)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandido(!expandido)}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <MenuAcciones
              acciones={construirAcciones({
                venta,
                puedeCancelar,
                onCancel,
                onImprimir,
                onVerDetalle,
              })}
            />
          </div>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
          {venta.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>
                {item.nombre_producto} x{item.cantidad}
              </span>
              <span className="font-medium">
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
          {venta.descuento > 0 && (
            <div className="flex justify-between text-xs text-red-600 border-t border-gray-200 pt-1">
              <span>Descuento</span>
              <span>- {formatCurrency(venta.descuento)}</span>
            </div>
          )}
          {pago.esMixto && (
            <div className="border-t border-gray-200 pt-1 space-y-0.5">
              {pago.partes.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between text-xs text-gray-600"
                >
                  <span>{p.metodo}</span>
                  <span className="font-medium">{p.monto}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-gray-800 border-t border-gray-200 pt-1">
            <span>Total</span>
            <span>{formatCurrency(venta.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalDetalleVenta({ venta, cliente, onClose, onImprimir }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Venta {venta.numero_venta}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <DetalleVenta venta={venta} cliente={cliente} />
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
          >
            Cerrar
          </button>
          <button
            onClick={() => onImprimir(venta)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-900 transition"
          >
            <Printer size={16} />
            Imprimir ticket
          </button>
        </div>
      </div>
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
            Cancelar
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

export default function Ventas() {
  const { user } = useAuth();
  const { opciones: sucursalesOpc } = useSucursales();
  // El vendedor vende en la caja abierta de su sucursal (el cajero, en la suya)
  const esVendedor = user?.rol === "vendedor";
  const [sucursalVendedor, setSucursalVendedor] = useState(
    user?.sucursales?.length === 1 ? user.sucursales[0] : "",
  );
  const [motivoCaja, setMotivoCaja] = useState("");
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [cajaActual, setCajaActual] = useState(null);
  const [showTicket, setShowTicket] = useState(false);
  const [ventaImprimir, setVentaImprimir] = useState(null);
  const [ventaDetalle, setVentaDetalle] = useState(null);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [ventaCancelarId, setVentaCancelarId] = useState(null);
  const [ventaCancelarNumero, setVentaCancelarNumero] = useState(null);

  const [filtros, setFiltros] = useState({
    busqueda: "",
    metodo_pago: "",
    fecha_desde: "",
    fecha_hasta: "",
    producto: "",
    cliente_id: "",
    sucursal: "",
    estado: "",
  });

  // Caja en la que se va a registrar la venta
  const cargarCaja = async (sucursal = sucursalVendedor) => {
    try {
      const caja = esVendedor
        ? sucursal || user?.sucursales?.length === 1
          ? await cajaService.getParaVender(sucursal || undefined)
          : { estado: "cerrada", motivo: "Elegí la sucursal en la que vas a vender." }
        : await cajaService.getActual();
      setCajaAbierta(caja?.estado === "abierta");
      setCajaActual(caja);
      setMotivoCaja(caja?.motivo || "");
    } catch {
      setCajaAbierta(false);
      setCajaActual(null);
    }
  };

  const fetchData = async () => {
    try {
      const [vs, cs, ps] = await Promise.all([
        ventasService.getAll(),
        clientesService.getAll(),
        productosService.getAll(),
      ]);
      setVentas(vs);
      setClientes(cs);
      setProductos(ps);
      await cargarCaja();
    } catch (error) {
      toast.error("Error al cargar ventas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
  }, [filtros]);

  const handleCancel = async () => {
    try {
      await ventasService.cancel(ventaCancelarId);
      toast.success("Venta cancelada: stock restaurado y dinero devuelto desde la caja");
      setShowConfirmar(false);
      setVentaCancelarId(null);
      setVentaCancelarNumero(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al cancelar la venta");
    }
  };

  // Solo se pueden cancelar ventas de la caja abierta (las de cajas ya
  // cerradas quedaron incluidas en un cierre)
  const puedeCancelar = (v) =>
    cajaActual?.estado === "abierta" &&
    v.sucursal === cajaActual.sucursal &&
    new Date(v.fecha) >= new Date(cajaActual.fecha_apertura);

  const limpiarFiltros = () =>
    setFiltros({
      busqueda: "",
      metodo_pago: "",
      fecha_desde: "",
      fecha_hasta: "",
      producto: "",
      cliente_id: "",
      sucursal: "",
      estado: "",
    });

  const filtrosActivos = Object.values(filtros).some((v) => v !== "");

  const filtered = ventas.filter((venta) => {
    if (
      filtros.busqueda &&
      !venta.numero_venta
        ?.toLowerCase()
        .includes(filtros.busqueda.toLowerCase())
    )
      return false;
    if (
      filtros.metodo_pago &&
      !venta.metodo_pago?.includes(filtros.metodo_pago)
    )
      return false;
    if (filtros.cliente_id && venta.cliente_id !== filtros.cliente_id)
      return false;
    if (filtros.fecha_desde) {
      const desde = new Date(filtros.fecha_desde);
      const fechaVenta = new Date(venta.fecha);
      if (fechaVenta < desde) return false;
    }
    if (filtros.fecha_hasta) {
      const hasta = new Date(filtros.fecha_hasta);
      hasta.setHours(23, 59, 59);
      const fechaVenta = new Date(venta.fecha);
      if (fechaVenta > hasta) return false;
    }
    if (filtros.producto) {
      const tieneProducto = venta.items?.some((item) =>
        item.nombre_producto
          ?.toLowerCase()
          .includes(filtros.producto.toLowerCase()),
      );
      if (!tieneProducto) return false;
    }
    if (filtros.estado && venta.estado !== filtros.estado) return false;
    if (filtros.sucursal && venta.sucursal !== filtros.sucursal) return false;
    return true;
  });

  const totalFiltrado = filtered
    .filter((v) => v.estado === "completada")
    .reduce((acc, v) => acc + v.total, 0);

  const nombreCliente = (v) => {
    const c = clientes.find((x) => x.id === v.cliente_id);
    return c ? `${c.nombre} ${c.apellido || ""}`.trim() : "Consumidor final";
  };

  const tabla = useTabla(filtered, {
    porPagina: 20,
    ordenInicial: { campo: "fecha", dir: "desc" },
    accessors: {
      fecha: (v) => (v.fecha ? new Date(v.fecha).getTime() : null),
      cliente: nombreCliente,
      productos: (v) => v.items?.length || 0,
      pago: (v) => v.metodo_pago,
    },
  });
  const ventasPaginadas = tabla.filas;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ventas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {ventas.length} ventas registradas
          </p>
        </div>
        <div className="flex items-center gap-2">
        {esVendedor && user?.sucursales?.length > 1 && (
          <select
            value={sucursalVendedor}
            onChange={(e) => {
              setSucursalVendedor(e.target.value);
              cargarCaja(e.target.value);
            }}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Elegí la sucursal</option>
            {sucursalesOpc.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => {
            if (!cajaAbierta) {
              toast.error(
                motivoCaja || "Debe haber una caja abierta para registrar ventas",
              );
              return;
            }
            setShowModal(true);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl hover:opacity-90 transition text-sm font-medium text-white ${
            cajaAbierta
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          <Plus size={18} />
          Nueva Venta
          {!cajaAbierta && (
            <span className="text-xs opacity-75">(caja cerrada)</span>
          )}
        </button>
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar por número de venta..."
              value={filtros.busqueda}
              onChange={(e) =>
                setFiltros({ ...filtros, busqueda: e.target.value })
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
            <Filter size={16} />
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

        {/* Panel de filtros */}
        {showFiltros && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Método de pago
              </label>
              <select
                value={filtros.metodo_pago}
                onChange={(e) =>
                  setFiltros({ ...filtros, metodo_pago: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {METODOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cliente
              </label>
              <select
                value={filtros.cliente_id}
                onChange={(e) =>
                  setFiltros({ ...filtros, cliente_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido || ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Producto
              </label>
              <input
                type="text"
                placeholder="Nombre del producto..."
                value={filtros.producto}
                onChange={(e) =>
                  setFiltros({ ...filtros, producto: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha desde
              </label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) =>
                  setFiltros({ ...filtros, fecha_desde: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha hasta
              </label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) =>
                  setFiltros({ ...filtros, fecha_hasta: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Sucursal
              </label>
              <select
                value={filtros.sucursal}
                onChange={(e) =>
                  setFiltros({ ...filtros, sucursal: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                <option value="sucursal_1">Sucursal 1</option>
                <option value="sucursal_2">Sucursal 2</option>
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
                <option value="completada">Completadas</option>
                <option value="cancelada">Canceladas</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Resumen filtrado */}
      {filtrosActivos && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {filtered.length} ventas encontradas
          </span>
          <span className="text-sm font-bold text-blue-800">
            Total: {formatCurrency(totalFiltrado)}
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No se encontraron ventas</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <ThOrdenable campo="numero_venta" tabla={tabla} align="center">
                    Número
                  </ThOrdenable>
                  <ThOrdenable campo="fecha" tabla={tabla} align="center">
                    Fecha
                  </ThOrdenable>
                  <ThOrdenable campo="cliente" tabla={tabla} align="center">
                    Cliente
                  </ThOrdenable>
                  <ThOrdenable campo="sucursal" tabla={tabla} align="center">
                    Sucursal
                  </ThOrdenable>
                  <ThOrdenable campo="productos" tabla={tabla} align="center">
                    Productos
                  </ThOrdenable>
                  <ThOrdenable campo="pago" tabla={tabla} align="center">
                    Medio de pago
                  </ThOrdenable>
                  <ThOrdenable campo="total" tabla={tabla} align="center">
                    Total
                  </ThOrdenable>
                  <ThOrdenable campo="estado" tabla={tabla} align="center">
                    Estado
                  </ThOrdenable>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ventasPaginadas.map((venta) => (
                  <FilaVenta
                    key={venta._id}
                    venta={venta}
                    clientes={clientes}
                    puedeCancelar={puedeCancelar(venta)}
                    onVerDetalle={setVentaDetalle}
                    onCancel={(id, numero) => {
                      setVentaCancelarId(id);
                      setVentaCancelarNumero(numero);
                      setShowConfirmar(true);
                    }}
                    onImprimir={(v) => {
                      setVentaImprimir(v);
                      setShowTicket(true);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {ventasPaginadas.map((venta) => (
              <CardVentaMobile
                key={venta._id}
                venta={venta}
                clientes={clientes}
                puedeCancelar={puedeCancelar(venta)}
                onVerDetalle={setVentaDetalle}
                onCancel={(id, numero) => {
                  setVentaCancelarId(id);
                  setVentaCancelarNumero(numero);
                  setShowConfirmar(true);
                }}
                onImprimir={(v) => {
                  setVentaImprimir(v);
                  setShowTicket(true);
                }}
              />
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
        <NuevaVentaModal
          sucursal={cajaActual?.sucursal}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchData();
          }}
        />
      )}

      {ventaDetalle && (
        <ModalDetalleVenta
          venta={ventaDetalle}
          cliente={clientes.find((c) => c.id === ventaDetalle.cliente_id)}
          onClose={() => setVentaDetalle(null)}
          onImprimir={(v) => {
            setVentaImprimir(v);
            setShowTicket(true);
          }}
        />
      )}

      {showTicket && ventaImprimir && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Ticket de Venta
              </h2>
              <button
                onClick={() => {
                  setShowTicket(false);
                  setVentaImprimir(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <TicketVenta
              venta={ventaImprimir}
              cliente={clientes.find((c) => c.id === ventaImprimir.cliente_id)}
            />
            <button
              onClick={() => {
                setShowTicket(false);
                setVentaImprimir(null);
              }}
              className="mt-3 w-full py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showConfirmar && (
        <ModalConfirmar
          mensaje={`¿Cancelar la venta ${ventaCancelarNumero}? Se restaura el stock y se registra la devolución del dinero en la caja abierta.`}
          onConfirmar={handleCancel}
          onCancelar={() => {
            setShowConfirmar(false);
            setVentaCancelarId(null);
            setVentaCancelarNumero(null);
          }}
        />
      )}
    </div>
  );
}
