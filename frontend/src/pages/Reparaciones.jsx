import { useSearchParams } from "react-router-dom";
import { tiposReparacionService } from "../services/tiposReparacion.service";
import InputNumero from "../components/ui/InputNumero";
import { useCotizacion } from "../hooks/useCotizacion";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Edit,
  ExternalLink,
  Eye,
  Filter,
  PenLine,
  Plus,
  Printer,
  Search,
  ToggleLeft,
  Trash2,
  Wrench,
  X,
  AlertTriangle,
  PlusCircle,
} from "lucide-react";
import { reparacionesService } from "../services/reparaciones.service";
import { clientesService } from "../services/clientes.service";
import toast from "react-hot-toast";
import PrecioUSD from "../components/ui/PrecioUSD";
import {
  formatCurrency,
  formatDateTime,
  METODOS_PAGO,
  etiquetaPago,
  ESTADOS_REP,
  recargoTarjeta,
  MEDIOS_UNICOS,
  nombreSucursal,
  SUCURSALES,
  sumarDias,
  fechaLocalISO,
  formatFechaISO,
  diasAtraso,
} from "../utils/helpers";
import ComboCrear from "../components/ui/ComboCrear";
import { marcasService } from "../services/marcas.service";
import { usePersonal } from "../hooks/usePersonal";
import CamposTarjeta from "../components/ui/CamposTarjeta";
import { useTarjetas } from "../hooks/useTarjetas";
import { cajaService } from "../services/caja.service";
import { useAuth } from "../context/AuthContext";
import { useSucursales } from "../hooks/useSucursales";
import OrdenReparacion, { imprimirOrden } from "../components/ui/OrdenReparacion";
import DetalleReparacion from "../components/ui/DetalleReparacion";
import MenuAcciones from "../components/ui/MenuAcciones";
import Paginacion from "../components/ui/Paginacion";
import PatronBloqueo from "../components/ui/PatronBloqueo";
import ThOrdenable from "../components/ui/ThOrdenable";
import { useTabla } from "../hooks/useTabla";

function NuevoClienteModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    direccion: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cliente = await clientesService.create(form);
      toast.success("Cliente creado");
      onSave(cliente);
    } catch (error) {
      toast.error("Error al crear cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Nuevo Cliente</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
                Apellido
              </label>
              <input
                type="text"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DNI
              </label>
              <input
                type="text"
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
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

function SelectorTipos({ tiposDisponibles, tiposSeleccionados, onToggle }) {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 6;

  const tiposFiltrados = tiposDisponibles.filter((t) =>
    `${t.nombre} ${t.descripcion || ""}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );
  const tiposPagina = tiposFiltrados.slice(
    (pagina - 1) * POR_PAGINA,
    pagina * POR_PAGINA,
  );

  const precioTotal = tiposSeleccionados.reduce((acc, t) => acc + t.precio, 0);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          type="text"
          placeholder="Buscar tipo de reparación..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="space-y-1">
        {tiposFiltrados.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No se encontraron tipos
          </p>
        ) : (
          tiposPagina.map((tipo) => {
            const seleccionado = tiposSeleccionados.find(
              (t) => t.tipo_id === tipo.id,
            );
            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => onToggle(tipo)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left ${
                  seleccionado
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      seleccionado
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {seleccionado && (
                      <Check size={12} className="text-white" strokeWidth={3} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {tipo.nombre}
                    </p>
                    {tipo.descripcion && (
                      <p className="text-xs text-gray-500">
                        {tipo.descripcion}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`text-sm font-bold ml-2 shrink-0 ${seleccionado ? "text-blue-600" : "text-gray-600"}`}
                >
                  {formatCurrency(tipo.precio)}
                </span>
              </button>
            );
          })
        )}
      </div>
      <Paginacion
        total={tiposFiltrados.length}
        porPagina={POR_PAGINA}
        paginaActual={pagina}
        onChange={setPagina}
        compacto
      />
      {tiposSeleccionados.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="space-y-1 mb-2">
            {tiposSeleccionados.map((t, i) => (
              <div
                key={i}
                className="flex justify-between text-xs text-blue-700"
              >
                <span>{t.nombre}</span>
                <span className="font-medium">{formatCurrency(t.precio)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-bold text-blue-800 border-t border-blue-200 pt-2">
            <span>Total</span>
            <span>
              {formatCurrency(precioTotal)}{" "}
              <PrecioUSD pesos={precioTotal} className="!text-blue-500" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function NuevaReparacionModal({ onClose, onSave, cajaAbierta, userRol }) {
  const { user } = useAuth();
  // La orden queda en la sucursal de la caja del usuario (el servidor lo define);
  // si no tiene caja abierta, en su primera sucursal.
  const { porDefecto: sucursalUsuario, opciones: sucursalesOpc } = useSucursales();
  // Con caja abierta, la orden ingresa en la sucursal de esa caja; si no, se
  // elige entre las sucursales del usuario (el administrador, cualquiera)
  const [sucursalCaja, setSucursalCaja] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [tiposDisponibles, setTiposDisponibles] = useState([]);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [tiposSeleccionados, setTiposSeleccionados] = useState([]);
  const [form, setForm] = useState({
    cliente_id: "",
    equipo: {
      marca: "",
      modelo: "",
      imei: "",
      problema_descripcion: "",
      bloqueo_tipo: "ninguno",
      bloqueo_valor: "",
    },
    notas_internas: "",
    garantia_dias: 90,
    sucursal: sucursalUsuario,
    estado: "en_diagnostico",
    // Quién toma la orden (por defecto, el usuario conectado) y cuándo se promete
    vendedor_id: user?.id && user?.rol !== "deposito" ? user.id : "",
    fecha_estimada_entrega: sumarDias(3),
  });
  const [loading, setLoading] = useState(false);
  const [marcas, setMarcas] = useState([]);
  const personal = usePersonal();
  const [cobrarSena, setCobrarSena] = useState(false);
  const [sena, setSena] = useState({ monto: "", metodo: "efectivo", tarjeta_id: "", cuotas: 1 });
  const cotizacion = useCotizacion();
  const tarjetas = useTarjetas();

  useEffect(() => {
    Promise.all([
      clientesService.getAll(),
      tiposReparacionService.getAll(),
    ]).then(([clients, tipos]) => {
      setClientes(clients);
      setTiposDisponibles(tipos);
    });
    marcasService.getAll().then(setMarcas).catch(() => {});
  }, []);

  useEffect(() => {
    if (cajaAbierta) {
      cajaService
        .getActual()
        .then((c) => {
          if (c?.estado === "abierta" && c.sucursal) {
            setSucursalCaja(c.sucursal);
            setForm((f) => ({ ...f, sucursal: c.sucursal }));
          }
        })
        .catch(() => {});
    }
  }, [cajaAbierta]);

  // Marca y modelo: se eligen del catálogo o se crean en el momento
  const marcaElegida = marcas.find(
    (m) => m.nombre.toLowerCase() === form.equipo.marca.toLowerCase(),
  );
  const cambiarEquipo = (datos) => setForm((f) => ({ ...f, equipo: { ...f.equipo, ...datos } }));
  const crearMarca = async (nombre) => {
    try {
      const m = await marcasService.create(nombre);
      setMarcas((l) => [...l, m]);
      toast.success(`Marca «${m.nombre}» creada`);
      return m.nombre;
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo crear la marca");
      return null;
    }
  };
  const crearModelo = async (nombre) => {
    if (!marcaElegida) return null;
    try {
      const m = await marcasService.agregarModelo(marcaElegida.id, nombre);
      setMarcas((l) => l.map((x) => (x.id === m.id ? m : x)));
      toast.success(`Modelo «${nombre}» agregado a ${m.nombre}`);
      return nombre;
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo crear el modelo");
      return null;
    }
  };
  const vendedores = personal.filter((p) => ["vendedor", "cajero", "administrador", "tecnico"].includes(p.rol));

  const toggleTipo = (tipo) => {
    const existe = tiposSeleccionados.find((t) => t.tipo_id === tipo.id);
    if (existe) {
      setTiposSeleccionados(
        tiposSeleccionados.filter((t) => t.tipo_id !== tipo.id),
      );
    } else {
      setTiposSeleccionados([
        ...tiposSeleccionados,
        {
          tipo_id: tipo.id,
          nombre: tipo.nombre,
          precio: tipo.precio,
        },
      ]);
    }
  };

  const precioTotal = tiposSeleccionados.reduce((acc, t) => acc + t.precio, 0);

  // Si hay tipos seleccionados el estado pasa a ingresada, si no en_diagnostico
  const estadoFinal =
    tiposSeleccionados.length > 0 ? "ingresada" : "en_diagnostico";

  // La seña solo se puede cobrar cuando ya hay reparaciones definidas (precio conocido)
  const senaDisponible =
    tiposSeleccionados.length > 0 && userRol !== "tecnico" && cajaAbierta;
  const senaActiva = cobrarSena && senaDisponible;
  // Con medio "dólares" el monto de la seña es en US$: se convierte a pesos
  // con el dólar; lo que supere el total se devuelve en pesos.
  const senaEsUSD = sena.metodo === "usd";
  const montoIngresado = parseFloat(sena.monto) || 0;
  const senaEnPesos = senaEsUSD
    ? (cotizacion.aPesos(montoIngresado) ?? 0)
    : montoIngresado;
  const montoSena = senaEsUSD ? Math.min(senaEnPesos, precioTotal) : senaEnPesos;
  const vueltoSena =
    senaEsUSD && senaEnPesos > precioTotal + 0.01 ? senaEnPesos - precioTotal : 0;
  const saldoRestante = precioTotal - montoSena;
  const desdePesos = (metodo, pesos) =>
    metodo === "usd"
      ? Math.ceil((cotizacion.aUSD(pesos) ?? 0) * 100 - 1e-9) / 100
      : Math.round(pesos * 100) / 100;

  const handleSubmit = async (e, imprimir = false) => {
    e?.preventDefault();
    if (!form.cliente_id) {
      toast.error("Seleccioná un cliente");
      return;
    }
    const { bloqueo_tipo, bloqueo_valor } = form.equipo;
    if (bloqueo_tipo === "patron" && bloqueo_valor.split("-").length < 4) {
      toast.error("El patrón debe unir al menos 4 puntos");
      return;
    }
    if (bloqueo_tipo === "pin" && !/^\d{4,16}$/.test(bloqueo_valor)) {
      toast.error("El PIN debe tener entre 4 y 16 números");
      return;
    }
    if (bloqueo_tipo === "password" && !bloqueo_valor.trim()) {
      toast.error("Ingresá la contraseña del equipo");
      return;
    }
    if (senaActiva) {
      if (montoIngresado <= 0) {
        toast.error("Ingresá el monto de la seña");
        return;
      }
      if (!senaEsUSD && montoSena > precioTotal) {
        toast.error("La seña no puede superar el total");
        return;
      }
      if (
        (sena.metodo === "debito" || sena.metodo === "credito") &&
        tarjetas.some((t) => t[sena.metodo]) &&
        !sena.tarjeta_id
      ) {
        toast.error("Elegí la tarjeta con la que se paga la seña");
        return;
      }
    }
    setLoading(true);
    try {
      const creada = await reparacionesService.create({
        ...form,
        tipos_reparacion: tiposSeleccionados,
        estado: estadoFinal,
        ...(senaActiva
          ? {
              sena: {
                monto: montoIngresado,
                metodo: sena.metodo,
                tarjeta_id: sena.tarjeta_id || null,
                cuotas: sena.metodo === "credito" ? Number(sena.cuotas) || 1 : null,
              },
            }
          : {}),
      });
      toast.success(
        senaActiva
          ? vueltoSena > 0
            ? `Orden creada y seña registrada. Vuelto: ${formatCurrency(vueltoSena)}`
            : "Orden creada y seña registrada en caja"
          : "Orden creada correctamente",
      );
      onSave();
      if (imprimir && creada) {
        imprimirOrden(
          creada,
          clientes.find((c) => c.id === form.cliente_id),
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear la orden");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-6xl shadow-xl h-[90vh] flex flex-col overflow-hidden">
          <div className="shrink-0 p-6 border-b border-gray-100 bg-white flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Nueva Orden de Reparación
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-2">
              <div className="min-h-0 p-6 space-y-5 lg:overflow-y-auto lg:border-r border-gray-100">
            {/* Atención: quién toma la orden, dónde ingresa y para cuándo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="rep-vendedor" className="block text-xs text-gray-600 mb-1">
                  Atendió *
                </label>
                <select
                  id="rep-vendedor"
                  required
                  value={form.vendedor_id}
                  onChange={(e) => setForm({ ...form, vendedor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Elegí quién atiende</option>
                  {vendedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rep-sucursal" className="block text-xs text-gray-600 mb-1">
                  Sucursal de ingreso
                </label>
                {sucursalCaja || sucursalesOpc.length < 2 ? (
                  <div
                    title={sucursalCaja ? "Es la sucursal de tu caja abierta" : undefined}
                    className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-xl text-sm text-gray-700"
                  >
                    {nombreSucursal(form.sucursal)}
                  </div>
                ) : (
                  <select
                    id="rep-sucursal"
                    value={form.sucursal}
                    onChange={(e) => setForm({ ...form, sucursal: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sucursalesOpc.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="rep-estimada" className="block text-xs text-gray-600 mb-1">
                  Entrega estimada
                </label>
                <input
                  id="rep-estimada"
                  type="date"
                  min={fechaLocalISO()}
                  value={form.fecha_estimada_entrega}
                  onChange={(e) => setForm({ ...form, fecha_estimada_entrega: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Cliente */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Cliente *
                </label>
                <button
                  type="button"
                  onClick={() => setShowNuevoCliente(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Nuevo cliente
                </button>
              </div>
              <select
                required
                value={form.cliente_id}
                onChange={(e) =>
                  setForm({ ...form, cliente_id: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido || ""}{" "}
                    {c.telefono ? `— ${c.telefono}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipo */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">
                Datos del equipo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rep-marca" className="block text-xs text-gray-600 mb-1">
                    Marca *
                  </label>
                  <ComboCrear
                    id="rep-marca"
                    required
                    value={form.equipo.marca}
                    opciones={marcas.filter((m) => m.activo !== false).map((m) => m.nombre)}
                    onChange={(v) => cambiarEquipo({ marca: v, modelo: "" })}
                    onCrear={crearMarca}
                    placeholder="Buscar marca..."
                  />
                </div>
                <div>
                  <label htmlFor="rep-modelo" className="block text-xs text-gray-600 mb-1">
                    Modelo *
                  </label>
                  <ComboCrear
                    id="rep-modelo"
                    required
                    value={form.equipo.modelo}
                    opciones={marcaElegida?.modelos || []}
                    onChange={(v) => cambiarEquipo({ modelo: v })}
                    onCrear={crearModelo}
                    disabled={!marcaElegida}
                    placeholder={marcaElegida ? "Buscar modelo..." : "Primero elegí la marca"}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    IMEI
                  </label>
                  <input
                    type="text"
                    value={form.equipo.imei}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        equipo: { ...form.equipo, imei: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Garantía (días)
                  </label>
                  <InputNumero
                    value={form.garantia_dias}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        garantia_dias: v,
                      })}
                    decimales={0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Descripción del problema
                </label>
                <textarea
                  value={form.equipo.problema_descripcion}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      equipo: {
                        ...form.equipo,
                        problema_descripcion: e.target.value,
                      },
                    })
                  }
                  rows={2}
                  placeholder="Describí el problema si ya se conoce..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Bloqueo de pantalla */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Bloqueo de pantalla
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <select
                  value={form.equipo.bloqueo_tipo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      equipo: {
                        ...form.equipo,
                        bloqueo_tipo: e.target.value,
                        bloqueo_valor: "",
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ninguno">Sin bloqueo</option>
                  <option value="patron">Patrón</option>
                  <option value="password">Contraseña</option>
                  <option value="pin">PIN</option>
                </select>

                {form.equipo.bloqueo_tipo === "patron" && (
                  <div>
                    <PatronBloqueo
                      value={form.equipo.bloqueo_valor}
                      onChange={(v) =>
                        setForm({
                          ...form,
                          equipo: { ...form.equipo, bloqueo_valor: v },
                        })
                      }
                    />
                  </div>
                )}
                {form.equipo.bloqueo_tipo === "pin" && (
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={16}
                    value={form.equipo.bloqueo_valor}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        equipo: {
                          ...form.equipo,
                          bloqueo_valor: e.target.value.replace(/\D/g, ""),
                        },
                      })
                    }
                    placeholder="PIN del equipo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {form.equipo.bloqueo_tipo === "password" && (
                  <input
                    type="text"
                    maxLength={64}
                    value={form.equipo.bloqueo_valor}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        equipo: {
                          ...form.equipo,
                          bloqueo_valor: e.target.value,
                        },
                      })
                    }
                    placeholder="Contraseña del equipo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {form.equipo.bloqueo_tipo !== "ninguno" && (
                  <p className="text-xs text-gray-500 sm:col-span-2">
                    Se imprime solo en la copia del técnico.
                  </p>
                )}
                </div>
              </div>
            </div>

              </div>
              <div className="min-h-0 p-6 space-y-5 lg:overflow-y-auto">
            {/* Tipos de reparación */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Tipos de reparación
                <span className="text-xs text-gray-500 ml-2">
                  (opcional si no se conoce el problema)
                </span>
              </p>
              {tiposDisponibles.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
                  No hay tipos cargados. Cargalos desde "Tipos de Reparación".
                </p>
              ) : (
                <SelectorTipos
                  tiposDisponibles={tiposDisponibles}
                  tiposSeleccionados={tiposSeleccionados}
                  onToggle={toggleTipo}
                />
              )}
            </div>

            {/* Estado automático */}
            <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">Estado inicial:</span>
              <span
                className={`px-2 py-1 rounded-lg text-xs font-medium ${ESTADOS_REP[estadoFinal]?.color}`}
              >
                {ESTADOS_REP[estadoFinal]?.label}
              </span>
            </div>

            {/* Seña */}
            {userRol !== "tecnico" && (
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <label
                  className={`flex items-center gap-2 ${senaDisponible ? "cursor-pointer" : "cursor-not-allowed"}`}
                >
                  <input
                    type="checkbox"
                    disabled={!senaDisponible}
                    checked={senaActiva}
                    onChange={(e) => setCobrarSena(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span
                    className={`text-sm font-medium ${senaDisponible ? "text-gray-700" : "text-gray-500"}`}
                  >
                    Cobrar seña ahora
                  </span>
                </label>
                {tiposSeleccionados.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Disponible cuando elegís las reparaciones. En diagnóstico no
                    se cobra seña.
                  </p>
                )}
                {tiposSeleccionados.length > 0 && !cajaAbierta && (
                  <p className="text-xs text-orange-700">
                    Abrí la caja para poder cobrar una seña.
                  </p>
                )}
                {senaActiva && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          {senaEsUSD ? "Seña recibida en US$" : "Monto de la seña"}
                        </label>
                        <InputNumero
                          value={sena.monto}
                          onChange={(v) =>
                            setSena({ ...sena, monto: v })}
                          max={senaEsUSD ? undefined : precioTotal}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Medio de pago
                        </label>
                        <select
                          value={sena.metodo}
                          onChange={(e) => {
                            const nuevo = e.target.value;
                            // al pasar de/hacia dólares se conserva el valor en pesos
                            const monto =
                              (nuevo === "usd") !== senaEsUSD && sena.monto !== ""
                                ? desdePesos(nuevo, senaEnPesos)
                                : sena.monto;
                            setSena({ monto, metodo: nuevo, tarjeta_id: "", cuotas: 1 });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {METODOS_PAGO.filter(
                            (m) => m.value !== "usd" || cotizacion.disponible,
                          ).map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <CamposTarjeta
                      pago={sena}
                      tarjetas={tarjetas}
                      base={montoSena}
                      onChange={(datos) => setSena({ ...sena, ...datos })}
                    />
                    {senaEsUSD && (
                      <p className="text-xs text-gray-500">
                        Equivale a{" "}
                        <span className="font-medium text-gray-700">
                          {formatCurrency(senaEnPesos)}
                        </span>{" "}
                        (dólar {formatCurrency(cotizacion.venta || 0)})
                        {vueltoSena > 0 && (
                          <span className="text-green-700">
                            {" "}
                            · Vuelto en pesos: {formatCurrency(vueltoSena)}
                          </span>
                        )}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSena({
                          ...sena,
                          monto: desdePesos(sena.metodo, precioTotal),
                        })
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Cobrar el total
                    </button>
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Total de la reparación</span>
                        <span>{formatCurrency(precioTotal)}</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Seña</span>
                        <span>- {formatCurrency(montoSena)}</span>
                      </div>
                      <div
                        className={`flex justify-between font-bold border-t border-gray-200 pt-1 ${
                          saldoRestante < 0
                            ? "text-red-600"
                            : saldoRestante === 0
                              ? "text-green-700"
                              : "text-gray-800"
                        }`}
                      >
                        <span>
                          {saldoRestante < 0
                            ? "La seña supera el total"
                            : saldoRestante === 0
                              ? "Pagada completa"
                              : "Saldo restante"}
                        </span>
                        <span>
                          {saldoRestante < 0 ? "" : formatCurrency(saldoRestante)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas internas
              </label>
              <textarea
                value={form.notas_internas}
                onChange={(e) =>
                  setForm({ ...form, notas_internas: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

              </div>
            </div>
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="sm:w-44 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="sm:w-44 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-400 transition"
              >
                {loading ? "Creando..." : "Crear"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSubmit(null, true)}
                className="sm:w-44 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-900 disabled:bg-gray-500 transition inline-flex items-center justify-center gap-1.5"
              >
                <Printer size={15} />
                Crear e imprimir
              </button>
            </div>
          </form>
        </div>
      </div>

      {showNuevoCliente && (
        <NuevoClienteModal
          onClose={() => setShowNuevoCliente(false)}
          onSave={(nuevoCliente) => {
            setClientes((prev) => [...prev, nuevoCliente]);
            setForm((f) => ({ ...f, cliente_id: nuevoCliente.id }));
            setShowNuevoCliente(false);
            toast.success("Cliente agregado y seleccionado");
          }}
        />
      )}
    </>
  );
}

function EditarTiposModal({ reparacion, tiposDisponibles, onClose, onSave }) {
  const [tiposSeleccionados, setTiposSeleccionados] = useState(
    reparacion.tipos_reparacion || [],
  );
  const [loading, setLoading] = useState(false);

  const toggleTipo = (tipo) => {
    const existe = tiposSeleccionados.find((t) => t.tipo_id === tipo.id);
    if (existe) {
      setTiposSeleccionados(
        tiposSeleccionados.filter((t) => t.tipo_id !== tipo.id),
      );
    } else {
      setTiposSeleccionados([
        ...tiposSeleccionados,
        {
          tipo_id: tipo.id,
          nombre: tipo.nombre,
          precio: tipo.precio,
        },
      ]);
    }
  };

  const precioTotal = tiposSeleccionados.reduce((acc, t) => acc + t.precio, 0);

  const handleSubmit = async () => {
    if (tiposSeleccionados.length === 0) {
      toast.error("Seleccioná al menos un tipo");
      return;
    }
    setLoading(true);
    try {
      await reparacionesService.update(reparacion.id, {
        tipos_reparacion: tiposSeleccionados,
        estado: "ingresada",
      });
      toast.success("Reparación actualizada");
      onSave();
    } catch (error) {
      toast.error("Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Definir reparaciones — {reparacion.numero_orden}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <SelectorTipos
            tiposDisponibles={tiposDisponibles}
            tiposSeleccionados={tiposSeleccionados}
            onToggle={toggleTipo}
          />

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              {loading ? "Guardando..." : "Confirmar y pasar a Ingresada"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagoModal({ reparacion, onClose, onSave }) {
  const saldo = reparacion.saldo_pendiente || 0;
  const cotizacion = useCotizacion();
  const [pagoMixto, setPagoMixto] = useState(false);
  const [pagos, setPagos] = useState([{ metodo: "efectivo", monto: saldo }]);
  const [loading, setLoading] = useState(false);
  const tarjetas = useTarjetas();

  // Con medio "dólares" el monto es en US$; se compara en pesos con el dólar
  // blue y lo que supere el saldo se devuelve en pesos.
  const esUSD = (p) => p.metodo === "usd";
  const pesosDe = (p) =>
    esUSD(p)
      ? (cotizacion.aPesos(parseFloat(p.monto) || 0) ?? 0)
      : parseFloat(p.monto) || 0;
  const desdePesos = (metodo, pesos) =>
    metodo === "usd"
      ? Math.ceil((cotizacion.aUSD(pesos) ?? 0) * 100 - 1e-9) / 100
      : Math.round(pesos * 100) / 100;

  const togglePagoMixto = (value) => {
    setPagoMixto(value);
    if (value) {
      setPagos([
        { metodo: "efectivo", monto: "" },
        { metodo: "transferencia", monto: "" },
      ]);
    } else {
      setPagos([{ metodo: "efectivo", monto: saldo }]);
    }
  };

  const handlePagoChange = (index, field, value) => {
    const newPagos = [...pagos];
    const anterior = newPagos[index];
    newPagos[index] = { ...anterior, [field]: value };
    if (field === "metodo") {
      newPagos[index].tarjeta_id = "";
      newPagos[index].cuotas = 1;
    }
    // Al pasar de/hacia dólares se conserva el valor en pesos
    if (
      field === "metodo" &&
      esUSD(anterior) !== (value === "usd") &&
      anterior.monto !== ""
    ) {
      newPagos[index].monto = desdePesos(value, pesosDe(anterior));
    }
    setPagos(newPagos);
  };

  const hayUSD = pagos.some(esUSD);
  const totalPagado = pagos.reduce((acc, p) => acc + pesosDe(p), 0);
  const enEfectivo = pagos
    .filter((p) => p.metodo === "efectivo" || p.metodo === "usd")
    .reduce((acc, p) => acc + pesosDe(p), 0);
  const diferencia = pagoMixto || hayUSD ? totalPagado - saldo : null;
  const vuelto = hayUSD && diferencia > 0.005 ? diferencia : null;
  // Mixto: tiene que cubrir el saldo (sin dólares, justo; con dólares puede
  // sobrar, y el vuelto solo sale de efectivo o dólares).
  const mixtoInvalido =
    pagoMixto &&
    (diferencia < -0.01 ||
      (diferencia > 0.01 && (!hayUSD || diferencia > enEfectivo + 0.01)));
  const sinCotizacion = hayUSD && !cotizacion.disponible;

  // Tarjetas: cuál y, en crédito, cuotas (el recargo se cobra aparte del saldo)
  const recargoTotal =
    Math.round(
      pagos.reduce((acc, p) => acc + recargoTarjeta(p, tarjetas, pesosDe(p)).monto, 0) * 100,
    ) / 100;
  const faltaTarjeta = pagos.some(
    (p) =>
      (p.metodo === "debito" || p.metodo === "credito") &&
      tarjetas.some((t) => t[p.metodo]) &&
      !p.tarjeta_id,
  );
  const cambiarTarjeta = (index, datos) =>
    setPagos(pagos.map((p, i) => (i === index ? { ...p, ...datos } : p)));
  // Mixto: efectivo y dólares una sola vez; tarjetas y transferencias, varias
  const usadoEnOtro = (metodo, index) =>
    MEDIOS_UNICOS.includes(metodo) && pagos.some((p, i) => i !== index && p.metodo === metodo);
  const agregarPago = () => {
    const libre = ["transferencia", "debito", "credito", "efectivo"].find(
      (m) => !usadoEnOtro(m, -1),
    );
    const resto = Math.max(0, saldo - totalPagado);
    setPagos([...pagos, { metodo: libre, monto: Math.round(resto * 100) / 100 }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (faltaTarjeta) {
      toast.error("Elegí la tarjeta con la que se paga");
      return;
    }
    if (mixtoInvalido) {
      toast.error(
        `El total pagado (${formatCurrency(totalPagado)}) no coincide con el saldo (${formatCurrency(saldo)})`,
      );
      return;
    }
    if (sinCotizacion) {
      toast.error("No hay cotización del dólar disponible");
      return;
    }
    setLoading(true);
    try {
      // Los dólares se cobran al final: así lo que sobra del saldo, ya
      // cubierto por los otros medios, queda como vuelto.
      const aCobrar = [...pagos]
        .filter((p) => parseFloat(p.monto) > 0)
        .sort((a, b) => Number(esUSD(a)) - Number(esUSD(b)));
      for (const pago of aCobrar) {
        await reparacionesService.agregarPago(reparacion.id, {
          monto: parseFloat(pago.monto),
          tipo: "total",
          metodo: pago.metodo,
          tarjeta_id: pago.tarjeta_id || null,
          cuotas: pago.metodo === "credito" ? Number(pago.cuotas) || 1 : null,
        });
      }
      toast.success(
        vuelto ? `Pago registrado. Vuelto: ${formatCurrency(vuelto)}` : "Pago registrado",
      );
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Registrar Pago — {reparacion.numero_orden}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total reparación</span>
              <span className="font-medium">
                {formatCurrency(reparacion.precio_total || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total pagado</span>
              <span className="font-medium text-green-700">
                {formatCurrency(reparacion.total_pagado || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1">
              <span className="text-gray-700">Saldo a cobrar</span>
              <span className="text-red-600">{formatCurrency(saldo)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Método de pago
            </label>
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

          <div className="space-y-2">
            {pagos.map((pago, index) => (
              <div
                key={index}
                className={`grid grid-cols-2 gap-2 ${pagoMixto ? "relative border border-gray-200 rounded-xl p-2 pr-8" : ""}`}
              >
                {pagoMixto && pagos.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setPagos(pagos.filter((_, i) => i !== index))}
                    aria-label="Quitar este medio de pago"
                    title="Quitar este medio de pago"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                )}
                <select
                  value={pago.metodo}
                  onChange={(e) =>
                    handlePagoChange(index, "metodo", e.target.value)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {METODOS_PAGO.filter(
                    (m) => m.value !== "usd" || cotizacion.disponible,
                  ).map((m) => (
                    <option key={m.value} value={m.value} disabled={usadoEnOtro(m.value, index)}>
                      {m.label}
                      {usadoEnOtro(m.value, index) ? " (ya cargado)" : ""}
                    </option>
                  ))}
                </select>
                <InputNumero
                  value={pago.monto}
                  onChange={(v) =>
                    handlePagoChange(index, "monto", v)}
                  placeholder={esUSD(pago) ? "US$ 0.00" : "$ 0.00"}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <CamposTarjeta
                  pago={pago}
                  tarjetas={tarjetas}
                  base={pesosDe(pago)}
                  onChange={(datos) => cambiarTarjeta(index, datos)}
                  className="col-span-2"
                />
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
          </div>

          {pagoMixto && pagos.length < 5 && (
            <button
              type="button"
              onClick={agregarPago}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <PlusCircle size={15} /> Agregar otro medio de pago
            </button>
          )}

          {vuelto && (
            <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
              Vuelto en pesos: {formatCurrency(vuelto)}
            </p>
          )}

          {pagoMixto && (
            <div
              className={`flex justify-between text-sm px-3 py-2 rounded-xl ${
                !mixtoInvalido
                  ? "bg-green-50 text-green-700"
                  : diferencia > 0
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-red-50 text-red-700"
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {!mixtoInvalido ? (
                  <>
                    <Check size={14} /> Monto correcto
                  </>
                ) : diferencia > 0 ? (
                  "Excede el saldo"
                ) : (
                  "Falta completar"
                )}
              </span>
              {mixtoInvalido && (
                <span className="font-bold">
                  {formatCurrency(Math.abs(diferencia))}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-3">
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
              className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700 disabled:bg-green-400 transition"
            >
              {loading
                ? "Registrando..."
                : `Cobrar ${formatCurrency(saldo + recargoTotal)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function construirAcciones({
  reparacion,
  siguienteEstado,
  onEditarTipos,
  onUpdate,
  onCancelar,
  onImprimir,
  onVerDetalle,
  puedeCobrar,
  onCobrar,
}) {
  return [
    {
      label: "Ver detalle",
      icono: <Eye size={15} />,
      onClick: () => onVerDetalle(reparacion),
    },
    {
      label: "Abrir en pestaña nueva",
      icono: <ExternalLink size={15} />,
      onClick: () =>
        window.open(`/reparaciones/${reparacion.id}`, "_blank", "noopener"),
    },
    puedeCobrar && {
      label: "Cobrar",
      icono: <DollarSign size={15} />,
      onClick: onCobrar,
    },
    reparacion.estado === "en_diagnostico" && {
      label: "Definir reparación",
      icono: <PenLine size={15} />,
      onClick: () => onEditarTipos(reparacion),
    },
    siguienteEstado && {
      label: `Pasar a ${ESTADOS_REP[siguienteEstado]?.label}`,
      icono: <ArrowRight size={15} />,
      onClick: () => onUpdate(reparacion.id, { estado: siguienteEstado }),
    },
    {
      label: "Imprimir orden",
      icono: <Printer size={15} />,
      onClick: () => onImprimir(reparacion),
    },
    reparacion.estado !== "entregada" &&
      reparacion.estado !== "cancelada" && {
        label: "Cancelar orden",
        icono: <Ban size={15} />,
        peligro: true,
        onClick: () => onCancelar(reparacion.id),
      },
  ];
}

function ModalDetalleReparacion({ reparacion, cliente, onClose, onImprimir }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Orden {reparacion.numero_orden}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto">
          <DetalleReparacion reparacion={reparacion} cliente={cliente} />
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
          >
            Cerrar
          </button>
          <button
            onClick={() => onImprimir(reparacion)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm hover:bg-gray-900 transition"
          >
            <Printer size={16} />
            Imprimir orden
          </button>
        </div>
      </div>
    </div>
  );
}

// Al pasar una orden a "En reparación" se registra qué técnico la hace
function AsignarTecnicoModal({ reparacion, onClose, onConfirmar }) {
  const { user } = useAuth();
  const personal = usePersonal();
  const tecnicos = personal.filter((p) => p.rol === "tecnico" || p.rol === "administrador");
  const [elegido, setElegido] = useState(user?.rol === "tecnico" ? user.id : "");
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!elegido) return;
          setEnviando(true);
          await onConfirmar(elegido);
        }}
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl"
      >
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Pasar a En reparación</h2>
          <p className="text-xs text-gray-500">
            {reparacion.numero_orden} · {reparacion.equipo?.marca} {reparacion.equipo?.modelo}
          </p>
        </div>
        <div className="p-6 space-y-2">
          <label htmlFor="tecnico" className="block text-sm font-medium text-gray-700">
            ¿Qué técnico la repara? *
          </label>
          <select
            id="tecnico"
            required
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Elegí el técnico</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.rol === "administrador" ? " (administración)" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Queda registrado en la orden y en el historial de reparaciones del técnico.
          </p>
        </div>
        <div className="flex gap-3 px-6 py-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!elegido || enviando}
            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-300"
          >
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}

// Debajo del estado: para cuándo se prometió y, si se pasó, cuántos días de atraso
function EntregaEstimada({ reparacion }) {
  const atraso = diasAtraso(reparacion);
  if (atraso > 0)
    return (
      <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-red-600 whitespace-nowrap">
        <AlertTriangle size={12} /> Atrasada {atraso} {atraso === 1 ? "día" : "días"}
      </span>
    );
  if (!reparacion.fecha_estimada_entrega || ["entregada", "cancelada"].includes(reparacion.estado))
    return null;
  return (
    <span className="mt-1 block text-xs text-gray-500 whitespace-nowrap">
      Entrega {formatFechaISO(reparacion.fecha_estimada_entrega).slice(0, 5)}
    </span>
  );
}

function FilaReparacion({
  reparacion,
  clientes,
  tiposDisponibles,
  onUpdate,
  onEditarTipos,
  onPago,
  cajaAbierta,
  userRol,
  onCancelar,
  onImprimir,
  onVerDetalle,
}) {
  const [expandido, setExpandido] = useState(false);
  const cliente = clientes.find((c) => c.id === reparacion.cliente_id);
  const estadoInfo = ESTADOS_REP[reparacion.estado] || {
    label: reparacion.estado,
    color: "bg-gray-100 text-gray-700",
  };

  const FLUJO_ESTADOS = {
    en_diagnostico: null,
    ingresada: "en_reparacion",
    en_reparacion: "lista",
    lista: userRol === "tecnico" ? null : "entregada",
    entregada: null,
  };

  const siguienteEstado = FLUJO_ESTADOS[reparacion.estado];

  const puedeCobrar =
    reparacion.precio_total > 0 &&
    reparacion.saldo_pendiente > 0 &&
    reparacion.estado !== "cancelada" &&
    (cajaAbierta || userRol !== "tecnico");
  const onCobrar = () => {
    if (!cajaAbierta) {
      toast.error("Para cobrar necesitás tener tu caja abierta");
      return;
    }
    onPago(reparacion);
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition-[background-color]">
        <td className="col-centro px-6 py-4">
          <button
            onClick={() => onVerDetalle(reparacion)}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
          >
            {reparacion.numero_orden}
          </button>
          <span className="block text-xs text-gray-500">{nombreSucursal(reparacion.sucursal)}</span>
        </td>
        <td className="col-centro px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
          {formatDateTime(reparacion.fecha_ingreso)}
        </td>
        <td className="px-6 py-4 text-sm text-gray-700">
          {cliente ? `${cliente.nombre} ${cliente.apellido || ""}` : "-"}
        </td>
        <td className="px-6 py-4 text-sm text-gray-700">
          {reparacion.equipo?.marca} {reparacion.equipo?.modelo}
          {reparacion.tecnico_nombre && (
            <span className="block text-xs text-gray-500">Técnico: {reparacion.tecnico_nombre}</span>
          )}
        </td>
        <td className="col-centro px-6 py-4">
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${estadoInfo.color}`}
          >
            {estadoInfo.label}
          </span>
          <EntregaEstimada reparacion={reparacion} />
        </td>
        <td className="col-num px-6 py-4 text-sm font-semibold text-gray-800">
          {reparacion.tipos_reparacion?.length > 0 ? (
            formatCurrency(reparacion.precio_total || 0)
          ) : (
            <span className="text-gray-500 text-xs font-normal">
              En diagnóstico
            </span>
          )}
        </td>
        <td className="col-num px-6 py-4 text-sm ">
          {reparacion.estado === "cancelada" ? (
            <span className="text-gray-500 text-xs">
              {reparacion.total_devuelto > 0
                ? `Devuelto ${formatCurrency(reparacion.total_devuelto)}`
                : "-"}
            </span>
          ) : reparacion.saldo_pendiente > 0 ? (
            <span className="text-red-600 font-medium">
              {formatCurrency(reparacion.saldo_pendiente)}
            </span>
          ) : reparacion.precio_total > 0 ? (
            <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
              <Check size={14} /> Pagado
            </span>
          ) : (
            "-"
          )}
        </td>
        <td className="col-acc px-6 py-4 ">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpandido(!expandido)}
              className="p-1 text-gray-500 hover:text-gray-600"
            >
              {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <MenuAcciones
              acciones={construirAcciones({
                reparacion,
                siguienteEstado,
                onEditarTipos,
                onUpdate,
                onCancelar,
                onImprimir,
                onVerDetalle,
                puedeCobrar,
                onCobrar,
              })}
            />
          </div>
        </td>
      </tr>

      {expandido && (
        <tr>
          <td colSpan={8} className="px-6 pb-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-white rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-700">
                  Detalle del equipo
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <span>
                    Marca: <strong>{reparacion.equipo?.marca}</strong>
                  </span>
                  <span>
                    Modelo: <strong>{reparacion.equipo?.modelo}</strong>
                  </span>
                  <span>
                    IMEI: <strong>{reparacion.equipo?.imei || "-"}</strong>
                  </span>
                  <span>
                    Garantía: <strong>{reparacion.garantia_dias} días</strong>
                  </span>
                  <span>
                    Atendió: <strong>{reparacion.vendedor_nombre || "-"}</strong>
                  </span>
                  <span>
                    Técnico: <strong>{reparacion.tecnico_nombre || "Sin asignar"}</strong>
                  </span>
                  <span>
                    Ingresó en: <strong>{nombreSucursal(reparacion.sucursal)}</strong>
                  </span>
                  <span>
                    Entrega estimada:{" "}
                    <strong>{formatFechaISO(reparacion.fecha_estimada_entrega) || "-"}</strong>
                  </span>
                </div>
                {reparacion.equipo?.problema_descripcion && (
                  <p className="text-xs text-gray-600">
                    <strong>Problema:</strong>{" "}
                    {reparacion.equipo.problema_descripcion}
                  </p>
                )}
                {reparacion.notas_internas && (
                  <p className="text-xs text-gray-500 italic">
                    Notas: {reparacion.notas_internas}
                  </p>
                )}
                {reparacion.fecha_entrega && (
                  <p className="text-xs text-gray-500">
                    Entregado: {formatDateTime(reparacion.fecha_entrega)}
                  </p>
                )}
                {reparacion.fecha_vencimiento_garantia && (
                  <p className="text-xs text-green-700">
                    Garantía hasta:{" "}
                    {formatDateTime(reparacion.fecha_vencimiento_garantia)}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {reparacion.tipos_reparacion?.length > 0 && (
                  <div className="bg-white rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Reparaciones
                    </p>
                    {reparacion.tipos_reparacion.map((t, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs text-gray-600 py-1 border-b border-gray-50"
                      >
                        <span>{t.nombre}</span>
                        <span className="font-medium">
                          {formatCurrency(t.precio)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold mt-2">
                      <span>Total</span>
                      <span>{formatCurrency(reparacion.precio_total)}</span>
                    </div>
                  </div>
                )}

                {reparacion.pagos?.length > 0 && (
                  <div className="bg-white rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Pagos
                    </p>
                    {reparacion.pagos.map((p, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs text-gray-600 py-1"
                      >
                        <span>
                          {p.tipo} — {etiquetaPago(p)} — {formatDateTime(p.fecha)}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(p.monto)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold border-t border-gray-100 pt-1 mt-1">
                      <span>Total pagado</span>
                      <span className="text-green-700">
                        {formatCurrency(reparacion.total_pagado)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CardReparacionMobile({
  reparacion,
  clientes,
  tiposDisponibles,
  onUpdate,
  onEditarTipos,
  onPago,
  cajaAbierta,
  userRol,
  onCancelar,
  onImprimir,
  onVerDetalle,
}) {
  const [expandido, setExpandido] = useState(false);
  const cliente = clientes.find((c) => c.id === reparacion.cliente_id);
  const estadoInfo = ESTADOS_REP[reparacion.estado] || {
    label: reparacion.estado,
    color: "bg-gray-100 text-gray-700",
  };

  const FLUJO_ESTADOS = {
    en_diagnostico: null,
    ingresada: "en_reparacion",
    en_reparacion: "lista",
    lista: userRol === "tecnico" ? null : "entregada",
    entregada: null,
  };

  const siguienteEstado = FLUJO_ESTADOS[reparacion.estado];

  const puedeCobrar =
    reparacion.precio_total > 0 &&
    reparacion.saldo_pendiente > 0 &&
    reparacion.estado !== "cancelada" &&
    (cajaAbierta || userRol !== "tecnico");
  const onCobrar = () => {
    if (!cajaAbierta) {
      toast.error("Para cobrar necesitás tener tu caja abierta");
      return;
    }
    onPago(reparacion);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => onVerDetalle(reparacion)}
            className="font-medium text-blue-600 hover:underline"
          >
            {reparacion.numero_orden}
          </button>
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium ${estadoInfo.color}`}
          >
            {estadoInfo.label}
          </span>
        </div>

        <div className="space-y-1 text-sm text-gray-600 mb-3">
          <p className="font-medium text-gray-800">
            {cliente ? `${cliente.nombre} ${cliente.apellido || ""}` : "-"}
          </p>
          {cliente?.telefono && (
            <p className="text-xs text-gray-500">{cliente.telefono}</p>
          )}
          <p className="text-gray-700">
            {reparacion.equipo?.marca} {reparacion.equipo?.modelo}
          </p>
          <p className="text-xs text-gray-500">
            {nombreSucursal(reparacion.sucursal)}
            {reparacion.tecnico_nombre && ` · Técnico: ${reparacion.tecnico_nombre}`}
          </p>
          <EntregaEstimada reparacion={reparacion} />
          {reparacion.equipo?.imei && (
            <p className="text-xs text-gray-500">
              IMEI: {reparacion.equipo.imei}
            </p>
          )}
        </div>

        {reparacion.tipos_reparacion?.length > 0 && (
          <div className="mb-3">
            {reparacion.tipos_reparacion.map((t, i) => (
              <span
                key={i}
                className="inline-block text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-lg mr-1 mb-1"
              >
                {t.nombre}
              </span>
            ))}
            <p className="text-sm font-bold text-gray-800 mt-1">
              {formatCurrency(reparacion.precio_total || 0)}
            </p>
          </div>
        )}

        {reparacion.saldo_pendiente > 0 && (
          <p className="text-sm text-red-600 font-medium mb-3">
            Saldo: {formatCurrency(reparacion.saldo_pendiente)}
          </p>
        )}

        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setExpandido(!expandido)}
            className="p-1 text-gray-500 hover:text-gray-600"
          >
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <MenuAcciones
            acciones={construirAcciones({
              reparacion,
              siguienteEstado,
              onEditarTipos,
              onUpdate,
              onCancelar,
              onImprimir,
              onVerDetalle,
              puedeCobrar,
              onCobrar,
            })}
          />
        </div>
      </div>

      {expandido && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
          <div className="space-y-1 text-xs text-gray-600">
            {reparacion.equipo?.problema_descripcion && (
              <p>
                <strong>Problema:</strong>{" "}
                {reparacion.equipo.problema_descripcion}
              </p>
            )}
            {reparacion.notas_internas && (
              <p className="italic text-gray-500">
                Notas: {reparacion.notas_internas}
              </p>
            )}
            <p>
              <strong>Ingresado:</strong>{" "}
              {formatDateTime(reparacion.fecha_ingreso)}
            </p>
            {reparacion.fecha_entrega && (
              <p>
                <strong>Entregado:</strong>{" "}
                {formatDateTime(reparacion.fecha_entrega)}
              </p>
            )}
            {reparacion.fecha_vencimiento_garantia && (
              <p className="text-green-700">
                <strong>Garantía hasta:</strong>{" "}
                {formatDateTime(reparacion.fecha_vencimiento_garantia)}
              </p>
            )}
          </div>

          {reparacion.pagos?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Pagos</p>
              {reparacion.pagos.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between text-xs text-gray-600"
                >
                  <span>
                    {p.tipo} — {etiquetaPago(p)}
                  </span>
                  <span className="font-medium">{formatCurrency(p.monto)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold border-t border-gray-200 pt-1 mt-1">
                <span>Total pagado</span>
                <span className="text-green-700">
                  {formatCurrency(reparacion.total_pagado)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TipoModal({ tipo, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: tipo?.nombre || "",
    descripcion: tipo?.descripcion || "",
    precio: tipo?.precio || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { ...form, precio: parseFloat(form.precio) };
      if (tipo) {
        await tiposReparacionService.update(tipo.id, data);
        toast.success("Tipo actualizado");
      } else {
        await tiposReparacionService.create(data);
        toast.success("Tipo creado");
      }
      onSave();
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {tipo ? "Editar Tipo" : "Nuevo Tipo de Reparación"}
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
              placeholder="ej: Cambio de pantalla"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio *
            </label>
            <InputNumero
              value={form.precio}
              onChange={(v) => setForm({ ...form, precio: v })}
              required
              placeholder="$ 0.00"
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

function GestionTiposReparacion() {
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const filtered = tipos.filter((t) => {
    if (busqueda && !t.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      return false;
    if (filtroEstado === "activo" && !t.activo) return false;
    if (filtroEstado === "inactivo" && t.activo) return false;
    return true;
  });

  const fetchTipos = async () => {
    try {
      const data = await tiposReparacionService.getAll();
      setTipos(data);
    } catch (error) {
      toast.error("Error al cargar tipos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTipos();
  }, []);

  const handleToggle = async (tipo) => {
    const accion = tipo.activo ? "desactivar" : "activar";
    if (
      !confirm(
        `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} este tipo?`,
      )
    )
      return;
    try {
      await tiposReparacionService.delete(tipo.id);
      toast.success(
        `Tipo ${accion === "desactivar" ? "desactivado" : "activado"}`,
      );
      fetchTipos();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const accionesTipo = (tipo) => [
    {
      label: "Editar",
      icono: <Edit size={15} />,
      onClick: () => {
        setSelected(tipo);
        setShowModal(true);
      },
    },
    {
      label: tipo.activo ? "Desactivar" : "Activar",
      icono: tipo.activo ? <Trash2 size={15} /> : <ToggleLeft size={15} />,
      peligro: tipo.activo,
      onClick: () => handleToggle(tipo),
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
          Nuevo Tipo
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
      ) : tipos.length === 0 ? (
        <div className="text-center py-12">
          <Wrench size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No hay tipos registrados</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <ThOrdenable campo="nombre" tabla={tabla} className="px-6 py-3">Nombre</ThOrdenable>
                  <ThOrdenable campo="descripcion" tabla={tabla} className="px-6 py-3">Descripción</ThOrdenable>
                  <ThOrdenable campo="precio" tabla={tabla} className="px-6 py-3">Precio</ThOrdenable>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabla.filas.map((tipo) => (
                  <tr key={tipo.id} className="hover:bg-gray-50 transition-[background-color]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                          <Wrench size={14} className="text-orange-700" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">
                            {tipo.nombre}
                          </span>
                          {!tipo.activo && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                              Inactivo
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tipo.descripcion || "-"}
                    </td>
                    <td className="col-num px-6 py-4 text-sm font-semibold text-gray-800">
                      {formatCurrency(tipo.precio)}
                      <PrecioUSD pesos={tipo.precio} className="block" />
                    </td>
                    <td className="col-acc px-6 py-4 ">
                      <MenuAcciones acciones={accionesTipo(tipo)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {tabla.filas.map((tipo) => (
              <div
                key={tipo.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                      <Wrench size={16} className="text-orange-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">
                          {tipo.nombre}
                        </p>
                        {!tipo.activo && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-700">
                        {formatCurrency(tipo.precio)}{" "}
                        <PrecioUSD pesos={tipo.precio} />
                      </p>
                      {tipo.descripcion && (
                        <p className="text-xs text-gray-500">
                          {tipo.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                  <MenuAcciones acciones={accionesTipo(tipo)} />
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
        <TipoModal
          tipo={selected}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchTipos();
          }}
        />
      )}
    </div>
  );
}

export default function Reparaciones() {
  // La vista sale de la dirección (?vista=...): la eligen el menú y las pestañas del módulo
  const [params] = useSearchParams();
  const tab = params.get("vista") === "tipos" ? "tipos" : "reparaciones";
  const [reparaciones, setReparaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tiposDisponibles, setTiposDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditarTipos, setShowEditarTipos] = useState(null);
  const [showPago, setShowPago] = useState(null);
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtros, setFiltros] = useState({
    busqueda: "",
    estado: "",
    cliente_id: "",
    sucursal: "",
    vendedor: "",
    tecnico: "",
    atrasadas: "",
  });
  // Orden que pasa a "En reparación": se pide qué técnico la hace
  const [asignarTecnico, setAsignarTecnico] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const { user } = useAuth();
  const [showOrden, setShowOrden] = useState(null);
  const [reparacionDetalle, setReparacionDetalle] = useState(null);

  const fetchData = async () => {
    try {
      const [reps, clients, tipos] = await Promise.all([
        reparacionesService.getAll(),
        clientesService.getAll(),
        tiposReparacionService.getAll(),
      ]);
      setReparaciones(reps);
      setClientes(clients);
      setTiposDisponibles(tipos);

      // Solo verificar caja si el rol lo permite
      if (!["tecnico", "deposito", "vendedor"].includes(user?.rol)) {
        try {
          const cajaActual = await cajaService.getActual();
          setCajaAbierta(cajaActual?.estado === "abierta");
        } catch {
          setCajaAbierta(false);
        }
      }
    } catch (error) {
      toast.error("Error al cargar reparaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (id, data) => {
    if (data.estado === "en_reparacion" && !data.tecnico_id) {
      setAsignarTecnico(reparaciones.find((r) => r.id === id));
      return;
    }
    try {
      await reparacionesService.update(id, data);
      toast.success("Estado actualizado");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar");
    }
  };

  const filtered = reparaciones.filter((r) => {
    if (
      filtros.busqueda &&
      !r.numero_orden?.toLowerCase().includes(filtros.busqueda.toLowerCase()) &&
      !`${r.equipo?.marca} ${r.equipo?.modelo}`
        .toLowerCase()
        .includes(filtros.busqueda.toLowerCase())
    )
      return false;
    if (filtros.estado && r.estado !== filtros.estado) return false;
    if (filtros.cliente_id && r.cliente_id !== filtros.cliente_id) return false;
    if (filtros.sucursal && r.sucursal !== filtros.sucursal) return false;
    if (filtros.vendedor && r.vendedor_nombre !== filtros.vendedor) return false;
    if (filtros.tecnico && r.tecnico_nombre !== filtros.tecnico) return false;
    if (filtros.atrasadas && diasAtraso(r) === 0) return false;
    return true;
  });

  const nombreCliente = (r) => {
    const c = clientes.find((x) => x.id === r.cliente_id);
    return c ? `${c.nombre} ${c.apellido || ""}`.trim() : "";
  };
  const ordenEstados = Object.keys(ESTADOS_REP);

  const tabla = useTabla(filtered, {
    porPagina: 20,
    ordenInicial: { campo: "orden", dir: "desc" },
    accessors: {
      orden: (r) => r.numero_orden,
      fecha: (r) => (r.fecha_ingreso ? new Date(r.fecha_ingreso).getTime() : null),
      cliente: nombreCliente,
      equipo: (r) => `${r.equipo?.marca || ""} ${r.equipo?.modelo || ""}`.trim(),
      estado: (r) => ordenEstados.indexOf(r.estado),
      reparaciones: (r) => r.precio_total || 0,
      saldo: (r) => r.saldo_pendiente || 0,
    },
  });

  const limpiarFiltros = () =>
    setFiltros({
      busqueda: "",
      estado: "",
      cliente_id: "",
      sucursal: "",
      vendedor: "",
      tecnico: "",
      atrasadas: "",
    });
  // Opciones de los filtros de personal: los nombres que aparecen en las órdenes
  const unicos = (campo) =>
    [...new Set(reparaciones.map((r) => r[campo]).filter(Boolean))].sort();
  const atrasadas = reparaciones.filter((r) => diasAtraso(r) > 0).length;
  const filtrosActivos = Object.values(filtros).some((v) => v !== "");

  const handleCancelar = async (id) => {
    const r = reparaciones.find((x) => x.id === id);
    const pagado = r?.total_pagado || 0;
    const mensaje =
      pagado > 0
        ? `¿Cancelar esta orden? Se devolverán ${formatCurrency(pagado)} al cliente y se registrará como egreso en la caja, con el mismo medio de pago de cada cobro.`
        : "¿Cancelar esta orden de reparación?";
    if (!confirm(mensaje)) return;
    try {
      const res = await reparacionesService.cancelar(id);
      toast.success(
        res.total_devuelto > 0
          ? `Reparación cancelada. Devolución de ${formatCurrency(res.total_devuelto)} registrada en caja`
          : "Reparación cancelada",
      );
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al cancelar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {tab === "tipos" ? "Tipos de reparación" : "Reparaciones"}
        </h1>
      </div>

      {tab === "tipos" ? (
        <GestionTiposReparacion />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              {reparaciones.length} órdenes registradas
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
            >
              <Plus size={18} />
              Nueva Orden
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Buscar por número u equipo..."
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
                Filtros
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
                    {Object.entries(ESTADOS_REP).map(([v, { label }]) => (
                      <option key={v} value={v}>
                        {label}
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
                {[
                  ["sucursal", "Sucursal de ingreso", SUCURSALES.map((o) => [o.value, o.label])],
                  ["vendedor", "Atendió", unicos("vendedor_nombre").map((n) => [n, n])],
                  ["tecnico", "Técnico", unicos("tecnico_nombre").map((n) => [n, n])],
                ].map(([campo, titulo, opciones]) => (
                  <div key={campo}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{titulo}</label>
                    <select
                      value={filtros[campo]}
                      onChange={(e) => setFiltros({ ...filtros, [campo]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos</option>
                      {opciones.map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer self-end pb-2">
                  <input
                    type="checkbox"
                    checked={!!filtros.atrasadas}
                    onChange={(e) => setFiltros({ ...filtros, atrasadas: e.target.checked ? "1" : "" })}
                    className="w-4 h-4 text-blue-600"
                  />
                  Solo atrasadas
                </label>
              </div>
            )}

            {atrasadas > 0 && !filtros.atrasadas && (
              <button
                type="button"
                onClick={() => setFiltros({ ...filtros, atrasadas: "1" })}
                className="w-full text-left bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-3 hover:bg-red-100/60 transition"
              >
                <AlertTriangle size={18} className="text-red-500 shrink-0" />
                <span className="text-sm text-red-700">
                  <span className="font-semibold">
                    {atrasadas} {atrasadas === 1 ? "orden atrasada" : "órdenes atrasadas"}
                  </span>{" "}
                  (pasó la fecha estimada de entrega). <span className="underline">Ver solo esas</span>
                </span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Wrench size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No se encontraron reparaciones</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <ThOrdenable campo="orden" tabla={tabla}>
                        Orden
                      </ThOrdenable>
                      <ThOrdenable campo="fecha" tabla={tabla}>
                        Fecha
                      </ThOrdenable>
                      <ThOrdenable campo="cliente" tabla={tabla}>
                        Cliente
                      </ThOrdenable>
                      <ThOrdenable campo="equipo" tabla={tabla}>
                        Equipo
                      </ThOrdenable>
                      <ThOrdenable campo="estado" tabla={tabla}>
                        Estado
                      </ThOrdenable>
                      <ThOrdenable campo="reparaciones" tabla={tabla}>
                        Total
                      </ThOrdenable>
                      <ThOrdenable campo="saldo" tabla={tabla}>
                        Saldo
                      </ThOrdenable>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tabla.filas.map((r) => (
                      <FilaReparacion
                        key={r.id}
                        reparacion={r}
                        clientes={clientes}
                        tiposDisponibles={tiposDisponibles}
                        onUpdate={handleUpdate}
                        onEditarTipos={(r) => setShowEditarTipos(r)}
                        onPago={(r) => setShowPago(r)}
                        cajaAbierta={cajaAbierta}
                        userRol={user?.rol}
                        onCancelar={handleCancelar}
                        onImprimir={(r) => setShowOrden(r)}
                        onVerDetalle={setReparacionDetalle}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {tabla.filas.map((r) => (
                  <CardReparacionMobile
                    key={r.id}
                    reparacion={r}
                    clientes={clientes}
                    tiposDisponibles={tiposDisponibles}
                    onUpdate={handleUpdate}
                    onEditarTipos={(r) => setShowEditarTipos(r)}
                    onPago={(r) => setShowPago(r)}
                    cajaAbierta={cajaAbierta}
                    userRol={user?.rol}
                    onCancelar={handleCancelar}
                    onImprimir={(r) => setShowOrden(r)}
                        onVerDetalle={setReparacionDetalle}
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
            <NuevaReparacionModal
              cajaAbierta={cajaAbierta}
              userRol={user?.rol}
              onClose={() => setShowModal(false)}
              onSave={() => {
                setShowModal(false);
                fetchData();
              }}
            />
          )}
          {showEditarTipos && (
            <EditarTiposModal
              reparacion={showEditarTipos}
              tiposDisponibles={tiposDisponibles}
              onClose={() => setShowEditarTipos(null)}
              onSave={() => {
                setShowEditarTipos(null);
                fetchData();
              }}
            />
          )}
          {asignarTecnico && (
            <AsignarTecnicoModal
              reparacion={asignarTecnico}
              onClose={() => setAsignarTecnico(null)}
              onConfirmar={async (tecnico_id) => {
                const r = asignarTecnico;
                setAsignarTecnico(null);
                await handleUpdate(r.id, { estado: "en_reparacion", tecnico_id });
              }}
            />
          )}

          {showPago && (
            <PagoModal
              reparacion={showPago}
              onClose={() => setShowPago(null)}
              onSave={() => {
                setShowPago(null);
                fetchData();
              }}
            />
          )}
        </div>
      )}
      {reparacionDetalle && (
        <ModalDetalleReparacion
          reparacion={reparacionDetalle}
          cliente={clientes.find((c) => c.id === reparacionDetalle.cliente_id)}
          onClose={() => setReparacionDetalle(null)}
          onImprimir={(r) => setShowOrden(r)}
        />
      )}
      {showOrden && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Orden de Reparación
              </h2>
              <button
                onClick={() => setShowOrden(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <OrdenReparacion
              reparacion={showOrden}
              cliente={clientes.find((c) => c.id === showOrden.cliente_id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
