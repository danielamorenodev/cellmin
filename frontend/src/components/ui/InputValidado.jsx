import { useState } from "react";

// Campo de texto con su regla de validación: marca el error en rojo debajo.
// Las letras se avisan apenas se escriben; el largo, al salir del campo.
export default function InputValidado({ value, validar, className = "", onBlur, ...props }) {
  const [tocado, setTocado] = useState(false);
  const error = validar(value || "");
  const mostrar = !!error && (tocado || /[a-zA-ZñÑ]/.test(value || ""));
  return (
    <>
      <input
        value={value}
        onBlur={(e) => {
          setTocado(true);
          onBlur?.(e);
        }}
        aria-invalid={mostrar}
        className={mostrar ? className.replace("border-gray-300", "border-red-400") : className}
        {...props}
      />
      {mostrar && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </>
  );
}
