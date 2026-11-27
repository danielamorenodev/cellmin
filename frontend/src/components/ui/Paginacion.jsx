import { ChevronLeft, ChevronRight } from "lucide-react";
export default function Paginacion({
  total,
  porPagina,
  paginaActual,
  onChange,
  compacto = false,
  // Qué se cuenta: ["venta", "ventas"] → "Mostrando 1–20 de 200 ventas"
  nombre = ["registro", "registros"],
}) {
  const totalPaginas = Math.ceil(total / porPagina);
  // El contador se ve siempre que haya algo; los botones, solo con más de una página
  if (!total) return null;
  const [singular, plural] = nombre;

  const paginas = [];
  const rango = 2;

  for (let i = 1; i <= totalPaginas; i++) {
    if (
      i === 1 ||
      i === totalPaginas ||
      (i >= paginaActual - rango && i <= paginaActual + rango)
    ) {
      paginas.push(i);
    } else if (
      i === paginaActual - rango - 1 ||
      i === paginaActual + rango + 1
    ) {
      paginas.push("...");
    }
  }

  // Eliminar duplicados de '...'
  const paginasFiltradas = paginas.filter(
    (p, i) => p !== "..." || paginas[i - 1] !== "...",
  );

  return (
    <div
      className={`flex items-center px-2 py-3 ${
        compacto ? "flex-col gap-2" : "justify-between"
      }`}
    >
      <p className="text-sm text-gray-500">
        Mostrando {Math.min((paginaActual - 1) * porPagina + 1, total)}–{Math.min(paginaActual * porPagina, total)} de{" "}
        <span className="font-medium text-gray-700">{total.toLocaleString("es-AR")}</span>{" "}
        {total === 1 ? singular : plural}
      </p>
      {totalPaginas > 1 && (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(paginaActual - 1)}
          disabled={paginaActual === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={16} />
        </button>
        {paginasFiltradas.map((p, i) =>
          p === "..." ? (
            <span key={i} className="px-2 text-gray-500">
              ...
            </span>
          ) : (
            <button
              key={i}
              onClick={() => onChange(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                p === paginaActual
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onChange(paginaActual + 1)}
          disabled={paginaActual === totalPaginas}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      )}
    </div>
  );
}
