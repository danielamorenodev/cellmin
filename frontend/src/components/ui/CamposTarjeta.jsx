import { formatCurrency, recargoTarjeta } from "../../utils/helpers";

// Con débito o crédito: qué tarjeta se usa y, en crédito, en cuántas cuotas.
// pago = { metodo, tarjeta_id, cuotas }; base = pesos que cubre ese pago.
export default function CamposTarjeta({ pago, tarjetas, base, onChange, className = "" }) {
  if (pago.metodo !== "debito" && pago.metodo !== "credito") return null;
  const disponibles = tarjetas.filter((t) => t[pago.metodo]);
  if (disponibles.length === 0) return null;
  const tarjeta = disponibles.find((t) => t.id === pago.tarjeta_id);
  const planes = tarjeta?.planes?.length ? tarjeta.planes : [{ cuotas: 1, recargo: 0 }];
  const recargo = recargoTarjeta(pago, tarjetas, base || 0);
  const campo =
    "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className={`grid gap-2 ${pago.metodo === "credito" ? "grid-cols-2" : "grid-cols-1"} ${className}`}>
      <select
        value={pago.tarjeta_id || ""}
        onChange={(e) => onChange({ tarjeta_id: e.target.value, cuotas: 1 })}
        aria-label="Tarjeta"
        required
        className={`${campo} ${pago.tarjeta_id ? "" : "text-gray-500"}`}
      >
        <option value="">Elegí la tarjeta</option>
        {disponibles.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </select>
      {pago.metodo === "credito" && (
        <select
          value={pago.cuotas || 1}
          onChange={(e) => onChange({ cuotas: Number(e.target.value) })}
          aria-label="Cuotas"
          disabled={!tarjeta}
          className={campo}
        >
          {planes.map((p) => (
            <option key={p.cuotas} value={p.cuotas}>
              {p.cuotas === 1 ? "1 pago" : `${p.cuotas} cuotas`}
              {p.recargo > 0 ? ` (+${p.recargo}%)` : " (sin recargo)"}
            </option>
          ))}
        </select>
      )}
      {recargo.monto > 0 && (
        <p className="col-span-full text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-1.5">
          Recargo {recargo.pct}%: + {formatCurrency(recargo.monto)}. En la tarjeta se cobran{" "}
          <span className="font-semibold">{formatCurrency((base || 0) + recargo.monto)}</span>
          {Number(pago.cuotas) > 1 &&
            ` (${pago.cuotas} cuotas de ${formatCurrency(((base || 0) + recargo.monto) / pago.cuotas)})`}
          .
        </p>
      )}
    </div>
  );
}
