import { useMemo, useState } from "react";
import { X, Undo2, Printer, MessageCircle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, formatDateTime, mensajeError, nombreSucursal } from "../../utils/helpers";
import { METODOS_DEVOLUCION, nombreMetodo, devueltasPorItem } from "../../utils/devoluciones";
import { confirmar } from "../../utils/confirmar";
import { ventasService } from "../../services/ventas.service";
import InputNumero from "./InputNumero";

// Lo que pagó el cliente por unidad: con el descuento o recargo de la venta repartido
const precioPagado = (venta, item) => {
  const suma = (venta.items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
  const factor = suma > 0 ? venta.total / suma : 1;
  return item.cantidad ? (item.subtotal / item.cantidad) * factor : 0;
};

const metodoInicial = (venta) => {
  const pagos = venta.pagos || [];
  const unico = pagos.length === 1 ? pagos[0].metodo : String(venta.metodo_pago || "").split(" ")[0];
  return METODOS_DEVOLUCION.some((m) => m.value === unico) ? unico : "efectivo";
};

export default function DevolucionModal({ venta, cliente, onClose, onHecha }) {
  const devueltas = useMemo(() => devueltasPorItem(venta), [venta]);
  const imeisYaDevueltos = useMemo(
    () => new Set((venta.devoluciones || []).flatMap((d) => d.items.flatMap((i) => i.imeis || []))),
    [venta],
  );
  // Por producto: cuántas se devuelven, si vuelven al stock y qué IMEI
  const [filas, setFilas] = useState(() =>
    (venta.items || []).map(() => ({ cantidad: 0, vuelveStock: true, imeis: [] })),
  );
  const [montoManual, setMontoManual] = useState(null);
  const [metodo, setMetodo] = useState(() => metodoInicial(venta));
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cambiar = (i, cambios) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...cambios } : x)));
  const calculado =
    Math.round(filas.reduce((s, f, i) => s + precioPagado(venta, venta.items[i]) * f.cantidad, 0) * 100) / 100;
  const maximo = Math.round((venta.total - (venta.total_devuelto || 0)) * 100) / 100;
  const monto = montoManual ?? Math.min(calculado, maximo);
  const elegidas = filas.reduce((s, f) => s + f.cantidad, 0);

  const registrar = async (e) => {
    e.preventDefault();
    if (!elegidas) return toast.error("Elegí qué productos se devuelven");
    if (!(monto >= 0) || monto > maximo + 0.01)
      return toast.error(`El monto a devolver tiene que estar entre $0 y ${formatCurrency(maximo)}`);
    const detalle = filas
      .map((f, i) =>
        f.cantidad
          ? `${f.cantidad} × ${venta.items[i].nombre_producto}${f.vuelveStock ? "" : " (no vuelve al stock)"}`
          : null,
      )
      .filter(Boolean)
      .join(", ");
    const ok = await confirmar({
      titulo: "Registrar devolución",
      mensaje: `¿Estás seguro de que querés devolver ${formatCurrency(monto)} en ${nombreMetodo(metodo).toLowerCase()}?`,
      detalle: `${detalle}. Sale de la caja abierta de ${nombreSucursal(venta.sucursal)}.`,
      textoConfirmar: "Sí, registrar la devolución",
    });
    if (!ok) return;
    setEnviando(true);
    try {
      const res = await ventasService.devolver(venta._id, {
        items: filas
          .map((f, i) => ({ indice: i, cantidad: f.cantidad, vuelve_stock: f.vuelveStock, imeis: f.imeis }))
          .filter((x) => x.cantidad > 0),
        metodo,
        monto,
        motivo: motivo.trim() || null,
      });
      toast.success(`Devolución ${res.numero} registrada`);
      onHecha(res.devolucion);
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo registrar la devolución"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={registrar}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl"
        role="dialog"
        aria-labelledby="titulo-devolucion"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 id="titulo-devolucion" className="text-lg font-semibold text-gray-800">
              Devolución de la venta {venta.numero_venta}
            </h2>
            <p className="text-sm text-gray-500">
              {formatDateTime(venta.fecha)} · {nombreSucursal(venta.sucursal)}
              {cliente ? ` · ${cliente.nombre} ${cliente.apellido || ""}` : ""}
            </p>
          </div>
          <button type="button" data-cerrar onClick={onClose} aria-label="Cerrar" className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">¿Qué se devuelve?</p>
            {venta.items.map((item, i) => {
              const quedan = item.cantidad - devueltas[i];
              const f = filas[i];
              const imeisDisponibles = (item.imeis || []).filter((x) => !imeisYaDevueltos.has(x));
              return (
                <div key={i} className={`rounded-xl border p-3 ${f.cantidad ? "border-blue-300 bg-blue-50/40" : "border-gray-200"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{item.nombre_producto}</p>
                      <p className="text-xs text-gray-500">
                        Vendidas: {item.cantidad}
                        {devueltas[i] > 0 && ` · ya devueltas: ${devueltas[i]}`} · pagó {formatCurrency(precioPagado(venta, item))} c/u
                      </p>
                    </div>
                    {quedan <= 0 ? (
                      <span className="text-xs text-gray-500">Ya se devolvió todo</span>
                    ) : item.imeis?.length ? null : (
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        Devuelve
                        <InputNumero
                          value={f.cantidad}
                          decimales={0}
                          max={quedan}
                          onChange={(v) => cambiar(i, { cantidad: Math.max(0, Math.min(quedan, parseInt(v, 10) || 0)) })}
                          aria-label={`Unidades de ${item.nombre_producto} que se devuelven`}
                          className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">de {quedan}</span>
                      </label>
                    )}
                  </div>
                  {quedan > 0 && item.imeis?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {imeisDisponibles.map((imei) => (
                        <label key={imei} className="flex items-center gap-1.5 text-xs font-mono bg-white border border-gray-200 rounded-lg px-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={f.imeis.includes(imei)}
                            onChange={(e) => {
                              const imeis = e.target.checked ? [...f.imeis, imei] : f.imeis.filter((x) => x !== imei);
                              cambiar(i, { imeis, cantidad: imeis.length });
                            }}
                          />
                          IMEI {imei}
                        </label>
                      ))}
                    </div>
                  )}
                  {f.cantidad > 0 && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.vuelveStock}
                        onChange={(e) => cambiar(i, { vuelveStock: e.target.checked })}
                        className="w-4 h-4 text-blue-600"
                      />
                      Vuelve al stock (está en condiciones de venderse)
                      {!f.vuelveStock && <span className="text-xs text-amber-700">· vino fallado: no se suma al stock</span>}
                    </label>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Monto a devolver</span>
              <InputNumero
                value={monto}
                onChange={(v) => setMontoManual(v === "" ? null : v)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="block text-xs text-gray-500 mt-1">
                Lo que pagó por esas unidades: {formatCurrency(calculado)}. Máximo: {formatCurrency(maximo)}.
                {montoManual != null && (
                  <button type="button" onClick={() => setMontoManual(null)} className="ml-1 text-blue-600 hover:underline">
                    Usar el calculado
                  </button>
                )}
              </span>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Se devuelve en</span>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {METODOS_DEVOLUCION.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Motivo (opcional)</span>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: no le funcionó, se equivocó de modelo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <p className="text-xs text-gray-500">
            El dinero sale de la caja abierta de hoy de {nombreSucursal(venta.sucursal)}. La venta original no se modifica: queda anotada la devolución.
          </p>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button type="button" data-cerrar onClick={onClose} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !elegidas}
            className="flex-1 py-2 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Undo2 size={16} /> {enviando ? "Registrando..." : `Devolver ${formatCurrency(monto)}`}
          </button>
        </div>
      </form>
    </div>
  );
}

// Después de registrar: imprimir el comprobante o mandarlo por WhatsApp
export function DevolucionRegistrada({ devolucion, onImprimir, onWhatsApp, onClose }) {
  const [hecho, setHecho] = useState({});
  const opcion = (que, icono, texto, accion, color) => (
    <button
      type="button"
      onClick={() => {
        setHecho((h) => ({ ...h, [que]: true }));
        accion();
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition ${
        hecho[que] ? "border-gray-200 bg-gray-50 text-gray-500" : "border-gray-200 hover:bg-gray-50 text-gray-800"
      }`}
    >
      <span className={hecho[que] ? "text-green-600" : color}>{hecho[que] ? <CheckCircle size={18} /> : icono}</span>
      {texto}
      {hecho[que] && <span className="ml-auto text-xs font-normal">Listo</span>}
    </button>
  );
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4" role="dialog" aria-labelledby="devolucion-registrada">
        <div className="text-center space-y-1">
          <CheckCircle size={40} className="mx-auto text-green-600" />
          <h2 id="devolucion-registrada" className="text-lg font-semibold text-gray-800">
            Devolución {devolucion.numero} registrada
          </h2>
          <p className="text-sm text-gray-500">
            Se devolvieron {formatCurrency(devolucion.monto)} en {nombreMetodo(devolucion.metodo).toLowerCase()}.
          </p>
        </div>
        <div className="space-y-2">
          {opcion("imprimir", <Printer size={18} />, "Imprimir comprobante", onImprimir, "text-blue-600")}
          {opcion("whatsapp", <MessageCircle size={18} />, "Enviar por WhatsApp", onWhatsApp, "text-green-600")}
        </div>
        <button data-cerrar type="button" onClick={onClose} className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          Listo
        </button>
      </div>
    </div>
  );
}

// Devoluciones de una venta (en su detalle)
export function ListaDevoluciones({ venta, onImprimir }) {
  if (!venta.devoluciones?.length) return null;
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
      <p className="text-sm font-semibold text-orange-800">
        Devoluciones · total devuelto {formatCurrency(venta.total_devuelto || 0)}
      </p>
      {venta.devoluciones.map((d) => (
        <div key={d.numero} className="text-sm text-gray-700 border-t border-orange-100 pt-2 first:border-0 first:pt-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{d.numero}</span>
            <span className="text-gray-500">{formatDateTime(d.fecha)}</span>
            <span>
              {formatCurrency(d.monto)} en {nombreMetodo(d.metodo).toLowerCase()}
            </span>
            {d.usuario_nombre && <span className="text-gray-500">· {d.usuario_nombre}</span>}
            {onImprimir && (
              <button type="button" onClick={() => onImprimir(d)} className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Printer size={13} /> Comprobante
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600">
            {d.items
              .map((i) => `${i.cantidad} × ${i.nombre_producto}${i.vuelve_stock ? "" : " (no volvió al stock)"}`)
              .join(", ")}
            {d.motivo ? ` · Motivo: ${d.motivo}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
