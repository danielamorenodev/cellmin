import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  X,
  Search,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Circle,
  BookOpen,
  LifeBuoy,
  Languages,
  MapPin,
  Info,
} from "lucide-react";
import { GUIAS, PROBLEMAS, GLOSARIO } from "./contenido";
import { MODULOS } from "../layout/modulos";
import { useAuth } from "../../context/AuthContext";

// Texto con **negritas** del manual
function Texto({ children }) {
  return String(children)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((t, i) =>
      t.startsWith("**") ? (
        <strong key={i} className="font-semibold text-gray-900">
          {t.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{t}</span>
      ),
    );
}

const sinTildes = (t) =>
  String(t)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\*/g, "");

const textoDeGuia = (g) =>
  sinTildes(
    [g.titulo, g.capitulo, ...g.bloques.flatMap((b) => b.pasos || [b.texto || b.nota || ""])].join(" "),
  );

const rutaBase = (r) => (r || "").split("?")[0];

// ¿El perfil puede entrar a esa pantalla? (según el menú)
const puedeIr = (rol, ruta) =>
  !!ruta &&
  MODULOS.some((m) => m.items.some((i) => rutaBase(i.path) === rutaBase(ruta) && i.roles.includes(rol)));

const PESTANAS = [
  { id: "mias", label: "Para mi puesto", icono: BookOpen },
  { id: "todas", label: "Todas las guías", icono: BookOpen },
  { id: "problemas", label: "Problemas frecuentes", icono: LifeBuoy },
  { id: "glosario", label: "Glosario", icono: Languages },
];

function Guia({ guia, abierta, onToggle, rol, onIr }) {
  // Pasos que el usuario va marcando mientras sigue la guía
  const [hechos, setHechos] = useState({});
  const ir = puedeIr(rol, guia.ruta);
  let n = 0;
  return (
    <div className={`rounded-xl border transition ${abierta ? "border-blue-200 bg-white shadow-sm" : "border-gray-200 bg-white"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-gray-800">{guia.titulo}</span>
          <span className="block text-xs text-gray-500">{guia.capitulo}</span>
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition ${abierta ? "rotate-180" : ""}`} />
      </button>
      {abierta && (
        <div className="px-4 pb-4 space-y-3 text-sm text-gray-700 leading-relaxed">
          {guia.bloques.map((b, i) =>
            b.pasos ? (
              <ol key={i} className="space-y-2">
                {b.pasos.map((p) => {
                  const k = n++;
                  const hecho = !!hechos[k];
                  return (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => setHechos({ ...hechos, [k]: !hecho })}
                        className={`w-full flex gap-3 text-left rounded-lg p-2 -m-2 transition hover:bg-gray-50 ${hecho ? "text-gray-400" : ""}`}
                        title={hecho ? "Marcar como pendiente" : "Marcar como hecho"}
                      >
                        {hecho ? (
                          <CheckCircle2 size={20} className="shrink-0 text-green-600 mt-0.5" />
                        ) : (
                          <span className="shrink-0 w-5 h-5 mt-0.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold flex items-center justify-center">
                            {k + 1}
                          </span>
                        )}
                        <span className={hecho ? "line-through decoration-gray-300" : ""}>
                          <Texto>{p}</Texto>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : b.nota ? (
              <p key={i} className="flex gap-2 rounded-lg bg-teal-50 text-teal-800 p-3">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  <Texto>{b.nota}</Texto>
                </span>
              </p>
            ) : (
              <p key={i}>
                <Texto>{b.texto}</Texto>
              </p>
            ),
          )}
          {n > 0 && Object.values(hechos).some(Boolean) && (
            <button
              type="button"
              onClick={() => setHechos({})}
              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              <Circle size={12} /> Desmarcar los pasos
            </button>
          )}
          {ir && (
            <button
              type="button"
              onClick={() => onIr(guia.ruta)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Ir a la pantalla <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Manual de usuario interactivo: se abre con el botón ? del encabezado (o la tecla ?)
export default function Ayuda({ onClose }) {
  const { user } = useAuth();
  const rol = user?.rol;
  const location = useLocation();
  const navigate = useNavigate();
  const [pestana, setPestana] = useState("mias");
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState(null);
  const buscador = useRef(null);

  useEffect(() => {
    buscador.current?.focus();
  }, []);
  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onClose]);

  const mias = useMemo(
    () => GUIAS.filter((g) => g.perfiles.includes("todos") || g.perfiles.includes(rol)),
    [rol],
  );
  // Guías de la pantalla en la que está el usuario
  const deEstaPantalla = useMemo(
    () => mias.filter((g) => g.ruta && rutaBase(g.ruta) === location.pathname),
    [mias, location.pathname],
  );

  const q = sinTildes(busqueda.trim());
  const base = pestana === "todas" ? GUIAS : mias;
  const guias = q ? base.filter((g) => textoDeGuia(g).includes(q)) : base;
  const problemas = q ? PROBLEMAS.filter((p) => sinTildes(p.join(" ")).includes(q)) : PROBLEMAS;
  const glosario = q ? GLOSARIO.filter((p) => sinTildes(p.join(" ")).includes(q)) : GLOSARIO;

  // Agrupar por capítulo, en el orden del manual
  const capitulos = [];
  guias.forEach((g) => {
    let c = capitulos.find((x) => x.nombre === g.capitulo);
    if (!c) capitulos.push((c = { nombre: g.capitulo, guias: [] }));
    c.guias.push(g);
  });

  const ir = (ruta) => {
    navigate(ruta);
    onClose();
  };
  const toggle = (id) => setAbierta(abierta === id ? null : id);
  const esGuias = pestana === "mias" || pestana === "todas";

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="titulo-ayuda">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] bg-gray-50 shadow-2xl flex flex-col">
        <div className="bg-white border-b border-gray-200 px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="titulo-ayuda" className="text-lg font-bold text-gray-800">
                Ayuda
              </h2>
              <p className="text-xs text-gray-500">Manual de usuario de Cellmin Gestión</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar la ayuda"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={buscador}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="¿Qué querés hacer? Ej.: cerrar la caja"
              aria-label="Buscar en la ayuda"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] -mx-1 px-1">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPestana(p.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  pestana === p.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {esGuias && !q && pestana === "mias" && deEstaPantalla.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                <MapPin size={13} /> En esta pantalla
              </h3>
              {deEstaPantalla.map((g) => (
                <Guia
                  key={"aca-" + g.id}
                  guia={g}
                  rol={rol}
                  abierta={abierta === "aca-" + g.id}
                  onToggle={() => toggle("aca-" + g.id)}
                  onIr={ir}
                />
              ))}
            </section>
          )}

          {esGuias &&
            capitulos.map((c) => (
              <section key={c.nombre} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{c.nombre}</h3>
                {c.guias.map((g) => (
                  <Guia
                    key={g.id}
                    guia={g}
                    rol={rol}
                    abierta={abierta === g.id || (!!q && guias.length <= 2)}
                    onToggle={() => toggle(g.id)}
                    onIr={ir}
                  />
                ))}
              </section>
            ))}

          {pestana === "problemas" &&
            problemas.map(([que, hacer]) => (
              <details key={que} className="group rounded-xl border border-gray-200 bg-white" open={!!q && problemas.length <= 3}>
                <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none text-sm font-semibold text-gray-800">
                  <span className="flex-1">{que}</span>
                  <ChevronDown size={16} className="text-gray-400 transition group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 text-sm text-gray-700 leading-relaxed">
                  <Texto>{hacer}</Texto>
                </p>
              </details>
            ))}

          {pestana === "glosario" && (
            <dl className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
              {glosario.map(([t, d]) => (
                <div key={t} className="px-4 py-3">
                  <dt className="text-sm font-semibold text-gray-800">{t}</dt>
                  <dd className="text-sm text-gray-600 mt-0.5">
                    <Texto>{d}</Texto>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {((esGuias && guias.length === 0) ||
            (pestana === "problemas" && problemas.length === 0) ||
            (pestana === "glosario" && glosario.length === 0)) && (
            <div className="text-center py-10 text-sm text-gray-500 space-y-2">
              <p>No encontramos nada con «{busqueda}».</p>
              {pestana === "mias" && (
                <button type="button" onClick={() => setPestana("todas")} className="text-blue-700 hover:underline">
                  Buscar en todas las guías
                </button>
              )}
            </div>
          )}
        </div>

        <p className="bg-white border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
          Tocá cada paso para marcarlo mientras lo hacés. Atajo: tecla <kbd className="px-1 py-0.5 border rounded">?</kbd>
        </p>
      </aside>
    </div>
  );
}
