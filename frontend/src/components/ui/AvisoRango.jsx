import { rangoInvertido } from "../../utils/validaciones";

// Aviso cuando la fecha "hasta" quedó antes que la "desde" (el filtro no
// mostraría nada).

export default function AvisoRango({ desde, hasta, className = "" }) {
  if (!rangoInvertido(desde, hasta)) return null;
  return (
    <p role="alert" className={`text-xs text-red-600 ${className}`}>
      La fecha «hasta» es anterior a la fecha «desde»: corregila para ver resultados.
    </p>
  );
}
