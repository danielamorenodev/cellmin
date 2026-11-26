import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authService } from "../services/auth.service";
import { mensajeError } from "../utils/helpers";
import { Marco, Aviso, CampoClave } from "./Login";

const MINIMO = 8;

// Se llega con el link del email de la empresa: /recuperar?codigo=…
export default function RecuperarClave() {
  const [params] = useSearchParams();
  const codigo = params.get("codigo") || "";
  const [usuario, setUsuario] = useState(null);
  const [errorCodigo, setErrorLink] = useState("");
  const errorLink = codigo ? errorCodigo : "El link no es válido. Pedí uno nuevo desde el ingreso.";
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    authService
      .verRecuperacion(codigo)
      .then(setUsuario)
      .catch((e) => setErrorLink(mensajeError(e, "El link no es válido o ya venció. Pedí uno nuevo desde el ingreso.")));
  }, [codigo]);

  const guardar = async (e) => {
    e.preventDefault();
    if (nueva.length < MINIMO) return setError(`La contraseña tiene que tener al menos ${MINIMO} caracteres.`);
    if (nueva !== repetida) return setError("Las dos contraseñas no coinciden.");
    setGuardando(true);
    setError("");
    try {
      await authService.confirmarRecuperacion(codigo, nueva);
      setListo(true);
    } catch (err) {
      setError(mensajeError(err, "No se pudo cambiar la contraseña."));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Marco>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Crear una contraseña nueva</h2>
      {errorLink ? (
        <Aviso>{errorLink}</Aviso>
      ) : listo ? (
        <Aviso tipo="ok">Listo: la contraseña de {usuario?.nombre} se cambió. Ya podés ingresar con la nueva.</Aviso>
      ) : !usuario ? (
        <p className="text-sm text-gray-500">Revisando el link…</p>
      ) : (
        <form onSubmit={guardar} className="space-y-4">
          <p className="text-sm text-gray-600">
            Usuario: <strong>{usuario.nombre}</strong> ({usuario.email})
          </p>
          <CampoClave id="nueva" label="Contraseña nueva" value={nueva} onChange={setNueva} autoComplete="new-password" autoFocus />
          <CampoClave id="repetida" label="Repetila" value={repetida} onChange={setRepetida} autoComplete="new-password" />
          <p className="text-xs text-gray-500">Al menos {MINIMO} caracteres.</p>
          {error && <Aviso>{error}</Aviso>}
          <button
            type="submit"
            disabled={guardando}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition"
          >
            {guardando ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      )}
      <Link to="/login" className="mt-5 block text-center text-sm text-blue-600 hover:text-blue-800 font-medium">
        Ir al ingreso
      </Link>
    </Marco>
  );
}
