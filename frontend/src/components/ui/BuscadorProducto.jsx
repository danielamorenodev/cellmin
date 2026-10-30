import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SUCURSALES, stockEn } from "../../utils/helpers";

// Busca un producto por nombre o código de barras y lo devuelve al elegirlo.
// Muestra el stock de cada sucursal para decidir rápido.
export default function BuscadorProducto({ productos, onElegir, placeholder = "Buscar producto por nombre o código..." }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const t = texto.trim().toLowerCase();
  const resultados = t
    ? productos
        .filter((p) => p.activo !== false)
        .filter(
          (p) =>
            p.nombre.toLowerCase().includes(t) ||
            (p.codigo_barras || "").includes(t) ||
            (p.variantes || []).some(
              (v) => v.nombre.toLowerCase().includes(t) || (v.codigo_barras || "").includes(t),
            ),
        )
        .slice(0, 8)
    : [];

  const stockDe = (p, suc) =>
    p.tiene_variantes
      ? (p.variantes || []).reduce((a, v) => a + stockEn(v, suc), 0)
      : stockEn(p, suc);

  const elegir = (p) => {
    onElegir(p);
    setTexto("");
    setAbierto(false);
    setActivo(0);
  };

  return (
    <div ref={ref} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          setActivo(0);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (!resultados.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActivo((a) => Math.min(a + 1, resultados.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActivo((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            elegir(resultados[activo]);
          }
        }}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {abierto && t && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto py-1">
          {resultados.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(p)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  i === activo ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="text-gray-800">
                  {p.nombre}
                  {p.tiene_variantes && (
                    <span className="ml-2 text-xs text-blue-600">{p.variantes.length} variantes</span>
                  )}
                </span>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {SUCURSALES.map((s, k) => `${k ? " · " : ""}S${k + 1}: ${stockDe(p, s.value)}`).join("")}
                </span>
              </button>
            </li>
          ))}
          {resultados.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">No hay productos con ese nombre</li>
          )}
        </ul>
      )}
    </div>
  );
}
