import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

// Campo con búsqueda sobre una lista; si lo escrito no existe, ofrece
// crearlo en el momento ("Crear «Motorola Edge 50»").
export default function ComboCrear({
  id,
  value,
  opciones,
  onChange,
  onCrear,
  placeholder,
  disabled = false,
  required = false,
  className = "",
}) {
  const [texto, setTexto] = useState(value || "");
  const [abierto, setAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const ref = useRef(null);

  // Si cambia el valor desde afuera (por ejemplo, al cambiar de marca), se refleja
  const [anterior, setAnterior] = useState(value);
  if (value !== anterior) {
    setAnterior(value);
    setTexto(value || "");
  }

  useEffect(() => {
    const fuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setAbierto(false);
        setTexto(value || "");
      }
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [value]);

  const t = texto.trim().toLowerCase();
  const visibles = opciones.filter((o) => o.toLowerCase().includes(t)).slice(0, 50);
  const existe = opciones.some((o) => o.toLowerCase() === t);

  const elegir = (o) => {
    onChange(o);
    setTexto(o);
    setAbierto(false);
  };

  const crear = async () => {
    const nombre = texto.trim();
    if (!nombre || creando) return;
    setCreando(true);
    try {
      const creado = await onCrear(nombre);
      if (creado) elegir(creado);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        type="text"
        value={texto}
        disabled={disabled}
        required={required}
        onFocus={() => setAbierto(true)}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          if (value) onChange("");
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const exacta = opciones.find((o) => o.toLowerCase() === t);
          if (exacta) elegir(exacta);
          else if (visibles.length === 1) elegir(visibles[0]);
          else if (t) crear();
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full pl-3 pr-8 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${className}`}
      />
      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      {abierto && !disabled && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1">
          {visibles.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${o === value ? "text-blue-700 font-medium" : "text-gray-700"}`}
              >
                {o}
              </button>
            </li>
          ))}
          {t && !existe && (
            <li className="border-t border-gray-100">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={crear}
                disabled={creando}
                className="w-full flex items-center gap-1.5 text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
              >
                <Plus size={14} /> {creando ? "Creando..." : `Crear «${texto.trim()}»`}
              </button>
            </li>
          )}
          {!t && visibles.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">Escribí para buscar o crear</li>
          )}
        </ul>
      )}
    </div>
  );
}
