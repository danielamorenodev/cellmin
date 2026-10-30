import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { authService } from "../services/auth.service";
import { usuariosService } from "../services/usuarios.service";

const MINIMO = 8;
const CAMPO =
  "w-full px-3 py-2 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function CampoClave({ id, etiqueta, value, onChange, visible, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {etiqueta}
      </label>
      <input
        id={id}
        type={visible ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={CAMPO}
      />
    </div>
  );
}

// Cambio de contraseña. Sin "usuario": la propia (pide la actual).
// Con "usuario": el administrador le asigna una nueva a otra persona.
export default function CambiarClaveModal({ usuario = null, onClose }) {
  const propia = !usuario;
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [visible, setVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const error =
    nueva && nueva.length < MINIMO
      ? `Tiene que tener al menos ${MINIMO} caracteres`
      : repetir && nueva !== repetir
        ? "Las dos contraseñas nuevas no coinciden"
        : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (error || !nueva || nueva !== repetir) return;
    setGuardando(true);
    try {
      if (propia) {
        await authService.cambiarClave(actual, nueva);
        toast.success("Tu contraseña se cambió. La próxima vez ingresá con la nueva.");
      } else {
        await usuariosService.update(usuario.id, { password: nueva });
        toast.success(`Contraseña de ${usuario.nombre} cambiada. Pasásela en persona.`);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cambiar la contraseña");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <KeyRound size={18} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">
            {propia ? "Cambiar mi contraseña" : `Contraseña de ${usuario.nombre}`}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {propia && (
            <CampoClave
              id="clave-actual"
              etiqueta="Contraseña actual"
              value={actual}
              onChange={setActual}
              visible={visible}
              autoComplete="current-password"
            />
          )}
          <CampoClave
            id="clave-nueva"
            etiqueta="Contraseña nueva"
            value={nueva}
            onChange={setNueva}
            visible={visible}
            autoComplete="new-password"
          />
          <CampoClave
            id="clave-repetir"
            etiqueta="Repetí la contraseña nueva"
            value={repetir}
            onChange={setRepetir}
            visible={visible}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
          >
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            {visible ? "Ocultar contraseñas" : "Mostrar contraseñas"}
          </button>
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : (
            <p className="text-xs text-gray-500">Mínimo {MINIMO} caracteres. No la compartas.</p>
          )}
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
            disabled={guardando || !!error || !nueva || nueva !== repetir || (propia && !actual)}
            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-300"
          >
            {guardando ? "Guardando..." : "Cambiar"}
          </button>
        </div>
      </form>
    </div>
  );
}
