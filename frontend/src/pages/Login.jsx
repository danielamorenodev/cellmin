import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import { mensajeError } from "../utils/helpers";
import toast from "react-hot-toast";

const CAMPO =
  "w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const ETIQUETA = "block text-sm font-medium text-gray-700 mb-1";

// Mensaje claro según lo que pasó al ingresar
function motivoError(error) {
  if (!error.response) return "No se pudo conectar con el servidor. Revisá la conexión a internet.";
  if (error.response.status === 401) return "Email o contraseña incorrectos.";
  if (error.response.status === 429) return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
  return mensajeError(error, "No se pudo ingresar. Probá de nuevo.");
}

export function Marco({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src="/cellmin_logo.png"
            alt=""
            className="w-20 h-20 object-contain rounded-2xl mx-auto mb-3"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <h1 className="text-3xl font-bold text-gray-900">Cellmin</h1>
          <p className="text-gray-500 mt-1">Sistema de Gestión</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export function Aviso({ tipo = "error", children }) {
  const error = tipo === "error";
  const Icono = error ? AlertCircle : CheckCircle2;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex gap-2 items-start rounded-xl px-3 py-2.5 text-sm ${
        error ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"
      }`}
    >
      <Icono size={18} className="shrink-0 mt-px" />
      <span>{children}</span>
    </div>
  );
}

export function CampoClave({ id, label, value, onChange, autoComplete, autoFocus }) {
  const [ver, setVer] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={ETIQUETA}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={ver ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          className={`${CAMPO} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVer(!ver)}
          aria-label={ver ? "Ocultar la contraseña" : "Mostrar la contraseña"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 rounded-lg"
        >
          {ver ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

function OlvideClave({ emailInicial, onVolver }) {
  const [email, setEmail] = useState(emailInicial);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { tipo, texto }
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    authService
      .estadoRecuperacion()
      .then((r) => setDisponible(r.disponible))
      .catch(() => {});
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setResultado(null);
    try {
      const r = await authService.pedirRecuperacion(email.trim());
      setResultado({ tipo: "ok", texto: r.message });
    } catch (error) {
      setResultado({ tipo: "error", texto: mensajeError(error, "No se pudo enviar el pedido. Probá de nuevo.") });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Recuperar la contraseña</h2>
      <p className="text-sm text-gray-600 mb-5">
        Escribí tu email de usuario. Te mandamos un link para crear una contraseña nueva al{" "}
        <strong>email de la empresa</strong>: pedíselo a quien lo revisa. El link vale 30 minutos.
      </p>
      {!disponible ? (
        <Aviso>
          La recuperación por email todavía no está configurada. Pedile al administrador que te asigne una contraseña
          nueva desde Configuración → Usuarios.
        </Aviso>
      ) : resultado?.tipo === "ok" ? (
        <Aviso tipo="ok">{resultado.texto}</Aviso>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label htmlFor="recuperar-email" className={ETIQUETA}>
              Email
            </label>
            <input
              id="recuperar-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="username"
              autoFocus
              required
              className={CAMPO}
            />
          </div>
          {resultado?.tipo === "error" && <Aviso>{resultado.texto}</Aviso>}
          <button
            type="submit"
            disabled={enviando}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            <Mail size={18} /> {enviando ? "Enviando..." : "Enviar link"}
          </button>
        </form>
      )}
      <button
        type="button"
        onClick={onVolver}
        className="mt-5 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        <ArrowLeft size={16} /> Volver al ingreso
      </button>
    </>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [olvide, setOlvide] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      toast.success(`¡Bienvenido, ${user.nombre}!`);
      navigate("/dashboard");
    } catch (err) {
      setError(motivoError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Marco>
      {olvide ? (
        <OlvideClave emailInicial={email} onVolver={() => setOlvide(false)} />
      ) : (
        <>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className={ETIQUETA}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="username"
                required
                className={CAMPO}
              />
            </div>
            <CampoClave
              id="login-clave"
              label="Contraseña"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <Aviso>{error}</Aviso>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setOlvide(true)}
            className="mt-5 w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </>
      )}
    </Marco>
  );
}
