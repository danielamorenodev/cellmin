import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, ToggleLeft, CreditCard, PlusCircle, X } from "lucide-react";
import toast from "react-hot-toast";
import { tarjetasService } from "../services/tarjetas.service";
import MenuAcciones from "../components/ui/MenuAcciones";
import InputNumero from "../components/ui/InputNumero";

const CAMPO =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

const textoPlan = (p) =>
  `${p.cuotas === 1 ? "1 pago" : `${p.cuotas} cuotas`}${p.recargo > 0 ? ` +${p.recargo}%` : ""}`;

function TarjetaModal({ tarjeta, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: tarjeta?.nombre || "",
    debito: tarjeta?.debito ?? true,
    credito: tarjeta?.credito ?? true,
    planes: tarjeta?.planes?.length ? tarjeta.planes : [{ cuotas: 1, recargo: 0 }],
  });
  const [loading, setLoading] = useState(false);

  const cambiarPlan = (i, campo, valor) =>
    setForm({
      ...form,
      planes: form.planes.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)),
    });

  const agregarPlan = () => {
    const usadas = form.planes.map((p) => Number(p.cuotas));
    const siguiente = [3, 6, 12, 18, 24].find((c) => !usadas.includes(c)) || "";
    setForm({ ...form, planes: [...form.planes, { cuotas: siguiente, recargo: 0 }] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.debito && !form.credito) {
      toast.error("Marcá si la tarjeta es de débito, de crédito o de ambos");
      return;
    }
    const planes = form.planes
      .filter((p) => Number(p.cuotas) >= 1)
      .map((p) => ({ cuotas: Number(p.cuotas), recargo: Number(p.recargo) || 0 }));
    setLoading(true);
    try {
      const datos = { nombre: form.nombre.trim(), debito: form.debito, credito: form.credito, planes };
      if (tarjeta) {
        await tarjetasService.update(tarjeta.id, datos);
        toast.success(`Tarjeta ${datos.nombre} actualizada`);
      } else {
        await tarjetasService.create(datos);
        toast.success(`Tarjeta ${datos.nombre} creada`);
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar la tarjeta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">
            {tarjeta ? "Editar tarjeta" : "Nueva tarjeta"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <label htmlFor="tarjeta-nombre" className="block text-xs font-medium text-gray-600 mb-1">
                Nombre *
              </label>
              <input
                id="tarjeta-nombre"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="ej.: Visa"
                className={CAMPO}
              />
            </div>
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 mb-1.5">Se acepta como</legend>
              <div className="flex gap-6">
                {[
                  ["debito", "Débito"],
                  ["credito", "Crédito"],
                ].map(([k, t]) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                      className="w-4 h-4 text-blue-600"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>

            {form.credito && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Planes de cuotas (crédito)
                  </h3>
                  <button
                    type="button"
                    onClick={agregarPlan}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <PlusCircle size={15} /> Agregar plan
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="text-left font-medium pb-1">Cuotas</th>
                      <th className="text-left font-medium pb-1 px-2">Recargo (%)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.planes.map((p, i) => (
                      <tr key={i}>
                        <td className="py-1">
                          <InputNumero
                            value={p.cuotas}
                            onChange={(v) => cambiarPlan(i, "cuotas", v)}
                            decimales={0}
                            disabled={Number(p.cuotas) === 1 && i === 0}
                            aria-label="Cantidad de cuotas"
                            className={CAMPO}
                          />
                        </td>
                        <td className="py-1 px-2">
                          <InputNumero
                            value={p.recargo}
                            onChange={(v) => cambiarPlan(i, "recargo", v)}
                            aria-label="Recargo en porcentaje"
                            className={CAMPO}
                          />
                        </td>
                        <td className="py-1 text-right">
                          {!(Number(p.cuotas) === 1 && i === 0) && (
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, planes: form.planes.filter((_, j) => j !== i) })}
                              aria-label="Quitar plan"
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500">
                  El recargo se suma solo al cobrar con esta tarjeta en esas cuotas. 1 pago siempre está disponible.
                </p>
              </section>
            )}
          </div>
          <div className="flex gap-3 px-6 py-3 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-400 transition"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Configuración → Medios de pago: tarjetas aceptadas y sus planes de cuotas
export default function MediosPago() {
  const [tarjetas, setTarjetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | {} | tarjeta

  const cargar = () =>
    tarjetasService
      .getAll()
      .then(setTarjetas)
      .catch(() => toast.error("Error al cargar las tarjetas"))
      .finally(() => setLoading(false));

  useEffect(() => {
    cargar();
  }, []);

  const alternar = async (t) => {
    try {
      await tarjetasService.update(t.id, { activo: !t.activo });
      toast.success(`Tarjeta ${t.nombre} ${t.activo ? "desactivada" : "activada"}`);
      cargar();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar la tarjeta");
    }
  };

  const acciones = (t) => [
    { label: "Editar", icono: <Edit size={14} />, onClick: () => setModal(t) },
    {
      label: t.activo ? "Desactivar" : "Activar",
      icono: t.activo ? <Trash2 size={14} /> : <ToggleLeft size={14} />,
      onClick: () => alternar(t),
      peligro: t.activo,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Medios de pago</h1>
          <p className="text-sm text-gray-500">
            Tarjetas que se aceptan y sus planes de cuotas. Al cobrar con tarjeta se elige cuál y en cuántas cuotas.
          </p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={18} /> Nueva tarjeta
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tarjetas.map((t) => (
            <div
              key={t.id}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 ${t.activo ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{t.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {[t.debito && "Débito", t.credito && "Crédito"].filter(Boolean).join(" y ")}
                      {!t.activo && " · Inactiva"}
                    </p>
                  </div>
                </div>
                <MenuAcciones acciones={acciones(t)} />
              </div>
              {t.credito && (
                <div className="flex flex-wrap gap-1.5">
                  {t.planes.map((p) => (
                    <span
                      key={p.cuotas}
                      className={`px-2 py-0.5 rounded-md text-xs ${
                        p.recargo > 0 ? "bg-orange-50 text-orange-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {textoPlan(p)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {tarjetas.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no hay tarjetas cargadas.</p>
          )}
        </div>
      )}

      {modal && (
        <TarjetaModal
          tarjeta={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
