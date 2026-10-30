import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { modulosPara, moduloActual, itemActivo } from "./modulos";

// Pestañas con los submódulos del módulo actual, siempre a la vista arriba de
// la pantalla (las mismas opciones que aparecen en el menú)
export default function PestanasModulo() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const modulo = moduloActual(modulosPara(user?.rol), location);
  if (!modulo || modulo.items.length < 2) return null;

  return (
    <nav
      aria-label={`Secciones de ${modulo.label}`}
      className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {modulo.items.map((i) => {
        const activo = itemActivo(i, location);
        return (
          <button
            key={i.path}
            onClick={() => navigate(i.path)}
            aria-current={activo ? "page" : undefined}
            className={`px-4 py-2.5 -mb-px text-sm font-medium whitespace-nowrap border-b-2 transition ${
              activo
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            {i.label}
          </button>
        );
      })}
    </nav>
  );
}
