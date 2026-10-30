import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

import { idsFiltro } from "../../utils/helpers";

// Filtro de una o varias categorías.
// value: ids separados por coma ("" = todas). Así el filtro se cuenta y se
// limpia igual que los demás filtros de texto.

export default function FiltroCategorias({ categorias, value, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef(null);
  const elegidas = idsFiltro(value);

  useEffect(() => {
    const clickAfuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", clickAfuera);
    return () => document.removeEventListener("mousedown", clickAfuera);
  }, []);

  const activas = categorias
    .filter((c) => c.activo !== false)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const visibles = activas.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  const alternar = (id) => {
    const nuevas = elegidas.includes(id)
      ? elegidas.filter((x) => x !== id)
      : [...elegidas, id];
    onChange(nuevas.join(","));
  };

  const resumen =
    elegidas.length === 0
      ? "Todas las categorías"
      : elegidas.length === 1
        ? categorias.find((c) => c.id === elegidas[0])?.nombre || "1 categoría"
        : `${elegidas.length} categorías`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          elegidas.length ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-300 bg-white text-gray-700"
        }`}
      >
        <span className="truncate">{resumen}</span>
        <ChevronDown size={16} className={`shrink-0 transition ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <div className="absolute z-30 mt-1 w-full min-w-56 bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar categoría..."
                className="w-full pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
            {visibles.map((c) => {
              const marcada = elegidas.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={marcada}
                    onClick={() => alternar(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        marcada ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
                      }`}
                    >
                      {marcada && <Check size={12} />}
                    </span>
                    {c.nombre}
                  </button>
                </li>
              );
            })}
            {visibles.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
            )}
          </ul>
          {elegidas.length > 0 && (
            <div className="p-2 border-t border-gray-100 text-right">
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs text-blue-600 hover:underline"
              >
                Quitar selección
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
