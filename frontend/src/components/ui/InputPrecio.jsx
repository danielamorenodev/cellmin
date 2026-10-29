import { useState } from "react";
import InputNumero from "./InputNumero";
import { useCotizacion } from "../../hooks/useCotizacion";
import { formatCurrency, formatUSD } from "../../utils/helpers";

// Precio que se puede cargar en pesos o en dólares.
// - `pesos` es siempre el valor real (lo que se guarda).
// - moneda "ars": se escribe en pesos y debajo se ve el equivalente en USD.
// - moneda "usd": se escribe en dólares y debajo se ve el equivalente en pesos,
//   calculado con el valor del dólar cargado en el sistema.
// Para que el campo se reinicie al cambiar de moneda, el padre debe usar
// key={moneda}.
export default function InputPrecio({
  pesos,
  onChange,
  moneda = "ars",
  className = "",
  ...resto
}) {
  const { aUSD, aPesos } = useCotizacion();
  const esUSD = moneda === "usd";
  const [usd, setUsd] = useState(() => {
    if (!esUSD || pesos === "" || pesos == null) return "";
    const v = aUSD(Number(pesos));
    return v === null ? "" : Math.round(v * 100) / 100;
  });

  const cambiarUSD = (valor) => {
    setUsd(valor);
    if (valor === "") return onChange("");
    const p = aPesos(valor);
    if (p !== null) onChange(p);
  };

  const equivalente = esUSD
    ? pesos !== "" && pesos != null
      ? `= ${formatCurrency(pesos)}`
      : null
    : (() => {
        const v = aUSD(Number(pesos) || 0);
        return pesos !== "" && pesos != null && v !== null
          ? `≈ ${formatUSD(v)}`
          : null;
      })();

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium pointer-events-none">
          {esUSD ? "US$" : "$"}
        </span>
        <InputNumero
          {...resto}
          value={esUSD ? usd : pesos}
          onChange={esUSD ? cambiarUSD : onChange}
          className={`${className} pl-9`}
        />
      </div>
      {equivalente && (
        <p className="text-[11px] text-gray-500 mt-0.5">{equivalente}</p>
      )}
    </div>
  );
}

// Selector de la moneda en la que se cargan los precios, con la cotización
// que se usa para convertir entre pesos y dólares
export function SelectorMoneda({ moneda, onChange }) {
  const { disponible, venta } = useCotizacion();
  const opciones = [
    { v: "ars", t: "Pesos ($)" },
    { v: "usd", t: "Dólares (US$)" },
  ];
  return (
    <div className="flex flex-col items-end gap-0.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Cargar en</span>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Moneda de los precios">
          {opciones.map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={moneda === o.v}
              disabled={o.v === "usd" && !disponible}
              onClick={() => onChange(o.v)}
              className={`px-2.5 py-1 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                moneda === o.v
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
      </div>
      {disponible ? (
        <span className="text-gray-500">
          Cotización utilizada: $ {new Intl.NumberFormat("es-AR").format(venta)} por USD
        </span>
      ) : (
        <span className="text-red-600">
          Sin cotización cargada: solo se puede cargar en pesos
        </span>
      )}
    </div>
  );
}
