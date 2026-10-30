import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { LogOut, User, DollarSign, ChevronDown, KeyRound } from "lucide-react";
import CambiarClaveModal from "../CambiarClaveModal";
import { useCotizacion } from "../../hooks/useCotizacion";
import { formatCurrency } from "../../utils/helpers";
import toast from "react-hot-toast";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const cotizacion = useCotizacion();
  const esAdmin = user?.rol === "administrador";
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [cambiarClave, setCambiarClave] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Sesión cerrada");
    navigate("/login");
  };

  const roleLabels = {
    administrador: "Administrador",
    cajero: "Cajero",
    vendedor: "Vendedor",
    deposito: "Depósito",
    tecnico: "Técnico",
  };

  return (
    <header className="h-16 shrink-0 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-sm hidden md:block">
          Sistema de Gestión — Cellmin
        </span>
      </div>
      <div className="flex items-center gap-3">
        {cotizacion.cargado && (
          <button
            type="button"
            onClick={() => esAdmin && navigate("/dolar")}
            disabled={!esAdmin}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              !cotizacion.disponible
                ? "bg-gray-100 text-gray-500"
                : cotizacion.obsoleta
                  ? "bg-yellow-50 text-yellow-700"
                  : "bg-green-50 text-green-700"
            } ${esAdmin ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
            title={
              !cotizacion.disponible
                ? "Todavía no se cargó el valor del dólar. Los precios en USD no se muestran."
                : cotizacion.obsoleta
                  ? "Este valor no se actualizó hoy"
                  : `Valor del dólar: ${cotizacion.fuente || "cargado por el administrador"}`
            }
          >
            <DollarSign size={13} />
            {cotizacion.disponible ? (
              <>
                <span>Dólar {formatCurrency(cotizacion.venta)}</span>
                {cotizacion.obsoleta && (
                  <span className="hidden sm:inline">· sin actualizar hoy</span>
                )}
              </>
            ) : (
              <span>Dólar no cargado</span>
            )}
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuUsuario(!menuUsuario)}
            aria-expanded={menuUsuario}
            title="Mi cuenta"
            className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-gray-100 transition"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-800">{user?.nombre}</p>
              <p className="text-xs text-gray-500">{roleLabels[user?.rol]}</p>
            </div>
            <ChevronDown size={14} className="hidden md:block text-gray-400" />
          </button>
          {menuUsuario && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuUsuario(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setMenuUsuario(false);
                    setCambiarClave(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <KeyRound size={15} /> Cambiar mi contraseña
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <LogOut size={16} />
          <span className="hidden md:block">Salir</span>
        </button>
      </div>
      {cambiarClave && <CambiarClaveModal onClose={() => setCambiarClave(false)} />}
    </header>
  );
}
