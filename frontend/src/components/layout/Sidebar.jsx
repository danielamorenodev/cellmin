import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Menu, X, ChevronDown, ChevronRight } from "lucide-react";
import { modulosPara, itemActivo, moduloActual } from "./modulos";

const ANCHO_ABIERTO = 240;
const ANCHO_CERRADO = 64;
// Demoras para abrir y cerrar el menú con el mouse: evitan que se abra al
// pasar el cursor de casualidad y que se cierre al moverlo un poco de más
const DEMORA_ABRIR = 120;
const DEMORA_CERRAR = 250;

// Logo con el nombre del sistema; lleva al inicio
function Logo({ chico, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 hover:opacity-80 transition min-w-0"
    >
      <div className={`${chico ? "w-8 h-8" : "w-10 h-10"} rounded-xl overflow-hidden shrink-0`}>
        <img src="/cellmin_logo.png" alt="Cellmin" className="w-full h-full object-contain" />
      </div>
      {!chico && (
        <div className="whitespace-nowrap text-left">
          <h1 className="text-white font-bold text-lg leading-none">Cellmin</h1>
          <p className="text-gray-400 text-xs">Sistema de Gestión</p>
        </div>
      )}
    </button>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // En la computadora el menú se abre al apoyar el mouse y se cierra al
  // sacarlo. Ocupa su lugar: la página se acomoda al lado (nunca queda tapada)
  const [abierto, setAbierto] = useState(false);
  const timerMenu = useRef(null);
  // Submódulos que se ven al apoyar el mouse sobre un módulo
  const [flotante, setFlotante] = useState(null); // { id, top }
  // En el celular, módulo desplegado al tocarlo
  const [desplegado, setDesplegado] = useState(null);
  const cerrarFlotante = useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const modulos = modulosPara(user?.rol);
  const activo = moduloActual(modulos, location);

  useEffect(() => () => {
    clearTimeout(timerMenu.current);
    clearTimeout(cerrarFlotante.current);
  }, []);

  const entrarMenu = () => {
    clearTimeout(timerMenu.current);
    if (!abierto) timerMenu.current = setTimeout(() => setAbierto(true), DEMORA_ABRIR);
  };
  const salirMenu = () => {
    clearTimeout(timerMenu.current);
    timerMenu.current = setTimeout(() => {
      setAbierto(false);
      setFlotante(null);
    }, DEMORA_CERRAR);
  };

  // Al ir a otra pantalla se cierran el menú del celular y los flotantes
  const ir = (path) => {
    navigate(path);
    setMobileOpen(false);
    setFlotante(null);
  };

  // Al elegir una pantalla el menú se cierra solo
  const irYCerrar = (path) => {
    clearTimeout(timerMenu.current);
    setAbierto(false);
    ir(path);
  };

  const mostrarFlotante = (m, e) => {
    clearTimeout(cerrarFlotante.current);
    if (m.items.length < 2) return setFlotante(null);
    const r = e.currentTarget.getBoundingClientRect();
    setFlotante({ id: m.id, top: r.top });
  };
  const ocultarFlotante = () => {
    clearTimeout(cerrarFlotante.current);
    cerrarFlotante.current = setTimeout(() => setFlotante(null), 150);
  };

  const sucursalLabel =
    user?.sucursales?.length > 1
      ? "Todas las sucursales"
      : user?.sucursales?.[0] === "sucursal_1"
        ? "Sucursal 1"
        : "Sucursal 2";

  const moduloFlotante = modulos.find((m) => m.id === flotante?.id);
  const ancho = abierto ? ANCHO_ABIERTO : ANCHO_CERRADO;

  return (
    <>
      {/* ---------- Computadora: menú fijo al costado ---------- */}
      <aside
        style={{ width: ancho }}
        onMouseEnter={entrarMenu}
        onMouseLeave={salirMenu}
        onFocus={() => setAbierto(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setAbierto(false)}
        className="hidden md:flex shrink-0 bg-gray-900 flex-col transition-[width] duration-200 relative z-40 overflow-hidden"
      >
        {/* Cerrado se ve el logo; abierto, el logo con el nombre */}
        <div
          className={`h-16 border-b border-gray-700 flex items-center shrink-0 ${
            abierto ? "px-3" : "justify-center"
          }`}
        >
          <Logo chico={!abierto} onClick={() => irYCerrar("/dashboard")} />
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {modulos.map((m) => {
            const Icon = m.icon;
            const esActivo = activo?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => irYCerrar(m.items[0].path)}
                onMouseEnter={(e) => mostrarFlotante(m, e)}
                onMouseLeave={ocultarFlotante}
                aria-label={m.label}
                title={abierto ? undefined : m.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  abierto ? "" : "justify-center"
                } ${
                  esActivo
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {abierto && <span className="flex-1 text-left">{m.label}</span>}
                {abierto && m.items.length > 1 && (
                  <ChevronRight size={14} className="opacity-60" />
                )}
              </button>
            );
          })}
        </nav>

        {abierto && (
          <div className="p-4 border-t border-gray-700 space-y-1">
            <p className="text-xs text-gray-500 text-center">{sucursalLabel}</p>
            <p className="text-xs text-gray-600 text-center capitalize">{user?.rol}</p>
          </div>
        )}
      </aside>

      {/* Submódulos al apoyar el mouse */}
      {moduloFlotante && abierto && (
        <div
          onMouseEnter={() => {
            // Pasar del menú a los submódulos no cierra el menú
            clearTimeout(cerrarFlotante.current);
            clearTimeout(timerMenu.current);
          }}
          onMouseLeave={() => {
            ocultarFlotante();
            salirMenu();
          }}
          style={{ top: Math.min(flotante.top, window.innerHeight - 60 - moduloFlotante.items.length * 40), left: ancho - 4 }}
          className="hidden md:block fixed z-50 pl-2"
        >
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 w-52">
            <p className="px-4 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {moduloFlotante.label}
            </p>
            {moduloFlotante.items.map((i) => (
              <button
                key={i.path}
                onClick={() => irYCerrar(i.path)}
                className={`w-full text-left px-4 py-2 text-sm transition ${
                  itemActivo(i, location)
                    ? "text-blue-700 bg-blue-50 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Celular y tablet chica: menú desplegable ---------- */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="h-16 px-3 border-b border-gray-700 flex items-center justify-between shrink-0">
          <Logo onClick={() => ir("/dashboard")} />
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar el menú"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {modulos.map((m) => {
            const Icon = m.icon;
            const esActivo = activo?.id === m.id;
            const varios = m.items.length > 1;
            const abiertoAca = desplegado === m.id || (desplegado === null && esActivo);
            return (
              <div key={m.id}>
                <button
                  onClick={() => (varios ? setDesplegado(abiertoAca ? "" : m.id) : ir(m.items[0].path))}
                  aria-expanded={varios ? abiertoAca : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    esActivo ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1 text-left">{m.label}</span>
                  {varios && (
                    <ChevronDown size={16} className={`transition ${abiertoAca ? "rotate-180" : ""}`} />
                  )}
                </button>
                {varios && abiertoAca && (
                  <div className="ml-9 mt-1 mb-2 space-y-0.5 border-l border-gray-700 pl-2">
                    {m.items.map((i) => (
                      <button
                        key={i.path}
                        onClick={() => ir(i.path)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                          itemActivo(i, location) ? "text-white bg-gray-800" : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {i.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-700 space-y-1">
          <p className="text-xs text-gray-500 text-center">{sucursalLabel}</p>
          <p className="text-xs text-gray-600 text-center capitalize">{user?.rol}</p>
        </div>
      </aside>

      {/* Barra superior del celular */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-gray-900 flex items-center gap-3 px-4">
        <button
          onClick={() => {
            setDesplegado(null);
            setMobileOpen(true);
          }}
          aria-label="Abrir el menú"
          className="p-1.5 text-white rounded-lg"
        >
          <Menu size={22} />
        </button>
        <button onClick={() => ir("/dashboard")} className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0">
            <img src="/cellmin_logo.png" alt="Cellmin" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-bold text-base">Cellmin</span>
        </button>
      </div>
    </>
  );
}
