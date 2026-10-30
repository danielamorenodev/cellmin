import { useEffect, useState } from "react";
import { Plus, ArrowRight, X, Truck, Eye, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { remitosService } from "../services/remitos.service";
import { productosService } from "../services/productos.service";
import BuscadorProducto from "../components/ui/BuscadorProducto";
import InputNumero from "../components/ui/InputNumero";
import Paginacion from "../components/ui/Paginacion";
import ThOrdenable from "../components/ui/ThOrdenable";
import MenuAcciones from "../components/ui/MenuAcciones";
import { useTabla } from "../hooks/useTabla";
import { SUCURSALES, formatDateTime, nombreSucursal, stockEn } from "../utils/helpers";

const CAMPO =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
const ETIQUETA = "block text-xs font-medium text-gray-600 mb-1";

const otraSucursal = (s) => SUCURSALES.find((o) => o.value !== s)?.value || "";

function NuevoRemitoModal({ onClose, onSave }) {
  const [productos, setProductos] = useState([]);
  const [origen, setOrigen] = useState(SUCURSALES[0].value);
  const [items, setItems] = useState([]);
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  // Una clave por formulario: un doble click no registra dos remitos
  const [clave] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const destino = otraSucursal(origen);

  useEffect(() => {
    productosService.getAll().then(setProductos).catch(() => {});
  }, []);

  // Stock disponible en origen del artículo de una línea
  const disponible = (it) => {
    const p = productos.find((x) => x.id === it.producto_id);
    if (!p) return 0;
    if (p.tiene_variantes) {
      const v = p.variantes.find((x) => x.nombre === it.variante_nombre);
      return v ? stockEn(v, origen) : null;
    }
    return stockEn(p, origen);
  };

  const agregar = (p) =>
    setItems((l) => [...l, { producto_id: p.id, nombre: p.nombre, variante_nombre: "", cantidad: 1 }]);
  const cambiar = (i, campo, valor) =>
    setItems((l) => l.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));

  const excede = items.some((it) => {
    const d = disponible(it);
    return d !== null && Number(it.cantidad) > d;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Agregá al menos un producto");
      return;
    }
    if (excede) {
      toast.error(`Hay cantidades mayores al stock de ${nombreSucursal(origen)}`);
      return;
    }
    setLoading(true);
    try {
      const r = await remitosService.create({
        origen,
        destino,
        notas,
        clave_idempotencia: clave,
        items: items.map((it) => ({
          producto_id: it.producto_id,
          variante_nombre: it.variante_nombre || null,
          cantidad: parseInt(it.cantidad),
        })),
      });
      const unidades = items.reduce((a, it) => a + (parseInt(it.cantidad) || 0), 0);
      toast.success(
        `Remito ${r.numero} registrado: ${unidades} ${unidades === 1 ? "unidad pasó" : "unidades pasaron"} de ${nombreSucursal(origen)} a ${nombreSucursal(destino)}`,
      );
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar el remito");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">Nuevo remito entre sucursales</h2>
          <p className="text-xs text-gray-500">
            La mercadería se descuenta de la sucursal que envía y se suma en la que recibe.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div>
                <label htmlFor="rem-origen" className={ETIQUETA}>Envía</label>
                <select
                  id="rem-origen"
                  value={origen}
                  onChange={(e) => setOrigen(e.target.value)}
                  className={CAMPO}
                >
                  {SUCURSALES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <ArrowRight size={18} className="mb-2.5 text-gray-400" />
              <div>
                <span className={ETIQUETA}>Recibe</span>
                <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700">
                  {nombreSucursal(destino)}
                </div>
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Productos</h3>
              <BuscadorProducto productos={productos} onElegir={agregar} />
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-300 rounded-lg">
                  Buscá los productos que se envían.
                </p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Producto</th>
                        <th className="text-right font-medium px-2 py-2 w-32">
                          Stock en {nombreSucursal(origen).replace("Sucursal ", "S")}
                        </th>
                        <th className="text-left font-medium px-2 py-2 w-28">Envía</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((it, i) => {
                        const p = productos.find((x) => x.id === it.producto_id);
                        const d = disponible(it);
                        const pasa = d !== null && Number(it.cantidad) > d;
                        return (
                          <tr key={i}>
                            <td className="px-3 py-1.5">
                              <p className="text-gray-800">{it.nombre}</p>
                              {p?.tiene_variantes && (
                                <select
                                  required
                                  value={it.variante_nombre}
                                  onChange={(e) => cambiar(i, "variante_nombre", e.target.value)}
                                  aria-label="Variante"
                                  className={`${CAMPO} mt-1 py-1.5`}
                                >
                                  <option value="">Elegí la variante</option>
                                  {p.variantes.map((v) => (
                                    <option key={v.nombre} value={v.nombre}>
                                      {v.nombre} (stock {stockEn(v, origen)})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className={`px-2 py-1.5 text-right ${pasa ? "text-red-600 font-semibold" : "text-gray-600"}`}>
                              {d ?? "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              <InputNumero
                                value={it.cantidad}
                                onChange={(v) => cambiar(i, "cantidad", v)}
                                decimales={0}
                                required
                                aria-label="Cantidad que se envía"
                                className={`${CAMPO} ${pasa ? "border-red-400" : ""}`}
                              />
                            </td>
                            <td className="pr-2 text-right">
                              <button
                                type="button"
                                onClick={() => setItems(items.filter((_, j) => j !== i))}
                                aria-label="Quitar producto"
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <X size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {excede && (
                <p className="text-xs text-red-600">
                  Hay cantidades mayores al stock de {nombreSucursal(origen)}.
                </p>
              )}
            </section>

            <div>
              <label htmlFor="rem-notas" className={ETIQUETA}>Notas</label>
              <input
                id="rem-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional: quién lo lleva, motivo..."
                className={CAMPO}
              />
            </div>
          </div>
          <div className="flex gap-3 sm:justify-end px-6 py-3 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none sm:w-40 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none sm:w-48 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              {loading ? "Registrando..." : "Registrar remito"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Comprobante del remito para imprimir y mandar con la mercadería
function imprimirRemito(r, usuario) {
  const v = window.open("", "_blank", "width=720,height=800");
  if (!v) {
    toast.error("El navegador bloqueó la ventana de impresión");
    return;
  }
  const filas = r.items
    .map((i) => `<tr><td>${i.nombre_producto}</td><td style="text-align:right">${i.cantidad}</td></tr>`)
    .join("");
  v.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Remito ${r.numero}</title>
  <style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;margin:32px;color:#111}
  h1{font-size:16pt;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}.f{margin-top:48px;display:flex;gap:48px}
  .f div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:10pt}</style></head><body>
  <h1>Cellmin · Remito interno ${r.numero}</h1>
  <p>${new Date(r.fecha).toLocaleString("es-AR")} · Envía: <b>${nombreSucursal(r.origen)}</b> · Recibe: <b>${nombreSucursal(r.destino)}</b></p>
  <p>Registró: ${usuario || "-"}${r.notas ? ` · Notas: ${r.notas}` : ""}</p>
  <table><thead><tr><th>Producto</th><th style="text-align:right">Cantidad</th></tr></thead><tbody>${filas}</tbody></table>
  <div class="f"><div>Entregó</div><div>Recibió</div></div>
  <script>window.print()</script></body></html>`);
  v.document.close();
}

// Inventario → Remitos: envíos de mercadería entre las sucursales
export default function Remitos() {
  const [remitos, setRemitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const cargar = () =>
    remitosService
      .getAll()
      .then(setRemitos)
      .catch(() => toast.error("Error al cargar los remitos"))
      .finally(() => setLoading(false));

  useEffect(() => {
    cargar();
  }, []);

  const nombreUsuario = (r) => r.usuario_nombre || "";
  const unidades = (r) => r.items.reduce((a, i) => a + i.cantidad, 0);

  const tabla = useTabla(remitos, {
    porPagina: 20,
    ordenInicial: { campo: "fecha", dir: "desc" },
    accessors: {
      fecha: (r) => new Date(r.fecha).getTime(),
      unidades,
    },
  });

  const acciones = (r) => [
    { label: "Ver detalle", icono: <Eye size={14} />, onClick: () => setDetalle(r) },
    { label: "Imprimir", icono: <Printer size={14} />, onClick: () => imprimirRemito(r, nombreUsuario(r)) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Remitos entre sucursales</h1>
          <p className="text-sm text-gray-500">
            Cada remito descuenta la mercadería de una sucursal y la suma en la otra.
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={18} /> Nuevo remito
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : remitos.length === 0 ? (
        <div className="text-center py-12">
          <Truck size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Todavía no hay remitos</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <ThOrdenable campo="numero" tabla={tabla} className="px-6 py-3">Número</ThOrdenable>
                  <ThOrdenable campo="fecha" tabla={tabla} className="px-6 py-3">Fecha</ThOrdenable>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Recorrido</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Productos</th>
                  <ThOrdenable campo="unidades" tabla={tabla} align="center" className="px-6 py-3">Unidades</ThOrdenable>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Registró</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabla.filas.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-800">{r.numero}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(r.fecha)}</td>
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {nombreSucursal(r.origen)} <ArrowRight size={13} className="inline mx-1 text-gray-400" />
                      {nombreSucursal(r.destino)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {r.items.map((i) => i.nombre_producto).join(", ")}
                    </td>
                    <td className="col-num px-6 py-3 text-sm text-gray-800">{unidades(r)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{nombreUsuario(r)}</td>
                    <td className="col-acc px-6 py-3">
                      <MenuAcciones acciones={acciones(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion
            total={tabla.total}
            porPagina={tabla.porPagina}
            paginaActual={tabla.pagina}
            onChange={tabla.setPagina}
          />
        </>
      )}

      {modal && (
        <NuevoRemitoModal
          onClose={() => setModal(false)}
          onSave={() => {
            setModal(false);
            cargar();
          }}
        />
      )}

      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Remito {detalle.numero}</h2>
              <button onClick={() => setDetalle(null)} aria-label="Cerrar" className="p-1 text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <p className="text-gray-600">
                {formatDateTime(detalle.fecha)} · {nombreSucursal(detalle.origen)} → {nombreSucursal(detalle.destino)}
                {nombreUsuario(detalle) && ` · ${nombreUsuario(detalle)}`}
              </p>
              <table className="w-full">
                <tbody className="divide-y divide-gray-100">
                  {detalle.items.map((i, k) => (
                    <tr key={k}>
                      <td className="py-1.5 text-gray-800">{i.nombre_producto}</td>
                      <td className="py-1.5 text-right font-medium">{i.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detalle.notas && <p className="text-gray-600">Notas: {detalle.notas}</p>}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => imprimirRemito(detalle, nombreUsuario(detalle))}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  <Printer size={15} /> Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
