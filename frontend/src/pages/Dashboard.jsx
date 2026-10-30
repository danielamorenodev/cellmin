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
  // Tarjeta abierta: ventas | reparaciones | stock
  const [detalle, setDetalle] = useState(null);
  const alternar = (tipo) => setDetalle(detalle === tipo ? null : tipo);
  const atrasadas = stats?.reparaciones_atrasadas ?? 0;
  const tarjetaReparaciones = (
    <StatCard
      title="Reparaciones activas"
      value={stats?.reparaciones_activas ?? 0}
      icon={Wrench}
      color="bg-orange-500"
      subtitle="Con técnico a cargo y demora"
      alerta={atrasadas > 0 ? `${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"}` : null}
      onClick={() => alternar("reparaciones")}
      activo={detalle === "reparaciones"}
    />
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get("/reports/dashboard");
        setStats(response.data);
      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );

  const accesosRapidos = {
    administrador: [
      {
        label: "Nueva Venta",
        icon: ShoppingCart,
        color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
        path: "/ventas",
      },
      {
        label: "Nueva Reparación",
        icon: Wrench,
        color: "bg-orange-50 text-orange-700 hover:bg-orange-100",
        path: "/reparaciones",
      },
      {
        label: "Ver Reportes",
        icon: TrendingUp,
        color: "bg-purple-50 text-purple-600 hover:bg-purple-100",
        path: "/reportes",
      },
      {
        label: "Productos y stock",
        icon: Package,
        color: "bg-green-50 text-green-700 hover:bg-green-100",
        path: "/productos",
      },
    ],
    cajero: [
      {
        label: "Nueva Venta",
        icon: ShoppingCart,
        color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
        path: "/ventas",
      },
      {
        label: "Nueva Reparación",
        icon: Wrench,
        color: "bg-orange-50 text-orange-700 hover:bg-orange-100",
        path: "/reparaciones",
      },
      {
        label: "Caja",
        icon: TrendingUp,
        color: "bg-green-50 text-green-700 hover:bg-green-100",
        path: "/caja",
      },
      {
        label: "Ver Clientes",
        icon: Users,
        color: "bg-purple-50 text-purple-600 hover:bg-purple-100",
        path: "/clientes",
      },
    ],
    vendedor: [
      {
        label: "Nueva Venta",
        icon: ShoppingCart,
        color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
        path: "/ventas",
      },
      {
        label: "Nueva Reparación",
        icon: Wrench,
        color: "bg-orange-50 text-orange-700 hover:bg-orange-100",
        path: "/reparaciones",
      },
      {
        label: "Ver Clientes",
        icon: Users,
        color: "bg-purple-50 text-purple-600 hover:bg-purple-100",
        path: "/clientes",
      },
      {
        label: "Productos y stock",
        icon: Package,
        color: "bg-green-50 text-green-700 hover:bg-green-100",
        path: "/productos",
      },
    ],
    tecnico: [
      {
        label: "Ver Reparaciones",
        icon: Wrench,
        color: "bg-orange-50 text-orange-700 hover:bg-orange-100",
        path: "/reparaciones",
      },
      {
        label: "Ver Clientes",
        icon: Users,
        color: "bg-purple-50 text-purple-600 hover:bg-purple-100",
        path: "/clientes",
      },
    ],
    deposito: [
      {
        label: "Productos y stock",
        icon: Package,
        color: "bg-green-50 text-green-700 hover:bg-green-100",
        path: "/productos",
      },
      {
        label: "Ingreso de mercadería",
        icon: ShoppingCart,
        color: "bg-blue-50 text-blue-600 hover:bg-blue-100",
        path: "/compras?nuevo=1",
      },
      {
        label: "Remito entre sucursales",
        icon: Package,
        color: "bg-orange-50 text-orange-700 hover:bg-orange-100",
        path: "/remitos",
      },
    ],
  };

  const accesos = accesosRapidos[user?.rol] || accesosRapidos.administrador;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Bienvenido, {user?.nombre}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Cards métricas — solo para roles que tienen acceso */}
      {user?.rol !== "tecnico" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(user?.rol === "administrador" ||
            user?.rol === "cajero" ||
            user?.rol === "vendedor") && (
            <StatCard
              title="Ventas de hoy"
              value={stats?.ventas_hoy ?? 0}
              icon={ShoppingCart}
              color="bg-blue-500"
              subtitle={formatCurrency(stats?.total_ventas_hoy ?? 0)}
              onClick={() => alternar("ventas")}
              activo={detalle === "ventas"}
            />
          )}
          {user?.rol !== "deposito" && tarjetaReparaciones}
          {(user?.rol === "administrador" || user?.rol === "deposito") && (
            <StatCard
              title="Stock bajo"
              value={stats?.stock_bajo ?? 0}
              icon={AlertTriangle}
              color="bg-red-500"
              subtitle="Artículos por sucursal para reponer"
              onClick={() => alternar("stock")}
              activo={detalle === "stock"}
            />
          )}
        </div>
      )}

      {/* Para técnico solo reparaciones activas */}
      {user?.rol === "tecnico" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tarjetaReparaciones}
        </div>
      )}

      {detalle && <DetalleInicio tipo={detalle} onClose={() => setDetalle(null)} />}

      {/* Accesos rápidos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Accesos rápidos
        </h2>
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
                <span className="text-sm font-medium text-center">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
