import { Plus } from "lucide-react";
import { ALTO_FILA } from "../../utils/variantes";

// En una fila con variante, el nombre del producto ocupa una línea arriba del
// selector: las otras celdas dejan ese mismo espacio para quedar a la altura
// del selector.
export const EspacioNombre = ({ producto }) =>
  producto?.tiene_variantes ? <div className="h-6" aria-hidden="true" /> : null;

// Variantes de un producto ya elegidas en otras filas (no se ofrecen de nuevo)
const usadas = (items, index) =>
  items
    .filter((it, j) => j !== index && it.producto_id === items[index].producto_id && it.variante_nombre)
    .map((it) => it.variante_nombre);

// Celda "Producto" de una fila de carga: el nombre y, si el producto tiene
// variantes, el selector de variante y la opción de sumar otra variante.
export default function CeldaVariante({
  nombre,
  producto,
  items,
  index,
  onElegir,
  onOtra,
  etiqueta = (v) => v.nombre,
  claseCampo,
}) {
  if (!producto?.tiene_variantes) {
    return <div className={`${ALTO_FILA} flex items-center text-gray-800`}>{nombre}</div>;
  }
  const yaElegidas = usadas(items, index);
  const disponibles = producto.variantes.filter((v) => !yaElegidas.includes(v.nombre));
  const esUltimaDelProducto = !items.some((it, j) => j > index && it.producto_id === producto.id);
  const quedanVariantes = producto.variantes.length > yaElegidas.length + 1;

  return (
    <div>
      <p className="text-gray-800 h-6 leading-5 truncate">{nombre}</p>
      <select
        required
        value={items[index].variante_nombre}
        onChange={(e) => onElegir(e.target.value)}
        aria-label={`Variante de ${nombre}`}
        className={`${claseCampo} ${ALTO_FILA} py-0`}
      >
        <option value="">Elegí la variante</option>
        {disponibles.map((v) => (
          <option key={v.nombre} value={v.nombre}>
            {etiqueta(v)}
          </option>
        ))}
      </select>
      {esUltimaDelProducto && quedanVariantes && (
        <button
          type="button"
          onClick={onOtra}
          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 hover:underline"
        >
          <Plus size={13} /> Otra variante
        </button>
      )}
    </div>
  );
}
