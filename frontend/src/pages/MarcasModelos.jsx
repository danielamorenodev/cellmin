import { useEffect, useState } from "react";
import { Plus, Search, X, Smartphone } from "lucide-react";
import toast from "react-hot-toast";
import { marcasService } from "../services/marcas.service";
import { useAuth } from "../context/AuthContext";

// Reparaciones → Marcas y modelos: catálogo para buscar el equipo al cargar
// una orden. También se crean desde la orden, al escribir uno que no está.
export default function MarcasModelos() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "administrador";
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [nuevaMarca, setNuevaMarca] = useState("");
  const [nuevoModelo, setNuevoModelo] = useState({}); // { [marcaId]: texto }

  const cargar = () =>
    marcasService
      .getAll()
      .then(setMarcas)
      .catch(() => toast.error("Error al cargar las marcas"))
      .finally(() => setLoading(false));

  useEffect(() => {
    cargar();
  }, []);

  const reemplazar = (m) => setMarcas((l) => l.map((x) => (x.id === m.id ? m : x)));

  const crearMarca = async (e) => {
    e.preventDefault();
    const nombre = nuevaMarca.trim();
    if (!nombre) return;
    try {
      const m = await marcasService.create(nombre);
      setMarcas((l) => [...l, m].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevaMarca("");
      toast.success(`Marca «${m.nombre}» creada`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo crear la marca");
    }
  };

  const crearModelo = async (marca) => {
    const nombre = (nuevoModelo[marca.id] || "").trim();
    if (!nombre) return;
    try {
      reemplazar(await marcasService.agregarModelo(marca.id, nombre));
      setNuevoModelo({ ...nuevoModelo, [marca.id]: "" });
      toast.success(`Modelo «${nombre}» agregado a ${marca.nombre}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo agregar el modelo");
    }
  };

  const quitarModelo = async (marca, modelo) => {
    if (!confirm(`¿Quitar el modelo «${modelo}» de ${marca.nombre}? Las órdenes ya cargadas no cambian.`)) return;
    try {
      reemplazar(await marcasService.quitarModelo(marca.id, modelo));
      toast.success(`Modelo «${modelo}» quitado`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo quitar el modelo");
    }
  };

  const alternar = async (marca) => {
    try {
      reemplazar(await marcasService.update(marca.id, { activo: !marca.activo }));
      toast.success(`Marca ${marca.nombre} ${marca.activo ? "desactivada" : "activada"}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "No se pudo actualizar la marca");
    }
  };

  const t = busqueda.trim().toLowerCase();
  const visibles = marcas.filter(
    (m) => !t || m.nombre.toLowerCase().includes(t) || m.modelos.some((x) => x.toLowerCase().includes(t)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Marcas y modelos</h1>
        <p className="text-sm text-gray-500">
          Se usan para buscar el equipo al cargar una orden. Si falta alguno, también se puede crear desde la orden.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar marca o modelo..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <form onSubmit={crearMarca} className="flex gap-2">
          <input
            value={nuevaMarca}
            onChange={(e) => setNuevaMarca(e.target.value)}
            placeholder="Nueva marca"
            aria-label="Nombre de la nueva marca"
            className="w-48 px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} /> Agregar
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((m) => (
            <div
              key={m.id}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 ${m.activo ? "" : "opacity-60"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone size={16} className="text-blue-600" />
                  <p className="font-semibold text-gray-800">{m.nombre}</p>
                  <span className="text-xs text-gray-400">
                    {m.modelos.length} {m.modelos.length === 1 ? "modelo" : "modelos"}
                  </span>
                </div>
                {esAdmin && (
                  <button onClick={() => alternar(m)} className="text-xs text-gray-500 hover:text-gray-800">
                    {m.activo ? "Desactivar" : "Activar"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.modelos.map((x) => (
                  <span
                    key={x}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs bg-gray-100 text-gray-700"
                  >
                    {x}
                    {esAdmin && (
                      <button
                        onClick={() => quitarModelo(m, x)}
                        aria-label={`Quitar ${x}`}
                        className="p-0.5 text-gray-400 hover:text-red-600"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
                {m.modelos.length === 0 && <span className="text-xs text-gray-400">Sin modelos todavía</span>}
              </div>
              {m.activo && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    crearModelo(m);
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={nuevoModelo[m.id] || ""}
                    onChange={(e) => setNuevoModelo({ ...nuevoModelo, [m.id]: e.target.value })}
                    placeholder="Agregar modelo"
                    aria-label={`Nuevo modelo de ${m.nombre}`}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" className="px-3 py-1.5 border border-blue-600 text-blue-700 rounded-lg text-sm hover:bg-blue-50">
                    Agregar
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
