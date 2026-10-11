import { useAuth } from "../context/AuthContext";
import { SUCURSALES } from "../utils/helpers";

// Sucursales que el usuario puede elegir: el administrador ve todas; el
// resto, solo las suyas. Si tiene una sola, no hay nada para elegir.
export function useSucursales() {
  const { user } = useAuth();
  const propias = user?.sucursales?.length ? user.sucursales : ["sucursal_1"];
  const opciones =
    user?.rol === "administrador"
      ? SUCURSALES
      : SUCURSALES.filter((s) => propias.includes(s.value));
  return {
    opciones,
    unica: opciones.length === 1 ? opciones[0].value : null,
    porDefecto: opciones[0]?.value || "sucursal_1",
  };
}
