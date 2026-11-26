import { useEffect, useState } from "react";
import { Plus, Search, X, Smartphone, Edit, Trash2, ToggleLeft, List } from "lucide-react";
import toast from "react-hot-toast";
import { confirmar } from "../utils/confirmar";
import { marcasService } from "../services/marcas.service";
import { useAuth } from "../context/AuthContext";
import MenuAcciones from "../components/ui/MenuAcciones";
import Paginacion from "../components/ui/Paginacion";
import ThOrdenable from "../components/ui/ThOrdenable";
import EncabezadoPagina from "../components/ui/EncabezadoPagina";
import { useTabla } from "../hooks/useTabla";
import { mensajeError } from "../utils/helpers";

const CAMPO =
  "w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// Cuántos modelos se muestran en el listado antes de "+N más"
const MODELOS_VISIBLES = 4;

// Alta o cambio de nombre de una marca
function MarcaModal({ marca, onClose, onSave }) {
  const [nombre, setNombre] = useState(marca?.nombre || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("Escribí el nombre de la marca");
    setGuardando(true);
    try {
      const m = marca
        ? await marcasService.update(marca.id, { nombre: nombre.trim() })
        : await marcasService.create(nombre.trim());
      toast.success(marca ? "Marca actualizada" : `Marca «${m.nombre}» creada`);
      onSave(m);
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo guardar la marca"));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{marca ? "Editar Marca" : "Nueva Marca"}</h2>
        </div>
        <form onSubmit={guardar} className="p-6 space-y-4">
          <div>
            <label htmlFor="marca-nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              id="marca-nombre"
              autoFocus
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: Samsung"
              className={CAMPO}
            />
          </div>
          {!marca && (
            <p className="text-xs text-gray-500">Los modelos se agregan después, desde las acciones de la marca.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button data-cerrar
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm disabled:bg-blue-400"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modelos de una marca: ver, agregar y (el administrador) quitar
function ModelosModal({ marca, esAdmin, onClose, onCambio }) {
  const [nuevo, setNuevo] = useState("");
  const [buscar, setBuscar] = useState("");
  const [guardando, setGuardando] = useState(false);

  const agregar = async (e) => {
    e.preventDefault();
    const nombre = nuevo.trim();
    if (!nombre) return;
    setGuardando(true);
    try {
      onCambio(await marcasService.agregarModelo(marca.id, nombre));
      setNuevo("");
      toast.success(`Modelo «${nombre}» agregado`);
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo agregar el modelo"));
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (modelo) => {
    if (
      !(await confirmar({
        mensaje: `¿Estás seguro de que querés quitar el modelo «${modelo}» de ${marca.nombre}?`,
        detalle: "Las órdenes ya cargadas no cambian.",
        textoConfirmar: "Sí, quitar",
        peligro: true,
      }))
    )
      return;
    try {
      onCambio(await marcasService.quitarModelo(marca.id, modelo));
      toast.success(`Modelo «${modelo}» quitado`);
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo quitar el modelo"));
    }
  };

  const t = buscar.trim().toLowerCase();
  const modelos = marca.modelos.filter((m) => !t || m.toLowerCase().includes(t));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Modelos de {marca.nombre}</h2>
            <p className="text-sm text-gray-500">
              {marca.modelos.length} {marca.modelos.length === 1 ? "modelo" : "modelos"}
            </p>
          </div>
          <button data-cerrar onClick={onClose} aria-label="Cerrar" className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {marca.activo ? (
            <form onSubmit={agregar} className="flex flex-col sm:flex-row gap-2">
              <input
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                autoFocus
                placeholder="Nuevo modelo (ej.: Galaxy A15)"
                aria-label={`Nuevo modelo de ${marca.nombre}`}
                className={CAMPO}
              />
              <button
                type="submit"
                disabled={guardando}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium whitespace-nowrap disabled:bg-blue-400"
              >
                <Plus size={16} /> Agregar modelo
              </button>
            </form>
          ) : (
            <p className="text-sm text-gray-500">La marca está desactivada: activala para agregarle modelos.</p>
          )}
          {marca.modelos.length > 8 && (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Buscar modelo..."
                className={`${CAMPO} pl-9`}
              />
            </div>
          )}
          {modelos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              {marca.modelos.length === 0 ? "Todavía no tiene modelos." : "No hay modelos con ese nombre."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
              {modelos.map((m) => (
                <li key={m} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-gray-700">
                  {m}
                  {esAdmin && (
                    <button
                      onClick={() => quitar(m)}
                      title="Quitar modelo"
                      aria-label={`Quitar ${m}`}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Vista previa de los modelos en el listado
function ResumenModelos({ modelos }) {
  if (modelos.length === 0) return <span className="text-sm text-gray-400">Sin modelos todavía</span>;
  const resto = modelos.length - MODELOS_VISIBLES;
  return (
    <div className="flex flex-wrap gap-1.5">
      {modelos.slice(0, MODELOS_VISIBLES).map((x) => (
        <span key={x} className="px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-700">
          {x}
        </span>
      ))}
      {resto > 0 && <span className="px-2 py-0.5 text-xs text-gray-500">+{resto} más</span>}
    </div>
  );
}

// Reparaciones → Marcas y modelos: catálogo para buscar el equipo al cargar
// una orden. También se crean desde la orden, al escribir uno que no está.
export default function MarcasModelos() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "administrador";
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ busqueda: "", estado: "" });
  const [editando, setEditando] = useState(undefined); // undefined: cerrado · null: nueva · marca: editar
  const [modelosDe, setModelosDe] = useState(null);

  useEffect(() => {
    marcasService
      .getAll()
      .then(setMarcas)
      .catch(() => toast.error("Error al cargar las marcas"))
      .finally(() => setLoading(false));
  }, []);

  const ordenar = (l) => [...l].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const reemplazar = (m) => {
    setMarcas((l) => ordenar(l.some((x) => x.id === m.id) ? l.map((x) => (x.id === m.id ? m : x)) : [...l, m]));
    setModelosDe((actual) => (actual?.id === m.id ? m : actual));
  };

  const alternar = async (marca) => {
    const accion = marca.activo ? "Desactivar" : "Activar";
    if (
      !(await confirmar({
        mensaje: `¿Estás seguro de que querés ${accion.toLowerCase()} la marca ${marca.nombre}?`,
        textoConfirmar: `Sí, ${accion.toLowerCase()}`,
        peligro: marca.activo,
      }))
    )
      return;
    try {
      reemplazar(await marcasService.update(marca.id, { activo: !marca.activo }));
      toast.success(`Marca ${marca.activo ? "desactivada" : "activada"}`);
    } catch (error) {
      toast.error(mensajeError(error, "No se pudo actualizar la marca"));
    }
  };

  const construirAcciones = (marca) => [
    {
      label: marca.activo ? "Ver y agregar modelos" : "Ver modelos",
      icono: <List size={15} />,
      onClick: () => setModelosDe(marca),
    },
    esAdmin && {
      label: "Editar nombre",
      icono: <Edit size={15} />,
      onClick: () => setEditando(marca),
    },
    esAdmin && {
      label: marca.activo ? "Desactivar" : "Activar",
      icono: marca.activo ? <Trash2 size={15} /> : <ToggleLeft size={15} />,
      onClick: () => alternar(marca),
      peligro: marca.activo,
    },
  ];

  const t = filtros.busqueda.trim().toLowerCase();
  const filtradas = marcas.filter((m) => {
    if (t && !m.nombre.toLowerCase().includes(t) && !m.modelos.some((x) => x.toLowerCase().includes(t))) return false;
    if (filtros.estado === "activo" && !m.activo) return false;
    if (filtros.estado === "inactivo" && m.activo) return false;
    return true;
  });

  const tabla = useTabla(filtradas, {
    porPagina: 20,
    ordenInicial: { campo: "nombre", dir: "asc" },
    accessors: { cantidad: (m) => m.modelos.length },
  });

  const Inactiva = () => (
    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-md">Inactiva</span>
  );

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Marcas y modelos"
        subtitulo={`${marcas.length} marcas registradas · se usan para buscar el equipo al cargar una orden`}
      >
        <button
          onClick={() => setEditando(null)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={18} />
          Nueva Marca
        </button>
      </EncabezadoPagina>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value })}
            placeholder="Buscar marca o modelo..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          aria-label="Estado"
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          <option value="activo">Activas</option>
          <option value="inactivo">Inactivas</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12">
          <Smartphone size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No se encontraron marcas</p>
        </div>
      ) : (
        <>
          {/* Computadora */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <ThOrdenable campo="nombre" tabla={tabla} className="px-6 py-3">Marca</ThOrdenable>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Modelos</th>
                  <ThOrdenable campo="cantidad" tabla={tabla} className="px-6 py-3">Cantidad</ThOrdenable>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tabla.filas.map((m) => (
                  <tr key={m.id} className={`hover:bg-gray-50 transition-[background-color] ${m.activo ? "" : "opacity-60"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setModelosDe(m)}
                          className="font-medium text-gray-800 hover:text-blue-700 hover:underline"
                        >
                          {m.nombre}
                        </button>
                        {!m.activo && <Inactiva />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <ResumenModelos modelos={m.modelos} />
                    </td>
                    <td className="col-num px-6 py-4 text-sm text-gray-700">{m.modelos.length}</td>
                    <td className="col-acc px-6 py-4">
                      <MenuAcciones acciones={construirAcciones(m)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular */}
          <div className="md:hidden space-y-3">
            {tabla.filas.map((m) => (
              <div
                key={m.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3 ${m.activo ? "" : "opacity-60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone size={16} className="text-blue-600 shrink-0" />
                    <button onClick={() => setModelosDe(m)} className="font-medium text-gray-800 truncate">
                      {m.nombre}
                    </button>
                    {!m.activo && <Inactiva />}
                  </div>
                  <MenuAcciones acciones={construirAcciones(m)} />
                </div>
                <ResumenModelos modelos={m.modelos} />
                <p className="text-xs text-gray-500">
                  {m.modelos.length} {m.modelos.length === 1 ? "modelo" : "modelos"}
                </p>
              </div>
            ))}
          </div>

          <Paginacion
            total={tabla.total}
            porPagina={tabla.porPagina}
            paginaActual={tabla.pagina}
            onChange={tabla.setPagina}
          />
        </>
      )}

      {editando !== undefined && (
        <MarcaModal
          marca={editando}
          onClose={() => setEditando(undefined)}
          onSave={(m) => {
            reemplazar(m);
            setEditando(undefined);
          }}
        />
      )}
      {modelosDe && (
        <ModelosModal
          marca={modelosDe}
          esAdmin={esAdmin}
          onClose={() => setModelosDe(null)}
          onCambio={reemplazar}
        />
      )}
    </div>
  );
}
