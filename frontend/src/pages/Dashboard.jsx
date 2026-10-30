import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Wrench,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  UserCog,
  Clock,
  PackagePlus,
  Truck,
  DollarSign,
  ListChecks,
  Smartphone,
  ArrowLeftRight,
} from "lucide-react";
import DetalleInicio from "../components/DetalleInicio";
import api from "../services/api";
import { formatCurrency } from "../utils/helpers";
import { useAuth } from "../context/AuthContext";

// Tarjeta del Inicio. Si tiene detalle, al tocarla se abre la lista debajo.
function StatCard({ title, value, icon: Icon, color, subtitle, alerta, onClick, activo, accion = "Ver detalle" }) {
  const Contenedor = onClick ? "button" : "div";
  return (
    <Contenedor
      {...(onClick ? { type: "button", onClick, "aria-expanded": activo } : {})}
      className={`text-left bg-white rounded-2xl p-6 shadow-sm border transition ${
        activo ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100"
      } ${onClick ? "hover:border-blue-300 hover:shadow" : ""}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}
        >
          <Icon size={22} className="text-white" />
        </div>
        {onClick && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
            {accion} {activo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm font-medium text-gray-600 mt-1">{title}</p>
      {alerta ? (
        <p className="text-xs font-semibold text-red-600 mt-1">{alerta}</p>
      ) : (
        subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </Contenedor>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  // Detalle abierto debajo de las tarjetas: { clave, tipo, filtro, filas }
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(null);

  useEffect(() => {
    api
      .get("/reports/dashboard")
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Primero se traen los datos y recién después se abre el detalle: así
  // aparece de una sola vez, sin un paso intermedio de "Cargando..."
  const abrir = async (clave, tipo, filtro) => {
    if (detalle?.clave === clave) return setDetalle(null);
    setCargandoDetalle(clave);
    try {
      const r = await api.get(`/reports/dashboard/detalle/${tipo}${filtro ? `?filtro=${filtro}` : ""}`);
      setDetalle({ clave, tipo, filtro, filas: r.data });
    } catch {
      setDetalle({ clave, tipo, filtro, filas: [] });
    } finally {
      setCargandoDetalle(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );

  const n = (k) => stats?.[k] ?? 0;
  const plural = (c, uno, varios) => `${c} ${c === 1 ? uno : varios}`;
  const atrasadas = n("reparaciones_atrasadas");

  // Tarjetas posibles; cada perfil ve tres
  const T = {
    ventas: {
      title: "Ventas de hoy",
      value: n("ventas_hoy"),
      icon: ShoppingCart,
      color: "bg-blue-500",
      subtitle: formatCurrency(n("total_ventas_hoy")),
      detalle: ["ventas", "ventas"],
    },
    reparaciones: {
      title: "Reparaciones activas",
      value: n("reparaciones_activas"),
      icon: Wrench,
      color: "bg-orange-500",
      subtitle: "Con técnico a cargo y demora",
      alerta: atrasadas > 0 ? plural(atrasadas, "atrasada", "atrasadas") : null,
      detalle: ["reparaciones", "reparaciones"],
    },
    listas: {
      title: "Listas para entregar",
      value: n("reparaciones_listas"),
      icon: CheckCircle2,
      color: "bg-green-500",
      subtitle: "Avisale al cliente que puede retirarlas",
      detalle: ["listas", "reparaciones", "listas"],
    },
    mias: {
      title: "Asignadas a mí",
      value: n("reparaciones_mias"),
      icon: UserCog,
      color: "bg-blue-500",
      subtitle: "En reparación a tu cargo",
      detalle: ["mias", "reparaciones", "mias"],
    },
    atrasadas: {
      title: "Atrasadas",
      value: atrasadas,
      icon: Clock,
      color: "bg-red-500",
      subtitle: "Pasó la entrega estimada",
      detalle: ["atrasadas", "reparaciones", "atrasadas"],
    },
    stock: {
      title: "Stock bajo",
      value: n("stock_bajo"),
      icon: AlertTriangle,
      color: "bg-red-500",
      subtitle: "Artículos por sucursal para reponer",
      detalle: ["stock", "stock"],
    },
    ingresos: {
      title: "Ingresos de mercadería",
      value: n("ingresos_semana"),
      icon: PackagePlus,
      color: "bg-blue-500",
      subtitle: "En los últimos 7 días",
      ir: "/compras",
    },
    remitos: {
      title: "Remitos entre sucursales",
      value: n("remitos_semana"),
      icon: Truck,
      color: "bg-orange-500",
      subtitle: "En los últimos 7 días",
      ir: "/remitos",
    },
  };
  const PORROL = {
    administrador: ["ventas", "reparaciones", "stock"],
    cajero: ["ventas", "reparaciones", "listas"],
    vendedor: ["ventas", "reparaciones", "listas"],
    tecnico: ["reparaciones", "mias", "atrasadas"],
    deposito: ["stock", "ingresos", "remitos"],
  };
  const tarjetas = (PORROL[user?.rol] || PORROL.administrador).map((k) => ({ clave: k, ...T[k] }));

  const A = {
    venta: { label: "Nueva venta", icon: ShoppingCart, color: "bg-blue-50 text-blue-600 hover:bg-blue-100", path: "/ventas" },
    reparacion: { label: "Nueva reparación", icon: Wrench, color: "bg-orange-50 text-orange-700 hover:bg-orange-100", path: "/reparaciones" },
    reparaciones: { label: "Ver reparaciones", icon: Wrench, color: "bg-orange-50 text-orange-700 hover:bg-orange-100", path: "/reparaciones" },
    reportes: { label: "Ver reportes", icon: TrendingUp, color: "bg-purple-50 text-purple-600 hover:bg-purple-100", path: "/reportes" },
    stock: { label: "Productos y stock", icon: Package, color: "bg-green-50 text-green-700 hover:bg-green-100", path: "/productos" },
    caja: { label: "Caja", icon: DollarSign, color: "bg-green-50 text-green-700 hover:bg-green-100", path: "/caja" },
    clientes: { label: "Ver clientes", icon: Users, color: "bg-purple-50 text-purple-600 hover:bg-purple-100", path: "/clientes" },
    tipos: { label: "Tipos de reparación", icon: ListChecks, color: "bg-blue-50 text-blue-600 hover:bg-blue-100", path: "/reparaciones?vista=tipos" },
    marcas: { label: "Marcas y modelos", icon: Smartphone, color: "bg-green-50 text-green-700 hover:bg-green-100", path: "/marcas" },
    ingreso: { label: "Ingreso de mercadería", icon: PackagePlus, color: "bg-blue-50 text-blue-600 hover:bg-blue-100", path: "/compras?nuevo=1" },
    remito: { label: "Remito entre sucursales", icon: Truck, color: "bg-orange-50 text-orange-700 hover:bg-orange-100", path: "/remitos" },
    ajuste: { label: "Ajuste de stock", icon: ArrowLeftRight, color: "bg-purple-50 text-purple-600 hover:bg-purple-100", path: "/movimientos" },
  };
  const ACCESOS = {
    administrador: ["venta", "reparacion", "reportes", "stock"],
    cajero: ["venta", "reparacion", "caja", "clientes"],
    vendedor: ["venta", "reparacion", "clientes", "stock"],
    tecnico: ["reparaciones", "tipos", "marcas", "clientes"],
    deposito: ["stock", "ingreso", "remito", "ajuste"],
  };
  const accesos = (ACCESOS[user?.rol] || ACCESOS.administrador).map((k) => A[k]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bienvenido, {user?.nombre}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Tres tarjetas por perfil: ocupan todo el ancho */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tarjetas.map((t) => (
          <StatCard
            key={t.clave}
            title={t.title}
            value={t.value}
            icon={t.icon}
            color={t.color}
            subtitle={t.subtitle}
            alerta={t.alerta}
            accion={t.ir ? "Ver" : cargandoDetalle === t.clave ? "Cargando..." : "Ver detalle"}
            activo={detalle?.clave === t.clave}
            onClick={() => (t.ir ? navigate(t.ir) : abrir(...t.detalle))}
          />
        ))}
      </div>

      {detalle && (
        <DetalleInicio
          tipo={detalle.tipo}
          filtro={detalle.filtro}
          filas={detalle.filas}
          onClose={() => setDetalle(null)}
        />
      )}

      {/* Accesos rápidos: cuatro por perfil, en una fila */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {accesos.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`${item.color} rounded-xl p-4 flex flex-col items-center gap-2 transition`}
              >
                <Icon size={24} />
                <span className="text-sm font-medium text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
